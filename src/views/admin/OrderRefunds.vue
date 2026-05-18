<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminOrderRefund } from '@/api/types'
import IdCell from '@/components/IdCell.vue'
import OrderRefundsDialog from './components/OrderRefundsDialog.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import ListPagination from '@/components/ListPagination.vue'
import { formatDate, getLocalizedText, toRFC3339 } from '@/utils/format'
import { formatSkuDisplayLabel } from '@/utils/sku'

const loading = ref(true)
const refunds = ref<AdminOrderRefund[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const adminPath = import.meta.env.VITE_ADMIN_PATH || ''
const route = useRoute()
const { t, locale } = useI18n()

const entrySkuLabel = (entry: Record<string, unknown>) =>
  formatSkuDisplayLabel(entry?.sku_snapshot, locale.value)

const filters = reactive({
  userId: '',
  userKeyword: '',
  orderNo: '',
  guestEmail: '',
  productKeyword: '',
  createdFrom: '',
  createdTo: '',
})

const showDetail = ref(false)
const selectedRefundId = ref<number | null>(null)

const orderLink = (orderId?: number) => {
  if (!orderId) return ''
  return `${adminPath}/orders?order_id=${orderId}`
}
const userDetailLink = (userId: number) => `${adminPath}/users/${userId}`

const refundTypeLabel = (item: AdminOrderRefund | null) => {
  if (!item) return '-'
  const code = String(item.refund_type_label || item.type || '').trim().toLowerCase()
  if (code === 'wallet') return t('admin.orderRefunds.typeWallet')
  if (code === 'manual') return t('admin.orderRefunds.typeManual')
  return code || '-'
}

const fetchRefunds = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getOrderRefunds({
      page,
      page_size: pagination.value.page_size,
      user_id: filters.userId || undefined,
      user_keyword: filters.userKeyword || undefined,
      order_no: filters.orderNo || undefined,
      guest_email: filters.guestEmail || undefined,
      product_keyword: filters.productKeyword || undefined,
      created_from: toRFC3339(filters.createdFrom),
      created_to: toRFC3339(filters.createdTo),
    })
    refunds.value = response.data.data || []
    pagination.value = response.data.pagination || pagination.value
  } catch {
    refunds.value = []
    pagination.value = { page: 1, page_size: pagination.value.page_size, total: 0, total_page: 0 }
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchRefunds(1)
}
const debouncedSearch = useDebounceFn(handleSearch, 300)

