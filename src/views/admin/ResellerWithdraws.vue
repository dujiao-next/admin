<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { adminAPI } from '@/api/admin'
import type { AdminResellerWithdraw } from '@/api/types'
import {
  RESELLER_WITHDRAW_STATUS_PAID,
  RESELLER_WITHDRAW_STATUS_PENDING,
  RESELLER_WITHDRAW_STATUS_REJECTED,
} from '@/constants/reseller'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import ListPagination from '@/components/ListPagination.vue'
import { useListRefresh, type ListFetchOptions } from '@/composables/useListRefresh'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { confirmAction } from '@/utils/confirm'
import { getAdminRouteUrl } from '@/utils/adminPath'
import { notifyError, notifySuccess } from '@/utils/notify'
import { formatDate, toRFC3339 } from '@/utils/format'
import ComplianceGuardWrapper from '@/components/ComplianceGuardWrapper.vue'

const { t } = useI18n()
const route = useRoute()
const loading = ref(true)
const { refreshing, refreshList } = useListRefresh()
const operating = ref(false)
const rows = ref<AdminResellerWithdraw[]>([])
const selectedWithdraw = ref<AdminResellerWithdraw | null>(null)
const showRejectDialog = ref(false)
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const filters = reactive({
  keyword: '',
  resellerId: '',
  userId: '',
  status: '__all__',
  createdFrom: '',
  createdTo: '',
})
const rejectForm = reactive({
  reason: '',
})

const queryString = (value: unknown) => (Array.isArray(value) ? value[0] : value)
const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)
const pageSizeOptions = [10, 20, 50, 100]
const userDetailLink = (userId: number) => getAdminRouteUrl(`/users/${userId}`)
const resolveResellerUserID = (item: AdminResellerWithdraw) => Number(item?.profile?.user_id || item?.profile?.user?.id || 0)

const fetchRows = async (page = 1, options: ListFetchOptions = {}) => {
  if (!options.preserveRows) loading.value = true
  try {
    const response = await adminAPI.getResellerWithdraws({
      page,
      page_size: pagination.value.page_size,
      keyword: filters.keyword || undefined,
      reseller_id: filters.resellerId || undefined,
      user_id: filters.userId || undefined,
      status: normalizeFilterValue(filters.status) || undefined,
      created_from: toRFC3339(filters.createdFrom),
      created_to: toRFC3339(filters.createdTo),
    })
    rows.value = response.data.data || []
    pagination.value = response.data.pagination || pagination.value
  } catch {
    if (!options.preserveRows) rows.value = []
  } finally {
    if (!options.preserveRows) loading.value = false
  }
}

const handleSearch = () => {
  fetchRows(1, { preserveRows: true })
}
const debouncedSearch = useDebounceFn(handleSearch, 300)

const refreshCurrentPage = () => {
  refreshList(() => fetchRows(pagination.value.page, { preserveRows: true }))
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchRows(page)
}

const changePageSize = (size: number) => {
  if (size === pagination.value.page_size) return
  pagination.value.page_size = size
  fetchRows(1)
}

const statusLabel = (status?: string) => {
  if (status === RESELLER_WITHDRAW_STATUS_PENDING) return t('admin.resellerWithdraws.status.pending')
  if (status === RESELLER_WITHDRAW_STATUS_REJECTED) return t('admin.resellerWithdraws.status.rejected')
  if (status === RESELLER_WITHDRAW_STATUS_PAID) return t('admin.resellerWithdraws.status.paid')
  return status || '-'
}

const statusClass = (status?: string) => {
  if (status === RESELLER_WITHDRAW_STATUS_PENDING) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === RESELLER_WITHDRAW_STATUS_REJECTED) return 'border-zinc-200 bg-zinc-50 text-zinc-700'
  if (status === RESELLER_WITHDRAW_STATUS_PAID) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-border bg-muted/30 text-muted-foreground'
}

const processorName = (item: AdminResellerWithdraw) => {
  if (typeof item.processor === 'object') return item.processor?.username || item.processed_by || '-'
  return item.processor || item.processed_by || '-'
}

const initFiltersFromQuery = () => {
  const resellerId = String(queryString(route.query.reseller_id) || '').trim()
  if (resellerId) filters.resellerId = resellerId
}

const openRejectDialog = (row: AdminResellerWithdraw) => {
  selectedWithdraw.value = row
  rejectForm.reason = ''
  showRejectDialog.value = true
}

