<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminAffiliateCommission } from '@/api/types'
import {
  AFFILIATE_COMMISSION_STATUS_AVAILABLE,
  AFFILIATE_COMMISSION_STATUS_PENDING_CONFIRM,
  AFFILIATE_COMMISSION_STATUS_REJECTED,
  AFFILIATE_COMMISSION_STATUS_WITHDRAWN,
} from '@/constants/affiliate'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import ListPagination from '@/components/ListPagination.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/utils/format'

const { t } = useI18n()
const loading = ref(true)
const rows = ref<AdminAffiliateCommission[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const adminPath = import.meta.env.VITE_ADMIN_PATH || ''

const filters = reactive({
  keyword: '',
  orderNo: '',
  affiliateProfileId: '',
  status: '__all__',
})

const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)
const userDetailLink = (userId: number) => `${adminPath}/users/${userId}`
const resolveAffiliateUserID = (item: AdminAffiliateCommission) => Number(item?.affiliate_profile?.user_id || item?.affiliate_profile?.user?.id || 0)

const fetchRows = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getAffiliateCommissions({
      page,
      page_size: pagination.value.page_size,
      keyword: filters.keyword || undefined,
      order_no: filters.orderNo || undefined,
      affiliate_profile_id: filters.affiliateProfileId || undefined,
      status: normalizeFilterValue(filters.status) || undefined,
    })
    rows.value = response.data.data || []
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
const debouncedSearch = useDebounceFn(handleSearch, 300)

const refreshCurrentPage = () => {
  fetchRows(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchRows(page)
}

const pageSizeOptions = [10, 20, 50, 100]

const changePageSize = (size: number) => {
  if (size === pagination.value.page_size) return
  pagination.value.page_size = size
  fetchRows(1)
}

const statusLabel = (status?: string) => {
  if (status === AFFILIATE_COMMISSION_STATUS_PENDING_CONFIRM) return t('admin.affiliatesCommissions.status.pendingConfirm')
  if (status === AFFILIATE_COMMISSION_STATUS_AVAILABLE) return t('admin.affiliatesCommissions.status.available')
  if (status === AFFILIATE_COMMISSION_STATUS_REJECTED) return t('admin.affiliatesCommissions.status.rejected')
  if (status === AFFILIATE_COMMISSION_STATUS_WITHDRAWN) return t('admin.affiliatesCommissions.status.withdrawn')
  return status || '-'
}

const statusClass = (status?: string) => {
  if (status === AFFILIATE_COMMISSION_STATUS_PENDING_CONFIRM) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === AFFILIATE_COMMISSION_STATUS_AVAILABLE) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === AFFILIATE_COMMISSION_STATUS_REJECTED) return 'border-zinc-200 bg-zinc-50 text-zinc-700'
  if (status === AFFILIATE_COMMISSION_STATUS_WITHDRAWN) return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-border bg-muted/30 text-muted-foreground'
}

onMounted(() => {
  fetchRows()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.affiliatesCommissions.title') }}</h1>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-56">
          <Input v-model="filters.keyword" :placeholder="t('admin.affiliatesCommissions.filters.keyword')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-52">
          <Input v-model="filters.orderNo" :placeholder="t('admin.affiliatesCommissions.filters.orderNo')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-44">
          <Input v-model="filters.affiliateProfileId" :placeholder="t('admin.affiliatesCommissions.filters.profileId')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-48">
          <Select v-model="filters.status" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.affiliatesCommissions.filters.statusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.affiliatesCommissions.filters.statusAll') }}</SelectItem>
              <SelectItem :value="AFFILIATE_COMMISSION_STATUS_PENDING_CONFIRM">{{ t('admin.affiliatesCommissions.status.pendingConfirm') }}</SelectItem>
              <SelectItem :value="AFFILIATE_COMMISSION_STATUS_AVAILABLE">{{ t('admin.affiliatesCommissions.status.available') }}</SelectItem>
              <SelectItem :value="AFFILIATE_COMMISSION_STATUS_REJECTED">{{ t('admin.affiliatesCommissions.status.rejected') }}</SelectItem>
              <SelectItem :value="AFFILIATE_COMMISSION_STATUS_WITHDRAWN">{{ t('admin.affiliatesCommissions.status.withdrawn') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex-1"></div>
        <Button size="sm" variant="outline" @click="refreshCurrentPage">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[1000px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesCommissions.table.id') }}</TableHead>
            <TableHead class="min-w-[160px] px-6 py-3">{{ t('admin.affiliatesCommissions.table.user') }}</TableHead>
            <TableHead class="min-w-[160px] px-6 py-3">{{ t('admin.affiliatesCommissions.table.orderNo') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesCommissions.table.baseAmount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesCommissions.table.rate') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesCommissions.table.commission') }}</TableHead>
            <TableHead class="min-w-[90px] px-6 py-3">{{ t('admin.affiliatesCommissions.table.status') }}</TableHead>
            <TableHead class="min-w-[140px] px-6 py-3">{{ t('admin.affiliatesCommissions.table.confirmAt') }}</TableHead>
            <TableHead class="min-w-[140px] px-6 py-3">{{ t('admin.affiliatesCommissions.table.availableAt') }}</TableHead>
            <TableHead class="min-w-[140px] px-6 py-3">{{ t('admin.affiliatesCommissions.table.createdAt') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell :colspan="10" class="p-0">
              <TableSkeleton :columns="10" :rows="5" />
            </TableCell>
          </TableRow>
          <TableRow v-else-if="rows.length === 0">
            <TableCell colspan="10" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.affiliatesCommissions.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="item in rows" :key="item.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="item.id" />
            </TableCell>
            <TableCell class="min-w-[160px] px-6 py-4 text-xs text-muted-foreground">
              <div class="text-foreground">
                <span class="break-words">{{ item?.affiliate_profile?.user?.display_name || '-' }}</span>
              </div>
              <div v-if="item?.affiliate_profile?.user?.email" class="mt-0.5 break-all">{{ item.affiliate_profile.user.email }}</div>
              <div class="mt-0.5 break-all">
                <a
                  v-if="resolveAffiliateUserID(item) > 0"
                  :href="userDetailLink(resolveAffiliateUserID(item))"
                  target="_blank"
                  rel="noopener"
                  class="font-mono text-primary underline-offset-4 hover:underline"
                >
                  #{{ resolveAffiliateUserID(item) }}
                </a>
                <span v-else class="font-mono text-foreground">-</span>
                <span class="ml-1 font-mono text-muted-foreground">/ {{ item?.affiliate_profile?.code || '-' }}</span>
              </div>
            </TableCell>
            <TableCell class="min-w-[160px] px-6 py-4 font-mono text-xs text-foreground break-all">
              {{ item?.order?.order_no || '-' }}
            </TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ item.base_amount || '0.00' }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ item.rate_percent || '0.00' }}%</TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ item.commission_amount || '0.00' }}</TableCell>
            <TableCell class="min-w-[90px] px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(item.status)">
                {{ statusLabel(item.status) }}
              </span>
            </TableCell>
            <TableCell class="min-w-[140px] px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.confirm_at) || '-' }}</TableCell>
            <TableCell class="min-w-[140px] px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.available_at) || '-' }}</TableCell>
            <TableCell class="min-w-[140px] px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.created_at) }}</TableCell>
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
