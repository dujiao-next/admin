<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminResellerDomain } from '@/api/types'
import {
  RESELLER_DOMAIN_STATUS_ACTIVE,
  RESELLER_DOMAIN_STATUS_DISABLED,
  RESELLER_DOMAIN_STATUS_PENDING_REVIEW,
  RESELLER_DOMAIN_TYPE_CUSTOM,
  RESELLER_DOMAIN_TYPE_SUBDOMAIN,
  RESELLER_DOMAIN_VERIFICATION_FAILED,
  RESELLER_DOMAIN_VERIFICATION_PENDING,
  RESELLER_DOMAIN_VERIFICATION_VERIFIED,
} from '@/constants/reseller'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import ListPagination from '@/components/ListPagination.vue'
import { useListRefresh, type ListFetchOptions } from '@/composables/useListRefresh'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { confirmAction } from '@/utils/confirm'
import { getAdminRouteUrl } from '@/utils/adminPath'
import { notifyError, notifySuccess } from '@/utils/notify'
import { formatDate, toRFC3339 } from '@/utils/format'
import { getResellerDomainActionState } from '@/utils/resellerManagement'

const { t } = useI18n()
const loading = ref(true)
const { refreshing, refreshList } = useListRefresh()
const operatingId = ref<number | null>(null)
const rows = ref<AdminResellerDomain[]>([])
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
  domain: '',
  type: '__all__',
  status: '__all__',
  verificationStatus: '__all__',
  createdFrom: '',
  createdTo: '',
})

const pageSizeOptions = [10, 20, 50, 100]
const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)
const userDetailLink = (userId: number) => getAdminRouteUrl(`/users/${userId}`)
const resolveResellerUserID = (item: AdminResellerDomain) => Number(item.profile?.user_id || item.profile?.user?.id || 0)

const fetchRows = async (page = 1, options: ListFetchOptions = {}) => {
  if (!options.preserveRows) loading.value = true
  try {
    const response = await adminAPI.getResellerDomains({
      page,
      page_size: pagination.value.page_size,
      keyword: filters.keyword || undefined,
      reseller_id: filters.resellerId || undefined,
      user_id: filters.userId || undefined,
      domain: filters.domain || undefined,
      type: normalizeFilterValue(filters.type) || undefined,
      status: normalizeFilterValue(filters.status) || undefined,
      verification_status: normalizeFilterValue(filters.verificationStatus) || undefined,
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

const typeLabel = (type?: string) => {
  if (type === RESELLER_DOMAIN_TYPE_SUBDOMAIN) return t('admin.resellerDomains.type.subdomain')
  if (type === RESELLER_DOMAIN_TYPE_CUSTOM) return t('admin.resellerDomains.type.custom')
  return type || '-'
}

const statusLabel = (status?: string) => {
  if (status === RESELLER_DOMAIN_STATUS_PENDING_REVIEW) return t('admin.resellerDomains.status.pendingReview')
  if (status === RESELLER_DOMAIN_STATUS_ACTIVE) return t('admin.resellerDomains.status.active')
  if (status === RESELLER_DOMAIN_STATUS_DISABLED) return t('admin.resellerDomains.status.disabled')
  return status || '-'
}

const statusClass = (status?: string) => {
  if (status === RESELLER_DOMAIN_STATUS_PENDING_REVIEW) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === RESELLER_DOMAIN_STATUS_ACTIVE) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === RESELLER_DOMAIN_STATUS_DISABLED) return 'border-zinc-200 bg-zinc-50 text-zinc-700'
  return 'border-border bg-muted/30 text-muted-foreground'
}

const verificationLabel = (status?: string) => {
  if (status === RESELLER_DOMAIN_VERIFICATION_PENDING) return t('admin.resellerDomains.verification.pending')
  if (status === RESELLER_DOMAIN_VERIFICATION_VERIFIED) return t('admin.resellerDomains.verification.verified')
  if (status === RESELLER_DOMAIN_VERIFICATION_FAILED) return t('admin.resellerDomains.verification.failed')
  return status || '-'
}

const verificationClass = (status?: string) => {
  if (status === RESELLER_DOMAIN_VERIFICATION_PENDING) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === RESELLER_DOMAIN_VERIFICATION_VERIFIED) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === RESELLER_DOMAIN_VERIFICATION_FAILED) return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-border bg-muted/30 text-muted-foreground'
}

const approveDomain = async (row: AdminResellerDomain) => {
  const confirmed = await confirmAction({ description: t('admin.resellerDomains.actions.approveConfirm', { id: row.id }) })
  if (!confirmed) return
  operatingId.value = row.id
  try {
    await adminAPI.approveResellerDomain(row.id)
    notifySuccess(t('admin.resellerDomains.actions.approveSuccess'))
    await fetchRows(pagination.value.page, { preserveRows: true })
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerDomains.actions.approveFailed'))
  } finally {
    operatingId.value = null
  }
}

const disableDomain = async (row: AdminResellerDomain) => {
  const confirmed = await confirmAction({ description: t('admin.resellerDomains.actions.disableConfirm', { id: row.id }), variant: 'destructive' })
  if (!confirmed) return
  operatingId.value = row.id
  try {
    await adminAPI.disableResellerDomain(row.id)
    notifySuccess(t('admin.resellerDomains.actions.disableSuccess'))
    await fetchRows(pagination.value.page, { preserveRows: true })
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerDomains.actions.disableFailed'))
  } finally {
    operatingId.value = null
  }
}

