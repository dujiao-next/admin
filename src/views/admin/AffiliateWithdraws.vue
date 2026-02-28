<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import {
  AFFILIATE_WITHDRAW_STATUS_PAID,
  AFFILIATE_WITHDRAW_STATUS_PENDING_REVIEW,
  AFFILIATE_WITHDRAW_STATUS_REJECTED,
} from '@/constants/affiliate'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { confirmAction } from '@/utils/confirm'
import { notifyError, notifySuccess } from '@/utils/notify'
import { formatDate } from '@/utils/format'

const { t } = useI18n()
const loading = ref(true)
const operating = ref(false)
const rows = ref<any[]>([])
const jumpPage = ref('')
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})

const filters = reactive({
  keyword: '',
  affiliateProfileId: '',
  status: '__all__',
})

const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const fetchRows = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getAffiliateWithdraws({
      page,
      page_size: pagination.value.page_size,
      keyword: filters.keyword || undefined,
      affiliate_profile_id: filters.affiliateProfileId || undefined,
      status: normalizeFilterValue(filters.status) || undefined,
    })
    rows.value = (response.data.data as any[]) || []
    pagination.value = response.data.pagination || pagination.value
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchRows(1)
}

const refreshCurrentPage = () => {
  fetchRows(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchRows(page)
}

const jumpToPage = () => {
  if (!jumpPage.value) return
  const raw = Number(jumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), pagination.value.total_page)
  if (target === pagination.value.page) return
  changePage(target)
}

const statusLabel = (status?: string) => {
  if (status === AFFILIATE_WITHDRAW_STATUS_PENDING_REVIEW) return t('admin.affiliatesWithdraws.status.pendingReview')
  if (status === AFFILIATE_WITHDRAW_STATUS_REJECTED) return t('admin.affiliatesWithdraws.status.rejected')
  if (status === AFFILIATE_WITHDRAW_STATUS_PAID) return t('admin.affiliatesWithdraws.status.paid')
  return status || '-'
}

const statusClass = (status?: string) => {
  if (status === AFFILIATE_WITHDRAW_STATUS_PENDING_REVIEW) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === AFFILIATE_WITHDRAW_STATUS_REJECTED) return 'border-zinc-200 bg-zinc-50 text-zinc-700'
  if (status === AFFILIATE_WITHDRAW_STATUS_PAID) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-border bg-muted/30 text-muted-foreground'
}

const rejectWithdraw = async (row: any) => {
  const confirmed = await confirmAction({
    description: t('admin.affiliatesWithdraws.actions.rejectConfirm', { id: row.id }),
    variant: 'destructive',
  })
  if (!confirmed) return

  const reason = window.prompt(t('admin.affiliatesWithdraws.actions.rejectReasonPrompt')) ?? ''
  operating.value = true
  try {
    await adminAPI.rejectAffiliateWithdraw(row.id, { reason: reason.trim() || undefined })
    notifySuccess(t('admin.affiliatesWithdraws.actions.rejectSuccess'))
    await fetchRows(pagination.value.page)
  } catch (err: any) {
    notifyError(err?.message || t('admin.affiliatesWithdraws.actions.rejectFailed'))
  } finally {
    operating.value = false
  }
}

const payWithdraw = async (row: any) => {
  const confirmed = await confirmAction({ description: t('admin.affiliatesWithdraws.actions.payConfirm', { id: row.id }) })
  if (!confirmed) return
  operating.value = true
  try {
    await adminAPI.payAffiliateWithdraw(row.id)
    notifySuccess(t('admin.affiliatesWithdraws.actions.paySuccess'))
    await fetchRows(pagination.value.page)
  } catch (err: any) {
    notifyError(err?.message || t('admin.affiliatesWithdraws.actions.payFailed'))
  } finally {
    operating.value = false
  }
}

onMounted(() => {
  fetchRows()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.affiliatesWithdraws.title') }}</h1>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-56">
          <Input v-model="filters.keyword" :placeholder="t('admin.affiliatesWithdraws.filters.keyword')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-44">
          <Input v-model="filters.affiliateProfileId" :placeholder="t('admin.affiliatesWithdraws.filters.profileId')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-48">
          <Select v-model="filters.status" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.affiliatesWithdraws.filters.statusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.affiliatesWithdraws.filters.statusAll') }}</SelectItem>
              <SelectItem :value="AFFILIATE_WITHDRAW_STATUS_PENDING_REVIEW">{{ t('admin.affiliatesWithdraws.status.pendingReview') }}</SelectItem>
              <SelectItem :value="AFFILIATE_WITHDRAW_STATUS_REJECTED">{{ t('admin.affiliatesWithdraws.status.rejected') }}</SelectItem>
              <SelectItem :value="AFFILIATE_WITHDRAW_STATUS_PAID">{{ t('admin.affiliatesWithdraws.status.paid') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex-1"></div>
        <Button size="sm" variant="outline" @click="refreshCurrentPage">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesWithdraws.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesWithdraws.table.user') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesWithdraws.table.amount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesWithdraws.table.channel') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesWithdraws.table.account') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesWithdraws.table.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesWithdraws.table.rejectReason') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesWithdraws.table.processedBy') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesWithdraws.table.createdAt') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.affiliatesWithdraws.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="10" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="rows.length === 0">
            <TableCell colspan="10" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.affiliatesWithdraws.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="item in rows" :key="item.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="item.id" />
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div class="text-foreground">
                {{ item?.affiliate_profile?.user?.display_name || '-' }}
              </div>
              <div v-if="item?.affiliate_profile?.user?.email" class="mt-0.5">{{ item.affiliate_profile.user.email }}</div>
              <div class="mt-0.5 font-mono">#{{ item?.affiliate_profile?.id || '-' }} / {{ item?.affiliate_profile?.code || '-' }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ item.amount || '0.00' }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-foreground">{{ item.channel || '-' }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground break-all">{{ item.account || '-' }}</TableCell>
            <TableCell class="px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(item.status)">
                {{ statusLabel(item.status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ item.reject_reason || '-' }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div>{{ item?.processor?.username || '-' }}</div>
              <div class="mt-0.5">{{ formatDate(item.processed_at) || '-' }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.created_at) }}</TableCell>
            <TableCell class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="operating || item.status !== AFFILIATE_WITHDRAW_STATUS_PENDING_REVIEW"
                  @click="rejectWithdraw(item)"
                >
                  {{ t('admin.affiliatesWithdraws.actions.reject') }}
                </Button>
                <Button
                  size="sm"
                  :disabled="operating || item.status !== AFFILIATE_WITHDRAW_STATUS_PENDING_REVIEW"
                  @click="payWithdraw(item)"
                >
                  {{ t('admin.affiliatesWithdraws.actions.pay') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div v-if="pagination.total_page > 1" class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
        <span class="text-xs text-muted-foreground">
          {{ t('admin.common.pageInfo', { total: pagination.total, page: pagination.page, totalPage: pagination.total_page }) }}
        </span>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2">
            <Input
              v-model="jumpPage"
              type="number"
              min="1"
              :max="pagination.total_page"
              class="h-8 w-20"
              :placeholder="t('admin.common.jumpPlaceholder')"
            />
            <Button variant="outline" size="sm" class="h-8" @click="jumpToPage">
              {{ t('admin.common.jumpTo') }}
            </Button>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" class="h-8" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">
              {{ t('admin.common.prevPage') }}
            </Button>
            <Button variant="outline" size="sm" class="h-8" :disabled="pagination.page >= pagination.total_page" @click="changePage(pagination.page + 1)">
              {{ t('admin.common.nextPage') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