const rejectWithdraw = async () => {
  const row = selectedWithdraw.value
  if (!row) return
  const confirmed = await confirmAction({
    description: t('admin.resellerWithdraws.actions.rejectConfirm', { id: row.id }),
    variant: 'destructive',
  })
  if (!confirmed) return

  operating.value = true
  try {
    await adminAPI.rejectResellerWithdraw(row.id, { reason: rejectForm.reason.trim() || undefined })
    showRejectDialog.value = false
    notifySuccess(t('admin.resellerWithdraws.actions.rejectSuccess'))
    await fetchRows(pagination.value.page)
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerWithdraws.actions.rejectFailed'))
  } finally {
    operating.value = false
  }
}

const payWithdraw = async (row: AdminResellerWithdraw) => {
  const confirmed = await confirmAction({ description: t('admin.resellerWithdraws.actions.payConfirm', { id: row.id }) })
  if (!confirmed) return
  operating.value = true
  try {
    await adminAPI.payResellerWithdraw(row.id)
    notifySuccess(t('admin.resellerWithdraws.actions.paySuccess'))
    await fetchRows(pagination.value.page)
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerWithdraws.actions.payFailed'))
  } finally {
    operating.value = false
  }
}

onMounted(() => {
  initFiltersFromQuery()
  fetchRows()
})
</script>