onMounted(() => {
  fetchRows()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.resellerDomains.title') }}</h1>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="w-full md:w-52">
          <Input v-model="filters.keyword" :placeholder="t('admin.resellerDomains.filters.keyword')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-32">
          <Input v-model="filters.resellerId" :placeholder="t('admin.resellerDomains.filters.resellerId')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-32">
          <Input v-model="filters.userId" :placeholder="t('admin.resellerDomains.filters.userId')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-52">
          <Input v-model="filters.domain" :placeholder="t('admin.resellerDomains.filters.domain')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-40">
          <Select v-model="filters.type" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.resellerDomains.filters.typeAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.resellerDomains.filters.typeAll') }}</SelectItem>
              <SelectItem :value="RESELLER_DOMAIN_TYPE_SUBDOMAIN">{{ t('admin.resellerDomains.type.subdomain') }}</SelectItem>
              <SelectItem :value="RESELLER_DOMAIN_TYPE_CUSTOM">{{ t('admin.resellerDomains.type.custom') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-full md:w-44">
          <Select v-model="filters.status" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.resellerDomains.filters.statusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.resellerDomains.filters.statusAll') }}</SelectItem>
              <SelectItem :value="RESELLER_DOMAIN_STATUS_PENDING_REVIEW">{{ t('admin.resellerDomains.status.pendingReview') }}</SelectItem>
              <SelectItem :value="RESELLER_DOMAIN_STATUS_ACTIVE">{{ t('admin.resellerDomains.status.active') }}</SelectItem>
              <SelectItem :value="RESELLER_DOMAIN_STATUS_DISABLED">{{ t('admin.resellerDomains.status.disabled') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-full md:w-44">
          <Select v-model="filters.verificationStatus" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.resellerDomains.filters.verificationAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.resellerDomains.filters.verificationAll') }}</SelectItem>
              <SelectItem :value="RESELLER_DOMAIN_VERIFICATION_PENDING">{{ t('admin.resellerDomains.verification.pending') }}</SelectItem>
              <SelectItem :value="RESELLER_DOMAIN_VERIFICATION_VERIFIED">{{ t('admin.resellerDomains.verification.verified') }}</SelectItem>
              <SelectItem :value="RESELLER_DOMAIN_VERIFICATION_FAILED">{{ t('admin.resellerDomains.verification.failed') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center">
          <span class="text-xs text-muted-foreground whitespace-nowrap">{{ t('admin.resellerDomains.filters.createdRange') }}</span>
          <Input v-model="filters.createdFrom" type="datetime-local" class="h-9 w-full md:w-auto" @update:modelValue="handleSearch" />
          <span class="hidden text-muted-foreground md:inline">-</span>
          <Input v-model="filters.createdTo" type="datetime-local" class="h-9 w-full md:w-auto" @update:modelValue="handleSearch" />
        </div>
        <div class="hidden flex-1 sm:block"></div>
        <Button size="sm" variant="outline" class="w-full sm:w-auto" :disabled="refreshing" @click="refreshCurrentPage">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[1100px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.resellerDomains.table.id') }}</TableHead>
            <TableHead class="min-w-[180px] px-6 py-3">{{ t('admin.resellerDomains.table.reseller') }}</TableHead>
            <TableHead class="min-w-[220px] px-6 py-3">{{ t('admin.resellerDomains.table.domain') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.resellerDomains.table.type') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.resellerDomains.table.verificationStatus') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.resellerDomains.table.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.resellerDomains.table.primary') }}</TableHead>
            <TableHead class="min-w-[140px] px-6 py-3">{{ t('admin.resellerDomains.table.verifiedAt') }}</TableHead>
            <TableHead class="min-w-[140px] px-6 py-3">{{ t('admin.resellerDomains.table.createdAt') }}</TableHead>
            <TableHead class="min-w-[140px] px-6 py-3 text-right">{{ t('admin.resellerDomains.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell :colspan="10" class="p-0">
              <TableSkeleton :columns="10" :rows="5" />
            </TableCell>
          </TableRow>
          <TableRow v-else-if="rows.length === 0">
            <TableCell colspan="10" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.resellerDomains.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="item in rows" :key="item.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="item.id" />
            </TableCell>
            <TableCell class="min-w-[180px] px-6 py-4 text-xs text-muted-foreground">
              <div class="text-foreground break-words">{{ item.profile?.user?.display_name || '-' }}</div>
              <div v-if="item.profile?.user?.email" class="mt-0.5 break-all">{{ item.profile.user.email }}</div>
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
                <span class="ml-1 font-mono text-muted-foreground">/ R#{{ item.reseller_id }}</span>
              </div>
            </TableCell>
            <TableCell class="min-w-[220px] px-6 py-4 font-mono text-xs break-all">{{ item.domain }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-foreground">{{ typeLabel(item.type) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="verificationClass(item.verification_status)">
                {{ verificationLabel(item.verification_status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(item.status)">
                {{ statusLabel(item.status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ item.is_primary ? t('admin.common.yes') : t('admin.common.no') }}</TableCell>
            <TableCell class="min-w-[140px] px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.verified_at) || '-' }}</TableCell>
            <TableCell class="min-w-[140px] px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.created_at) }}</TableCell>
            <TableCell class="min-w-[140px] px-6 py-4 text-right">
              <div class="flex flex-wrap items-center justify-end gap-2">
                <Button
                  size="sm"
                  :disabled="operatingId === item.id || !getResellerDomainActionState(item.status).canApprove"
                  @click="approveDomain(item)"
                >
                  {{ t('admin.resellerDomains.actions.approve') }}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="operatingId === item.id || !getResellerDomainActionState(item.status).canDisable"
                  @click="disableDomain(item)"
                >
                  {{ t('admin.resellerDomains.actions.disable') }}
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
</template>