const refresh = () => {
  fetchRefunds(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchRefunds(page)
}

const pageSizeOptions = [10, 20, 50, 100]

const changePageSize = (size: number) => {
  if (size === pagination.value.page_size) return
  pagination.value.page_size = size
  fetchRefunds(1)
}

const openDetail = (refund: { id: number }) => {
  if (!refund.id) return
  selectedRefundId.value = refund.id
  showDetail.value = true
}

const openDetailById = (refundId: number) => {
  if (!refundId || refundId <= 0) return
  openDetail({ id: refundId })
}

const handleDialogOpenChange = (value: boolean) => {
  showDetail.value = value
  if (!value) {
    selectedRefundId.value = null
  }
}

onMounted(() => {
  if (route.query.user_id) {
    filters.userId = String(route.query.user_id || '')
  }
  fetchRefunds()
  const refundId = Number(route.query.refund_id)
  if (Number.isFinite(refundId) && refundId > 0) {
    openDetailById(refundId)
  }
})

watch(
  () => route.query.user_id,
  (value) => {
    if (value !== undefined) {
      filters.userId = String(value || '')
      fetchRefunds(1)
    }
  }
)

watch(
  () => route.query.refund_id,
  (value) => {
    const refundId = Number(value)
    if (Number.isFinite(refundId) && refundId > 0) {
      openDetailById(refundId)
    }
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.orderRefunds.title') }}</h1>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="w-full md:w-32">
          <Input v-model="filters.userId" :placeholder="t('admin.orderRefunds.filterUserId')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-56">
          <Input v-model="filters.userKeyword" :placeholder="t('admin.orderRefunds.filterUserKeyword')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-48">
          <Input v-model="filters.orderNo" :placeholder="t('admin.orderRefunds.filterOrderNo')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-48">
          <Input v-model="filters.guestEmail" :placeholder="t('admin.orderRefunds.filterGuestEmail')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-48">
          <Input v-model="filters.productKeyword" :placeholder="t('admin.orderRefunds.filterProductKeyword')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center">
          <span class="text-xs text-muted-foreground whitespace-nowrap">{{ t('admin.orderRefunds.filterCreatedRange') }}</span>
          <Input
            v-model="filters.createdFrom"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            :placeholder="t('admin.orderRefunds.filterCreatedFrom')"
            @update:modelValue="handleSearch"
          />
          <span class="hidden text-muted-foreground md:inline">-</span>
          <Input
            v-model="filters.createdTo"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            :placeholder="t('admin.orderRefunds.filterCreatedTo')"
            @update:modelValue="handleSearch"
          />
        </div>
        <div class="hidden flex-1 sm:block"></div>
        <Button size="sm" class="w-full sm:w-auto" @click="refresh">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[880px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.orderRefunds.table.id') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[140px]">{{ t('admin.orderRefunds.table.orderId') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[200px]">{{ t('admin.orderRefunds.table.productInfo') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[180px]">{{ t('admin.orderRefunds.table.user') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.orderRefunds.table.refundType') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.orderRefunds.table.amount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.orderRefunds.table.createdAt') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[90px] text-right">{{ t('admin.orderRefunds.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell :colspan="8" class="p-0">
              <TableSkeleton :columns="8" :rows="5" />
            </TableCell>
          </TableRow>
          <TableRow v-else-if="refunds.length === 0">
            <TableCell colspan="8" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.orderRefunds.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="item in refunds" :key="item.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="item.id" />
            </TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs">
              <a v-if="item.order_id" :href="orderLink(item.order_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                #{{ item.order_id }}
              </a>
              <span v-else>-</span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-foreground">
              <div v-if="item.items && item.items.length > 0" class="space-y-1">
                <div v-for="entry in item.items" :key="entry.id" class="text-xs">
                  <span class="text-foreground">{{ getLocalizedText((entry as any).title) || '-' }}</span>
                  <span v-if="entrySkuLabel(entry as any)" class="ml-1 text-muted-foreground">
                    ({{ entrySkuLabel(entry as any) }})
                  </span>
                  <span class="ml-1 text-muted-foreground">x{{ entry.quantity }}</span>
                </div>
              </div>
              <span v-else class="text-xs text-muted-foreground">-</span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div v-if="item.guest_email" class="break-all">{{ t('admin.orderRefunds.guestLabel') }}: {{ item.guest_email }}</div>
              <div v-else-if="item.user_id">
                <div class="break-words text-foreground">{{ item.user_display_name || '-' }}</div>
                <div class="break-all">{{ item.user_email || '-' }}</div>
                <div class="mt-0.5">
                  <a
                    :href="userDetailLink(item.user_id)"
                    target="_blank"
                    rel="noopener"
                    class="text-primary underline-offset-4 hover:underline"
                  >
                    #{{ item.user_id }}
                  </a>
                </div>
              </div>
              <div v-else>-</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-foreground">
              {{ refundTypeLabel(item) }}
            </TableCell>
            <TableCell class="px-6 py-4 font-mono text-foreground">
              {{ item.amount }} {{ item.currency }}
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              {{ formatDate(item.created_at) }}
            </TableCell>
            <TableCell class="px-6 py-4 text-right">
              <Button size="sm" variant="outline" @click="openDetail(item)">
                {{ t('admin.orderRefunds.view') }}
              </Button>
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

    <OrderRefundsDialog
      :model-value="showDetail"
      :refund-id="selectedRefundId"
      @update:model-value="handleDialogOpenChange"
    />
  </div>
</template>

<style scoped>
.break-all {
  word-break: break-all;
  overflow-wrap: break-word;
}
</style>