<template>
  <ComplianceGuardWrapper>
    <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-semibold">{{ t('admin.resellerWithdraws.title') }}</h1>
      </div>

      <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div class="w-full md:w-56">
            <Input v-model="filters.keyword" :placeholder="t('admin.resellerWithdraws.filters.keyword')" @update:modelValue="debouncedSearch" />
          </div>
          <div class="w-full md:w-36">
            <Input v-model="filters.resellerId" :placeholder="t('admin.resellerWithdraws.filters.resellerId')" @update:modelValue="debouncedSearch" />
          </div>
          <div class="w-full md:w-32">
            <Input v-model="filters.userId" :placeholder="t('admin.resellerWithdraws.filters.userId')" @update:modelValue="debouncedSearch" />
          </div>
          <div class="w-full md:w-44">
            <Select v-model="filters.status" @update:modelValue="handleSearch">
              <SelectTrigger class="h-9 w-full">
                <SelectValue :placeholder="t('admin.resellerWithdraws.filters.statusAll')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{{ t('admin.resellerWithdraws.filters.statusAll') }}</SelectItem>
                <SelectItem :value="RESELLER_WITHDRAW_STATUS_PENDING">{{ t('admin.resellerWithdraws.status.pending') }}</SelectItem>
                <SelectItem :value="RESELLER_WITHDRAW_STATUS_REJECTED">{{ t('admin.resellerWithdraws.status.rejected') }}</SelectItem>
                <SelectItem :value="RESELLER_WITHDRAW_STATUS_PAID">{{ t('admin.resellerWithdraws.status.paid') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center">
            <span class="text-xs text-muted-foreground whitespace-nowrap">{{ t('admin.resellerWithdraws.filters.createdRange') }}</span>
            <Input v-model="filters.createdFrom" type="datetime-local" class="h-9 w-full md:w-auto" @update:modelValue="handleSearch" />
            <span class="hidden text-muted-foreground md:inline">-</span>
            <Input v-model="filters.createdTo" type="datetime-local" class="h-9 w-full md:w-auto" @update:modelValue="handleSearch" />
          </div>
          <div class="hidden flex-1 sm:block"></div>
          <Button size="sm" variant="outline" class="w-full sm:w-auto" :disabled="refreshing" @click="refreshCurrentPage">{{ t('admin.common.refresh') }}</Button>
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card overflow-x-auto">
        <Table class="min-w-[1120px]">
          <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <TableRow>
              <TableHead class="px-6 py-3">{{ t('admin.resellerWithdraws.table.id') }}</TableHead>
              <TableHead class="min-w-[180px] px-6 py-3">{{ t('admin.resellerWithdraws.table.reseller') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.resellerWithdraws.table.amount') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.resellerWithdraws.table.currency') }}</TableHead>
              <TableHead class="min-w-[100px] px-6 py-3">{{ t('admin.resellerWithdraws.table.channel') }}</TableHead>
              <TableHead class="min-w-[180px] px-6 py-3">{{ t('admin.resellerWithdraws.table.account') }}</TableHead>
              <TableHead class="min-w-[100px] px-6 py-3">{{ t('admin.resellerWithdraws.table.status') }}</TableHead>
              <TableHead class="min-w-[160px] px-6 py-3">{{ t('admin.resellerWithdraws.table.rejectReason') }}</TableHead>
              <TableHead class="min-w-[130px] px-6 py-3">{{ t('admin.resellerWithdraws.table.processedBy') }}</TableHead>
              <TableHead class="min-w-[140px] px-6 py-3">{{ t('admin.resellerWithdraws.table.createdAt') }}</TableHead>
              <TableHead class="min-w-[120px] px-6 py-3 text-right">{{ t('admin.resellerWithdraws.table.action') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody class="divide-y divide-border">
            <TableRow v-if="loading">
              <TableCell :colspan="11" class="p-0">
                <TableSkeleton :columns="11" :rows="5" />
              </TableCell>
            </TableRow>
            <TableRow v-else-if="rows.length === 0">
              <TableCell colspan="11" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.resellerWithdraws.empty') }}</TableCell>
            </TableRow>
            <TableRow v-for="item in rows" :key="item.id" class="hover:bg-muted/30">
              <TableCell class="px-6 py-4">
                <IdCell :value="item.id" />
              </TableCell>
              <TableCell class="min-w-[180px] px-6 py-4 text-xs text-muted-foreground">
                <div class="text-foreground break-words">{{ item?.profile?.user?.display_name || '-' }}</div>
                <div v-if="item?.profile?.user?.email" class="mt-0.5 break-all">{{ item.profile.user.email }}</div>
                <div class="mt-0.5 break-all">
                  <a
                    v-if="resolveResellerUserID(item) > 0"
                    :href="userDetailLink(resolveResellerUserID(item))"
                    target="_blank"
                    rel="noopener"
                    class="font-mono text-primary underline-offset-4 hover:underline"
                  >
                    #{{ resolveResellerUserID(item) }}
                  </a>
                  <span v-else class="font-mono text-foreground">-</span>
                  <span class="ml-1 font-mono text-muted-foreground">/ R#{{ item.reseller_id }}</span>
                </div>
              </TableCell>
              <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ item.amount || '0.00' }}</TableCell>
              <TableCell class="px-6 py-4 font-mono text-xs text-muted-foreground">{{ item.currency || '-' }}</TableCell>
              <TableCell class="min-w-[100px] px-6 py-4 text-xs text-foreground break-words">{{ item.channel || '-' }}</TableCell>
              <TableCell class="min-w-[180px] px-6 py-4 text-xs text-muted-foreground break-all">{{ item.account || '-' }}</TableCell>
              <TableCell class="min-w-[100px] px-6 py-4 text-xs">
                <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(item.status)">
                  {{ statusLabel(item.status) }}
                </span>
              </TableCell>
              <TableCell class="min-w-[160px] px-6 py-4 text-xs text-muted-foreground break-words">{{ item.reject_reason || '-' }}</TableCell>
              <TableCell class="min-w-[130px] px-6 py-4 text-xs text-muted-foreground">
                <div class="break-words">{{ processorName(item) }}</div>
                <div class="mt-0.5">{{ formatDate(item.processed_at) || '-' }}</div>
              </TableCell>
              <TableCell class="min-w-[140px] px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.created_at) }}</TableCell>
              <TableCell class="min-w-[120px] px-6 py-4 text-right">
                <div class="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    :disabled="operating || item.status !== RESELLER_WITHDRAW_STATUS_PENDING"
                    @click="openRejectDialog(item)"
                  >
                    {{ t('admin.resellerWithdraws.actions.reject') }}
                  </Button>
                  <Button
                    size="sm"
                    :disabled="operating || item.status !== RESELLER_WITHDRAW_STATUS_PENDING"
                    @click="payWithdraw(item)"
                  >
                    {{ t('admin.resellerWithdraws.actions.pay') }}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <ListPagination
          :page="pagination.page"
          :total-page="pagination.total_page"
          :total="pagination.total"
          :page-size="pagination.page_size"
          :page-size-options="pageSizeOptions"
          @change-page="changePage"
          @change-page-size="changePageSize"
        />
      </div>
    </div>

    <Dialog v-model:open="showRejectDialog">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{{ t('admin.resellerWithdraws.actions.reject') }} #{{ selectedWithdraw?.id || '-' }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="grid gap-2">
            <Label>{{ t('admin.resellerWithdraws.actions.rejectReasonPrompt') }}</Label>
            <Textarea v-model="rejectForm.reason" rows="4" />
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="showRejectDialog = false">{{ t('admin.common.cancel') }}</Button>
            <Button variant="destructive" :disabled="operating" @click="rejectWithdraw">
              {{ t('admin.resellerWithdraws.actions.reject') }}
            </Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>
  </ComplianceGuardWrapper>
</template>
