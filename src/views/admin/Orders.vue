<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Package } from 'lucide-vue-next'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  orderStatusClass,
  orderStatusLabel,
  paymentStatusClass as paymentStatusClassMap,
  paymentStatusLabel as paymentStatusLabelMap,
} from '@/utils/status'
import {
  fulfillmentStatusLabel as fulfillmentStatusLabelMap,
  fulfillmentTypeLabel as fulfillmentTypeLabelMap,
} from '@/utils/fulfillment'
import { formatDate, formatMoney, getLocalizedText, hasPositiveAmount, toRFC3339 } from '@/utils/format'
import { resolveSkuCodeFromSnapshot, resolveSkuSpecFromSnapshot } from '@/utils/sku'

const loading = ref(true)
const orders = ref<any[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const jumpPage = ref('')
const filters = reactive({
  orderNo: '',
  guestEmail: '',
  createdFrom: '',
  createdTo: '',
  status: '',
  userId: '',
})
const statusEdits = reactive<Record<number, string>>({})
const showDetail = ref(false)
const showFulfillmentModal = ref(false)
const selectedOrder = ref<any>(null)
const detailLoading = ref(false)
const detailError = ref('')
const fulfillmentParentId = ref<number | null>(null)
const route = useRoute()
const fulfillmentSubmitting = ref(false)
const fulfillmentError = ref('')
const fulfillmentSuccess = ref('')
const refundSubmitting = ref(false)
const refundError = ref('')
const refundSuccess = ref('')
const refundForm = reactive({
  amount: '',
  remark: '',
})
const fulfillmentForm = reactive({
  payload: '',
  note: '',
  entries: [] as Array<{ key: string; value: string }>,
})
const adminPath = import.meta.env.VITE_ADMIN_PATH || ''
const { t, locale } = useI18n()

const userDetailLink = (userId: number) => `${adminPath}/users/${userId}`
const productLink = (productId: number) => `${adminPath}/products?product_id=${productId}`
const couponCodeLink = (code: string) => `${adminPath}/coupons?code=${encodeURIComponent(code)}`
const promotionLink = (promotionId: number) => `${adminPath}/promotions?id=${promotionId}`
const paymentLink = (paymentId: number) => `${adminPath}/payments?payment_id=${paymentId}`

const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const toQueryText = (value: unknown) => {
  if (Array.isArray(value)) return String(value[0] || '').trim()
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

const fetchOrders = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getOrders({
      page,
      page_size: pagination.value.page_size,
      status: normalizeFilterValue(filters.status) || undefined,
      user_id: filters.userId || undefined,
      order_no: filters.orderNo || undefined,
      guest_email: filters.guestEmail || undefined,
      created_from: toRFC3339(filters.createdFrom),
      created_to: toRFC3339(filters.createdTo),
    })
    orders.value = (response.data.data as any[]) || []
    pagination.value = response.data.pagination || pagination.value
    orders.value.forEach((order) => {
      statusEdits[order.id] = order.status
    })
  } catch (error) {
    orders.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchOrders(1)
}

const refresh = () => {
  fetchOrders(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchOrders(page)
}

const jumpToPage = () => {
  if (!jumpPage.value) return
  const raw = Number(jumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), pagination.value.total_page)
  if (target === pagination.value.page) return
  changePage(target)
}

const canUpdateStatus = (order: any) => {
  if (!order) return false
  return order.status !== 'completed' && order.status !== 'canceled'
}

const updateStatus = async (order: any) => {
  if (!canUpdateStatus(order)) return
  const status = statusEdits[order.id]
  if (!status || status === order.status) return
  await adminAPI.updateOrderStatus(order.id, { status })
  fetchOrders(pagination.value.page)
}

const markCompleted = async (order: any) => {
  if (!order || order.status !== 'delivered') return
  await adminAPI.updateOrderStatus(order.id, { status: 'completed' })
  fetchOrders(pagination.value.page)
}

const fetchOrderDetail = async (orderId: number) => {
  detailLoading.value = true
  detailError.value = ''
  selectedOrder.value = null
  try {
    const response = await adminAPI.getOrder(orderId)
    selectedOrder.value = response.data.data
  } catch (err: any) {
    detailError.value = err?.message || t('admin.orders.detailFetchFailed')
  } finally {
    detailLoading.value = false
  }
}

const openDetail = async (order: any) => {
  showFulfillmentModal.value = false
  showDetail.value = true
  resetFulfillmentForm()
  resetRefundForm()
  await fetchOrderDetail(order.id)
}

const openDetailById = async (orderId: number) => {
  if (!orderId || orderId <= 0) return
  showFulfillmentModal.value = false
  showDetail.value = true
  resetFulfillmentForm()
  resetRefundForm()
  await fetchOrderDetail(orderId)
}

const openFulfillment = async (order: any, parentId?: number) => {
  showDetail.value = false
  showFulfillmentModal.value = true
  fulfillmentParentId.value = parentId || null
  resetFulfillmentForm()
  await fetchOrderDetail(order.id)
}

const closeDetail = () => {
  showDetail.value = false
  selectedOrder.value = null
  detailError.value = ''
  resetFulfillmentForm()
  resetRefundForm()
}

const closeFulfillment = () => {
  showFulfillmentModal.value = false
  selectedOrder.value = null
  detailError.value = ''
  resetFulfillmentForm()
  fulfillmentParentId.value = null
}

const statusLabel = (status: string) => orderStatusLabel(t, status)

const providerTypeLabel = (value?: string) => {
  const map: Record<string, string> = {
    official: t('admin.paymentChannels.providerTypes.official'),
    epay: t('admin.paymentChannels.providerTypes.epay'),
    epusdt: t('admin.paymentChannels.providerTypes.epusdt'),
    tokenpay: t('admin.paymentChannels.providerTypes.tokenpay'),
    wallet: t('admin.paymentChannels.providerTypes.wallet'),
  }
  if (!value) return '-'
  return map[value] || value
}

const channelTypeLabel = (value?: string) => {
  const map: Record<string, string> = {
    wechat: t('admin.paymentChannels.channelTypes.wechat'),
    alipay: t('admin.paymentChannels.channelTypes.alipay'),
    qqpay: t('admin.paymentChannels.channelTypes.qqpay'),
    paypal: t('admin.paymentChannels.channelTypes.paypal'),
    stripe: t('admin.paymentChannels.channelTypes.stripe'),
    usdt: t('admin.paymentChannels.channelTypes.usdt'),
    'usdt-trc20': t('admin.paymentChannels.channelTypes.usdtTrc20'),
    'usdc-trc20': t('admin.paymentChannels.channelTypes.usdcTrc20'),
    trx: t('admin.paymentChannels.channelTypes.trx'),
    balance: t('admin.paymentChannels.channelTypes.balance'),
  }
  if (!value) return '-'
  return map[value] || value
}

const paymentStatusLabel = (status: string) => paymentStatusLabelMap(t, status)

const paymentStatusClass = (status: string) => paymentStatusClassMap(status)

const hasWalletPayment = (order: any) => hasPositiveAmount(order?.wallet_paid_amount)

const hasOnlinePayment = (order: any) => hasPositiveAmount(order?.online_paid_amount)

const orderPaymentMethodLabel = (order: any) => {
  if (hasWalletPayment(order) && hasOnlinePayment(order)) {
    return t('admin.orders.paymentMethodMixed')
  }
  if (hasWalletPayment(order)) {
    return t('admin.orders.paymentMethodWalletOnly')
  }
  if (hasOnlinePayment(order)) {
    return t('admin.orders.paymentMethodOnlineOnly')
  }
  return t('admin.orders.paymentMethodUnknown')
}

const canCreateFulfillment = (order: any) => {
  if (!order) return false
  if (order.fulfillment) return false
  if (order.parent_id == null && Array.isArray(order.children) && order.children.length > 0) return false
  if (Array.isArray(order.items) && order.items.length > 0 && !order.items.every((item: any) => item.fulfillment_type === 'manual')) {
    return false
  }
  return order.status === 'paid' || order.status === 'fulfilling'
}

const canCreateChildFulfillment = (order: any) => {
  if (!canCreateFulfillment(order)) return false
  if (!order || !order.items || !order.items.length) return false
  return order.items.every((item: any) => item.fulfillment_type === 'manual')
}

const createEmptyDeliveryEntry = () => ({ key: '', value: '' })

const addDeliveryEntry = () => {
  fulfillmentForm.entries.push(createEmptyDeliveryEntry())
}

const removeDeliveryEntry = (index: number) => {
  fulfillmentForm.entries.splice(index, 1)
}

const buildDeliveryDataPayload = () => {
  const note = String(fulfillmentForm.note || '').trim()
  const entries = fulfillmentForm.entries
    .map((item) => ({
      key: String(item.key || '').trim(),
      value: String(item.value || '').trim(),
    }))
    .filter((item) => item.key || item.value)

  const payload: Record<string, any> = {}
  if (note) {
    payload.note = note
  }
  if (entries.length) {
    payload.entries = entries
  }
  return payload
}

const hasFulfillmentSubmitData = () => {
  const payloadText = String(fulfillmentForm.payload || '').trim()
  if (payloadText) return true
  const data = buildDeliveryDataPayload()
  return Boolean(data.note || (Array.isArray(data.entries) && data.entries.length > 0))
}

const formatManualValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(', ')
  }
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

const manualSubmissionRows = (submission: any) => {
  if (!submission || typeof submission !== 'object') return []
  return Object.entries(submission)
    .filter(([key]) => String(key).trim() !== '')
    .map(([key, value]) => ({
      key: String(key),
      value: formatManualValue(value),
    }))
}

const parseOrderItemSkuId = (item: any) => {
  const value = Number(item?.sku_id || item?.sku_snapshot?.sku_id || 0)
  if (!Number.isFinite(value)) return 0
  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : 0
}

const orderItemSkuCodeText = (item: any) => {
  const code = resolveSkuCodeFromSnapshot(item?.sku_snapshot, {
    defaultLabel: t('admin.orders.itemSkuDefaultCode'),
  })
  if (code) return code
  const skuId = parseOrderItemSkuId(item)
  if (skuId > 0) return `#${skuId}`
  return t('admin.orders.itemSkuUnknown')
}

const orderItemSkuSpecText = (item: any) => {
  const specText = resolveSkuSpecFromSnapshot(item?.sku_snapshot, locale.value)
  if (specText) return specText
  return t('admin.orders.itemSkuSpecEmpty')
}

const fulfillmentDeliveryLines = (fulfillment: any) => {
  const lines: string[] = []
  const logistics = fulfillment?.delivery_data || fulfillment?.logistics
  if (logistics && typeof logistics === 'object') {
    const note = String(logistics.note || '').trim()
    if (note) {
      lines.push(note)
    }
    const entries = Array.isArray(logistics.entries) ? logistics.entries : []
    entries.forEach((item: any) => {
      const key = String(item?.key || '').trim()
      const value = String(item?.value || '').trim()
      if (!key && !value) {
        return
      }
      if (!key) {
        lines.push(value)
      } else if (!value) {
        lines.push(key)
      } else {
        lines.push(`${key}: ${value}`)
      }
    })

    Object.entries(logistics).forEach(([key, value]) => {
      if (key === 'note' || key === 'entries') return
      const text = String(value ?? '').trim()
      if (!text) return
      lines.push(`${key}: ${text}`)
    })
  }
  return lines
}

const resetFulfillmentForm = () => {
  fulfillmentForm.payload = ''
  fulfillmentForm.note = ''
  fulfillmentForm.entries = [createEmptyDeliveryEntry()]
  fulfillmentError.value = ''
  fulfillmentSuccess.value = ''
}

const resetRefundForm = () => {
  refundForm.amount = ''
  refundForm.remark = ''
  refundError.value = ''
  refundSuccess.value = ''
}

const parseMoneyValue = (value?: string) => {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return 0
  return parsed
}

const isPaidOrder = (order: any) => {
  if (!order) return false
  return Boolean(order.paid_at)
}

const refundableAmountValue = (order: any) => {
  if (!order) return 0
  if (!isPaidOrder(order)) return 0
  const total = parseMoneyValue(order.total_amount)
  const refunded = parseMoneyValue(order.refunded_amount)
  const value = total - refunded
  if (!Number.isFinite(value)) return 0
  return Number(Math.max(value, 0).toFixed(2))
}

const refundableAmountDisplay = (order: any) => formatMoney(refundableAmountValue(order).toFixed(2), order?.currency)

const canRefundToWallet = (order: any) => {
  if (!order) return false
  if (!order.user_id) return false
  if (!isPaidOrder(order)) return false
  return refundableAmountValue(order) > 0
}

const submitFulfillment = async () => {
  if (!selectedOrder.value) return
  fulfillmentError.value = ''
  fulfillmentSuccess.value = ''
  if (!hasFulfillmentSubmitData()) {
    fulfillmentError.value = t('admin.orders.fulfillmentSubmitRequired')
    return
  }
  fulfillmentSubmitting.value = true
  try {
    await adminAPI.createFulfillment({
      order_id: Number(selectedOrder.value.id),
      payload: String(fulfillmentForm.payload || '').trim(),
      delivery_data: buildDeliveryDataPayload(),
    })
    fulfillmentSuccess.value = t('admin.orders.fulfillmentSuccess')
    const parentId = fulfillmentParentId.value
    if (parentId) {
      showFulfillmentModal.value = false
      fulfillmentParentId.value = null
      showDetail.value = true
      await fetchOrderDetail(parentId)
    } else {
      await fetchOrderDetail(selectedOrder.value.id)
    }
    fetchOrders(pagination.value.page)
  } catch (err: any) {
    fulfillmentError.value = err?.message || t('admin.orders.fulfillmentFailed')
  } finally {
    fulfillmentSubmitting.value = false
  }
}

const submitRefundToWallet = async () => {
  if (!selectedOrder.value) return
  refundError.value = ''
  refundSuccess.value = ''
  if (!canRefundToWallet(selectedOrder.value)) {
    refundError.value = t('admin.orders.refundNoRemaining')
    return
  }
  const amount = refundForm.amount.trim()
  const value = Number(amount)
  if (!amount || Number.isNaN(value) || value <= 0) {
    refundError.value = t('admin.orders.refundInvalidAmount')
    return
  }
  if (value > refundableAmountValue(selectedOrder.value)) {
    refundError.value = t('admin.orders.refundExceeded')
    return
  }

  refundSubmitting.value = true
  try {
    await adminAPI.refundOrderToWallet(Number(selectedOrder.value.id), {
      amount,
      remark: refundForm.remark.trim() || undefined,
    })
    refundSuccess.value = t('admin.orders.refundSuccess')
    refundForm.amount = ''
    refundForm.remark = ''
    await fetchOrderDetail(Number(selectedOrder.value.id))
    fetchOrders(pagination.value.page)
  } catch (err: any) {
    refundError.value = err?.message || t('admin.orders.refundFailed')
  } finally {
    refundSubmitting.value = false
  }
}

const fulfillmentTypeLabel = (type: string) => fulfillmentTypeLabelMap(t, type, 'admin.orders')

const fulfillmentStatusLabel = (status: string) => fulfillmentStatusLabelMap(t, status, 'admin.orders')

const statusClass = (status: string) => orderStatusClass(status)

onMounted(() => {
  const initialUserId = toQueryText(route.query.user_id)
  filters.userId = initialUserId

  fetchOrders()

  const orderId = Number(route.query.order_id)
  if (Number.isFinite(orderId) && orderId > 0) {
    openDetailById(orderId)
  }
})

watch(
  () => route.query.order_id,
  (value) => {
    const orderId = Number(value)
    if (Number.isFinite(orderId) && orderId > 0) {
      openDetailById(orderId)
    }
  }
)

watch(
  () => route.query.user_id,
  (value) => {
    filters.userId = toQueryText(value)
    fetchOrders(1)
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ t('admin.orders.title') }}</h1>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-32">
          <Input v-model="filters.userId" :placeholder="t('admin.orders.filterUserId')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-48">
          <Input v-model="filters.orderNo" :placeholder="t('admin.orders.filterOrderNo')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-48">
          <Input v-model="filters.guestEmail" :placeholder="t('admin.orders.filterGuestEmail')" @update:modelValue="handleSearch" />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-muted-foreground whitespace-nowrap">{{ t('admin.orders.filterCreatedRange') }}</span>
          <Input
            v-model="filters.createdFrom"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            :placeholder="t('admin.orders.filterCreatedFrom')"
            @update:modelValue="handleSearch"
          />
          <span class="text-muted-foreground">-</span>
          <Input
            v-model="filters.createdTo"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            :placeholder="t('admin.orders.filterCreatedTo')"
            @update:modelValue="handleSearch"
          />
        </div>
        <div class="w-full md:w-40">
          <Select v-model="filters.status" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.orders.filterStatusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.orders.filterStatusAll') }}</SelectItem>
              <SelectItem value="pending_payment">{{ t('order.status.pending_payment') }}</SelectItem>
              <SelectItem value="paid">{{ t('order.status.paid') }}</SelectItem>
              <SelectItem value="fulfilling">{{ t('order.status.fulfilling') }}</SelectItem>
              <SelectItem value="partially_delivered">{{ t('order.status.partially_delivered') }}</SelectItem>
              <SelectItem value="delivered">{{ t('order.status.delivered') }}</SelectItem>
              <SelectItem value="completed">{{ t('order.status.completed') }}</SelectItem>
              <SelectItem value="canceled">{{ t('order.status.canceled') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex-1"></div>
        <Button size="sm" @click="refresh">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.orders.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.orders.table.orderNo') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.orders.table.user') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.orders.table.ip') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.orders.table.amount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.orders.table.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.orders.table.createdAt') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.orders.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="8" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="orders.length === 0">
            <TableCell colspan="8" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.orders.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="order in orders" :key="order.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="order.id" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <div class="font-medium text-foreground">{{ order.order_no }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div v-if="order.user_id">
                <div class="text-foreground">{{ order.user_display_name || '-' }}</div>
                <div class="text-muted-foreground">{{ order.user_email || '-' }}</div>
                <div class="mt-1">
                  {{ t('admin.orders.userLabel') }}:
                  <a :href="userDetailLink(order.user_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                    #{{ order.user_id }}
                  </a>
                </div>
              </div>
              <div v-else>{{ t('admin.orders.guestLabel') }}: {{ order.guest_email || '-' }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ order.client_ip || '-' }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-foreground">{{ formatMoney(order.total_amount, order.currency) }}</TableCell>
            <TableCell class="px-6 py-4">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(order.status)">
                {{ statusLabel(order.status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(order.created_at) }}</TableCell>
            <TableCell class="px-6 py-4">
              <div class="flex flex-wrap items-center justify-end gap-2">
                <Select v-if="canUpdateStatus(order)" v-model="statusEdits[order.id]">
                  <SelectTrigger class="h-8 w-[150px] text-xs">
                    <SelectValue :placeholder="t('admin.orders.filterStatusAll')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending_payment">{{ t('order.status.pending_payment') }}</SelectItem>
                    <SelectItem value="paid">{{ t('order.status.paid') }}</SelectItem>
                    <SelectItem value="fulfilling">{{ t('order.status.fulfilling') }}</SelectItem>
                    <SelectItem value="delivered">{{ t('order.status.delivered') }}</SelectItem>
                    <SelectItem value="completed">{{ t('order.status.completed') }}</SelectItem>
                    <SelectItem value="canceled">{{ t('order.status.canceled') }}</SelectItem>
                  </SelectContent>
                </Select>
                <Button v-if="canUpdateStatus(order)" size="sm" variant="outline" @click="updateStatus(order)">
                  {{ t('admin.orders.update') }}
                </Button>
                <Button v-if="canCreateFulfillment(order)" size="sm" variant="secondary" @click="openFulfillment(order)">
                  {{ t('admin.orders.fulfillmentCreate') }}
                </Button>
                <Button v-if="order.status === 'delivered'" size="sm" variant="outline" @click="markCompleted(order)">
                  {{ t('admin.orders.markCompleted') }}
                </Button>
                <Button size="sm" variant="outline" @click="openDetail(order)">
                  {{ t('admin.orders.view') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        v-if="pagination.total_page > 1"
        class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4"
      >
        <div class="flex items-center gap-3">
          <span class="text-xs text-muted-foreground">
            {{ t('admin.common.pageInfo', { total: pagination.total, page: pagination.page, totalPage: pagination.total_page }) }}
          </span>
        </div>
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
            <Button
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="pagination.page >= pagination.total_page"
              @click="changePage(pagination.page + 1)"
            >
              {{ t('admin.common.nextPage') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <Dialog v-model:open="showDetail" @update:open="(value) => { if (!value) closeDetail() }">
      <DialogScrollContent class="w-full max-w-5xl">
        <DialogHeader>
          <DialogTitle>{{ t('admin.orders.detailTitle') }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-6">
          <div v-if="detailLoading" class="h-32 rounded-lg border border-border bg-muted/40 animate-pulse"></div>
          <div v-else-if="detailError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {{ detailError }}
          </div>
          <div v-else-if="selectedOrder" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-3">
                  <div class="text-xs text-muted-foreground">{{ t('admin.orders.table.id') }}</div>
                  <div class="text-foreground font-mono mt-1">
                    <IdCell :value="selectedOrder.id" />
                  </div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-3">
                  <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailOrderNo') }}</div>
                  <div class="text-foreground font-mono mt-1">{{ selectedOrder.order_no }}</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-3">
                  <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailUser') }}</div>
                  <div class="text-sm text-foreground">
                    <span v-if="selectedOrder.user_id">
                      {{ t('admin.orders.userLabel') }}:
                      <a :href="userDetailLink(selectedOrder.user_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                        #{{ selectedOrder.user_id }}
                      </a>
                    </span>
                    <span v-else>{{ t('admin.orders.guestLabel') }}: {{ selectedOrder.guest_email || '-' }}</span>
                  </div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-3">
                  <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailStatus') }}</div>
                  <div class="text-sm text-foreground">{{ statusLabel(selectedOrder.status) }}</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-3">
                  <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailCreatedAt') }}</div>
                  <div class="text-sm text-foreground">{{ formatDate(selectedOrder.created_at) }}</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-3">
                  <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailClientIp') }}</div>
                  <div class="text-sm text-foreground">{{ selectedOrder.client_ip || '-' }}</div>
                </CardContent>
              </Card>
            </div>

            <div class="rounded-xl border border-border bg-muted/20 p-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">{{ t('orderDetail.amountTitle') }}</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <Card class="rounded-lg border-border bg-background shadow-none">
                  <CardContent class="p-3">
                    <div class="text-xs text-muted-foreground">{{ t('orderDetail.amountOriginal') }}</div>
                    <div class="text-foreground font-mono mt-1">{{ formatMoney(selectedOrder.original_amount, selectedOrder.currency) }}</div>
                  </CardContent>
                </Card>
                <Card class="rounded-lg border-border bg-background shadow-none">
                  <CardContent class="p-3">
                    <div class="text-xs text-muted-foreground">{{ t('orderDetail.amountDiscount') }}</div>
                    <div class="text-foreground font-mono mt-1">{{ formatMoney(selectedOrder.discount_amount, selectedOrder.currency) }}</div>
                  </CardContent>
                </Card>
                <Card class="rounded-lg border-border bg-background shadow-none">
                  <CardContent class="p-3">
                    <div class="text-xs text-muted-foreground">{{ t('orderDetail.amountTotal') }}</div>
                    <div class="text-foreground font-mono mt-1">{{ formatMoney(selectedOrder.total_amount, selectedOrder.currency) }}</div>
                  </CardContent>
                </Card>
                <Card v-if="hasPositiveAmount(selectedOrder.wallet_paid_amount)" class="rounded-lg border-border bg-background shadow-none">
                  <CardContent class="p-3">
                    <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailWalletPaid') }}</div>
                    <div class="text-foreground font-mono mt-1">{{ formatMoney(selectedOrder.wallet_paid_amount, selectedOrder.currency) }}</div>
                  </CardContent>
                </Card>
                <Card v-if="hasPositiveAmount(selectedOrder.online_paid_amount)" class="rounded-lg border-border bg-background shadow-none">
                  <CardContent class="p-3">
                    <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailOnlinePaid') }}</div>
                    <div class="text-foreground font-mono mt-1">{{ formatMoney(selectedOrder.online_paid_amount, selectedOrder.currency) }}</div>
                  </CardContent>
                </Card>
                <Card v-if="hasPositiveAmount(selectedOrder.refunded_amount)" class="rounded-lg border-border bg-background shadow-none">
                  <CardContent class="p-3">
                    <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailRefunded') }}</div>
                    <div class="text-foreground font-mono mt-1">{{ formatMoney(selectedOrder.refunded_amount, selectedOrder.currency) }}</div>
                  </CardContent>
                </Card>
                <Card class="rounded-lg border-border bg-background shadow-none">
                  <CardContent class="p-3">
                    <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailPaymentMethod') }}</div>
                    <div class="text-foreground mt-1">{{ orderPaymentMethodLabel(selectedOrder) }}</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div class="rounded-xl border border-border bg-muted/20 p-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">{{ t('admin.orders.detailDiscountTitle') }}</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <Card class="rounded-lg border-border bg-background shadow-none">
                  <CardContent class="p-3">
                    <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailCouponDiscount') }}</div>
                    <div class="text-foreground font-mono mt-1">{{ formatMoney(selectedOrder.discount_amount, selectedOrder.currency) }}</div>
                  </CardContent>
                </Card>
                <Card class="rounded-lg border-border bg-background shadow-none">
                  <CardContent class="p-3">
                    <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailPromotionDiscount') }}</div>
                    <div class="text-foreground font-mono mt-1">{{ formatMoney(selectedOrder.promotion_discount_amount, selectedOrder.currency) }}</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div class="rounded-xl border border-border bg-muted/20 p-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">{{ t('orderDetail.itemsTitle') }}</h3>
              <div v-if="selectedOrder.items && selectedOrder.items.length" class="space-y-3">
                <div v-for="item in selectedOrder.items" :key="item.id" class="flex flex-col gap-3 border-b border-border/60 pb-3 text-sm text-muted-foreground">
                  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <a :href="productLink(item.product_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline font-medium">
                        {{ getLocalizedText(item.title) }}
                      </a>
                      <div class="text-xs text-muted-foreground mt-1">#{{ item.product_id }}</div>
                      <div class="text-xs text-muted-foreground">{{ t('orderDetail.quantityLabel') }}：{{ item.quantity }}</div>
                      <div class="mt-2 rounded-lg border border-border/70 bg-background/90 px-3 py-2">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            <Package class="h-3.5 w-3.5" />
                            {{ t('admin.orders.itemSkuLabel') }}
                          </span>
                          <span class="font-mono text-xs text-foreground">{{ orderItemSkuCodeText(item) }}</span>
                        </div>
                        <div class="mt-1 text-xs text-muted-foreground">{{ t('admin.orders.itemSkuSpec') }}：{{ orderItemSkuSpecText(item) }}</div>
                      </div>
                      <div class="text-xs text-muted-foreground mt-1">
                        {{ t('admin.orders.itemCouponCode') }}：
                        <a v-if="selectedOrder.coupon_code" :href="couponCodeLink(selectedOrder.coupon_code)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                          {{ selectedOrder.coupon_code }}
                        </a>
                        <span v-else>-</span>
                      </div>
                      <div class="text-xs text-muted-foreground mt-1">
                        {{ t('admin.orders.itemPromotionName') }}：
                        <a v-if="item.promotion_id" :href="promotionLink(item.promotion_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                          {{ item.promotion_name || `#${item.promotion_id}` }}
                        </a>
                        <span v-else>-</span>
                      </div>
                      <div v-if="item.tags && item.tags.length" class="mt-2 flex flex-wrap gap-2">
                        <span
                          v-for="(tag, index) in item.tags"
                          :key="index"
                          class="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {{ tag }}
                        </span>
                      </div>
                      <div v-if="manualSubmissionRows(item.manual_form_submission).length" class="mt-3 rounded-lg border border-border bg-background p-3">
                        <div class="text-xs font-semibold text-muted-foreground mb-2">{{ t('admin.orders.manualSubmissionTitle') }}</div>
                        <div class="space-y-1 text-xs text-muted-foreground">
                          <div v-for="row in manualSubmissionRows(item.manual_form_submission)" :key="`${item.id}-${row.key}`">
                            <span class="text-foreground">{{ row.key }}</span>：{{ row.value }}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="text-right space-y-1">
                      <div>{{ t('orderDetail.unitPriceLabel') }}：{{ formatMoney(item.unit_price, selectedOrder.currency) }}</div>
                      <div>{{ t('orderDetail.totalPriceLabel') }}：{{ formatMoney(item.total_price, selectedOrder.currency) }}</div>
                      <div v-if="hasPositiveAmount(item.coupon_discount_amount)">
                        {{ t('orderDetail.couponDiscountLabel') }}：{{ formatMoney(item.coupon_discount_amount, selectedOrder.currency) }}
                      </div>
                      <div v-if="hasPositiveAmount(item.promotion_discount_amount)">
                        {{ t('orderDetail.promotionDiscountLabel') }}：{{ formatMoney(item.promotion_discount_amount, selectedOrder.currency) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-xs text-muted-foreground">{{ t('orderDetail.noItems') }}</div>
            </div>

            <div v-if="selectedOrder.children && selectedOrder.children.length" class="rounded-xl border border-border bg-muted/20 p-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">{{ t('orderDetail.childOrdersTitle') }}</h3>
              <div class="space-y-4">
                <div v-for="child in selectedOrder.children" :key="child.id" class="rounded-xl border border-border bg-background p-4">
                  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div class="text-xs text-muted-foreground">{{ t('orderDetail.childOrderNo') }}：{{ child.order_no }}</div>
                      <div class="text-xs text-muted-foreground mt-1">{{ t('orderDetail.childOrderAmount') }}：{{ formatMoney(child.total_amount, child.currency || selectedOrder.currency) }}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(child.status)">
                        {{ statusLabel(child.status) }}
                      </span>
                      <Button v-if="canCreateChildFulfillment(child)" size="sm" variant="secondary" @click="openFulfillment(child, selectedOrder.id)">
                        {{ t('admin.orders.fulfillmentCreate') }}
                      </Button>
                    </div>
                  </div>
                  <div class="mt-4">
                    <h4 class="text-xs font-semibold text-muted-foreground mb-2">{{ t('orderDetail.childItemsTitle') }}</h4>
                    <div v-if="child.items && child.items.length" class="space-y-3">
                      <div v-for="item in child.items" :key="item.id" class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-border/60 pb-3 text-sm text-muted-foreground">
                        <div>
                          <a :href="productLink(item.product_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline font-medium">
                            {{ getLocalizedText(item.title) }}
                          </a>
                          <div class="text-xs text-muted-foreground mt-1">#{{ item.product_id }}</div>
                          <div class="text-xs text-muted-foreground">{{ t('orderDetail.quantityLabel') }}：{{ item.quantity }}</div>
                          <div class="mt-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                            <div class="flex flex-wrap items-center gap-2">
                              <span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                <Package class="h-3.5 w-3.5" />
                                {{ t('admin.orders.itemSkuLabel') }}
                              </span>
                              <span class="font-mono text-xs text-foreground">{{ orderItemSkuCodeText(item) }}</span>
                            </div>
                            <div class="mt-1 text-xs text-muted-foreground">{{ t('admin.orders.itemSkuSpec') }}：{{ orderItemSkuSpecText(item) }}</div>
                          </div>
                          <div v-if="manualSubmissionRows(item.manual_form_submission).length" class="mt-3 rounded-lg border border-border bg-muted/20 p-3">
                            <div class="text-xs font-semibold text-muted-foreground mb-2">{{ t('admin.orders.manualSubmissionTitle') }}</div>
                            <div class="space-y-1 text-xs text-muted-foreground">
                              <div v-for="row in manualSubmissionRows(item.manual_form_submission)" :key="`${item.id}-${row.key}`">
                                <span class="text-foreground">{{ row.key }}</span>：{{ row.value }}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="text-right space-y-1">
                          <div>{{ t('orderDetail.unitPriceLabel') }}：{{ formatMoney(item.unit_price, selectedOrder.currency) }}</div>
                          <div>{{ t('orderDetail.totalPriceLabel') }}：{{ formatMoney(item.total_price, selectedOrder.currency) }}</div>
                          <div v-if="hasPositiveAmount(item.coupon_discount_amount)">
                            {{ t('orderDetail.couponDiscountLabel') }}：{{ formatMoney(item.coupon_discount_amount, selectedOrder.currency) }}
                          </div>
                          <div v-if="hasPositiveAmount(item.promotion_discount_amount)">
                            {{ t('orderDetail.promotionDiscountLabel') }}：{{ formatMoney(item.promotion_discount_amount, selectedOrder.currency) }}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-else class="text-xs text-muted-foreground">{{ t('orderDetail.noItems') }}</div>
                  </div>
                  <div class="mt-4">
                    <h4 class="text-xs font-semibold text-muted-foreground mb-2">{{ t('orderDetail.childFulfillmentTitle') }}</h4>
                    <div v-if="child.fulfillment">
                      <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailFulfillmentType') }}：{{ fulfillmentTypeLabel(child.fulfillment.type) }}</div>
                      <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailFulfillmentStatus') }}：{{ fulfillmentStatusLabel(child.fulfillment.status) }}</div>
                      <div v-if="fulfillmentDeliveryLines(child.fulfillment).length" class="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground space-y-1">
                        <div v-for="(line, lineIndex) in fulfillmentDeliveryLines(child.fulfillment)" :key="`child-fulfillment-${child.id}-${lineIndex}`">{{ line }}</div>
                      </div>
                      <div v-else-if="child.fulfillment.payload" class="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap">
                        {{ child.fulfillment.payload }}
                      </div>
                    </div>
                    <div v-else class="text-xs text-muted-foreground">{{ t('orderDetail.childFulfillmentEmpty') }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="selectedOrder.fulfillment" class="rounded-xl border border-border bg-muted/20 p-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">{{ t('admin.orders.detailFulfillmentTitle') }}</h3>
              <div class="text-sm text-muted-foreground">{{ t('admin.orders.detailFulfillmentType') }}：{{ fulfillmentTypeLabel(selectedOrder.fulfillment.type) }}</div>
              <div class="text-sm text-muted-foreground">{{ t('admin.orders.detailFulfillmentStatus') }}：{{ fulfillmentStatusLabel(selectedOrder.fulfillment.status) }}</div>
              <div v-if="fulfillmentDeliveryLines(selectedOrder.fulfillment).length" class="mt-3 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground space-y-1">
                <div v-for="(line, lineIndex) in fulfillmentDeliveryLines(selectedOrder.fulfillment)" :key="`fulfillment-${selectedOrder.id}-${lineIndex}`">{{ line }}</div>
              </div>
              <div v-else class="mt-3 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {{ selectedOrder.fulfillment.payload }}
              </div>
            </div>

            <div class="rounded-xl border border-border bg-muted/20 p-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">{{ t('admin.orders.detailPayments') }}</h3>
              <div
                v-if="hasWalletPayment(selectedOrder) && (!selectedOrder.payments || selectedOrder.payments.length === 0)"
                class="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700"
              >
                {{ t('admin.orders.detailWalletOnlyNoOnlinePayments') }}
              </div>
              <div v-if="selectedOrder.payments && selectedOrder.payments.length">
                <Table>
                  <TableHeader class="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <TableRow>
                      <TableHead class="px-4 py-3">{{ t('admin.payments.table.paymentId') }}</TableHead>
                      <TableHead class="px-4 py-3">{{ t('admin.payments.table.channel') }}</TableHead>
                      <TableHead class="px-4 py-3">{{ t('admin.payments.table.status') }}</TableHead>
                      <TableHead class="px-4 py-3">{{ t('admin.payments.table.amount') }}</TableHead>
                      <TableHead class="px-4 py-3">{{ t('admin.payments.table.createdAt') }}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody class="divide-y divide-border">
                    <TableRow v-for="payment in selectedOrder.payments" :key="payment.id" class="hover:bg-muted/30">
                      <TableCell class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          <IdCell :value="payment.id" />
                          <a :href="paymentLink(payment.id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline text-xs">
                            {{ t('admin.payments.view') }}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell class="px-4 py-3 text-xs">
                        <div class="text-foreground">{{ payment.channel_name || '-' }}</div>
                        <div class="text-muted-foreground">{{ providerTypeLabel(payment.provider_type) }} / {{ channelTypeLabel(payment.channel_type) }}</div>
                      </TableCell>
                      <TableCell class="px-4 py-3 text-xs">
                        <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="paymentStatusClass(payment.status)">
                          {{ paymentStatusLabel(payment.status) }}
                        </span>
                      </TableCell>
                      <TableCell class="px-4 py-3 font-mono text-foreground">{{ formatMoney(payment.amount, payment.currency) }}</TableCell>
                      <TableCell class="px-4 py-3 text-xs text-muted-foreground">{{ formatDate(payment.created_at) }}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div v-else class="text-xs text-muted-foreground">{{ t('admin.payments.empty') }}</div>
            </div>

            <div v-if="selectedOrder.user_id" class="rounded-xl border border-border bg-muted/20 p-4">
              <h3 class="text-sm font-semibold text-foreground mb-3">{{ t('admin.orders.refundToWalletTitle') }}</h3>
              <div class="mb-3 text-xs text-muted-foreground">
                {{ t('admin.orders.refundableAmount') }}：{{ refundableAmountDisplay(selectedOrder) }}
              </div>
              <form class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto]" @submit.prevent="submitRefundToWallet">
                <Input
                  v-model="refundForm.amount"
                  :placeholder="t('admin.orders.refundAmountPlaceholder')"
                  :disabled="refundSubmitting || !canRefundToWallet(selectedOrder)"
                />
                <Input
                  v-model="refundForm.remark"
                  :placeholder="t('admin.orders.refundRemarkPlaceholder')"
                  :disabled="refundSubmitting || !canRefundToWallet(selectedOrder)"
                />
                <Button
                  type="submit"
                  :disabled="refundSubmitting || !canRefundToWallet(selectedOrder)"
                >
                  {{ refundSubmitting ? t('admin.orders.refunding') : t('admin.orders.refundSubmit') }}
                </Button>
              </form>
              <div v-if="!canRefundToWallet(selectedOrder)" class="mt-3 text-xs text-muted-foreground">
                {{ t('admin.orders.refundNoRemaining') }}
              </div>
              <div v-if="refundError" class="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {{ refundError }}
              </div>
              <div v-if="refundSuccess" class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {{ refundSuccess }}
              </div>
            </div>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>

    <Dialog v-model:open="showFulfillmentModal" @update:open="(value) => { if (!value) closeFulfillment() }">
      <DialogScrollContent class="w-full max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ t('admin.orders.fulfillmentModalTitle') }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div v-if="detailLoading" class="h-24 rounded-lg border border-border bg-muted/40 animate-pulse"></div>
          <div v-else-if="detailError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {{ detailError }}
          </div>
          <div v-else-if="selectedOrder" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-3">
                  <div class="text-xs text-muted-foreground">{{ t('admin.orders.table.id') }}</div>
                  <div class="text-foreground font-mono mt-1">
                    <IdCell :value="selectedOrder.id" />
                  </div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-3">
                  <div class="text-xs text-muted-foreground">{{ t('admin.orders.detailOrderNo') }}</div>
                  <div class="text-foreground mt-1 font-mono">{{ selectedOrder.order_no }}</div>
                </CardContent>
              </Card>
            </div>

            <form class="space-y-4" @submit.prevent="submitFulfillment">
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.orders.fulfillmentNote') }}</label>
                <Textarea
                  v-model="fulfillmentForm.note"
                  rows="3"
                  :placeholder="t('admin.orders.fulfillmentNotePlaceholder')"
                />
              </div>

              <div class="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-xs font-medium text-muted-foreground">{{ t('admin.orders.fulfillmentDeliveryData') }}</div>
                  <Button type="button" size="sm" variant="outline" @click="addDeliveryEntry">
                    {{ t('admin.orders.fulfillmentAddDeliveryField') }}
                  </Button>
                </div>
                <div class="space-y-2">
                  <div v-for="(entry, entryIndex) in fulfillmentForm.entries" :key="entryIndex" class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                    <Input v-model="entry.key" :placeholder="t('admin.orders.fulfillmentDeliveryKeyPlaceholder')" />
                    <Input v-model="entry.value" :placeholder="t('admin.orders.fulfillmentDeliveryValuePlaceholder')" />
                    <Button type="button" size="sm" variant="destructive" @click="removeDeliveryEntry(entryIndex)">
                      {{ t('admin.common.delete') }}
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.orders.fulfillmentPayload') }}</label>
                <Textarea
                  v-model="fulfillmentForm.payload"
                  rows="3"
                  :placeholder="t('admin.orders.fulfillmentPayloadPlaceholder')"
                />
                <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.orders.fulfillmentPayloadTip') }}</p>
              </div>

              <div v-if="fulfillmentError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {{ fulfillmentError }}
              </div>
              <div v-if="fulfillmentSuccess" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {{ fulfillmentSuccess }}
              </div>

              <div class="flex justify-end gap-3">
                <Button type="button" variant="outline" size="sm" @click="resetFulfillmentForm">
                  {{ t('admin.common.reset') }}
                </Button>
                <Button type="submit" size="sm" :disabled="fulfillmentSubmitting">
                  {{ fulfillmentSubmitting ? t('admin.orders.fulfillmentSubmitting') : t('admin.orders.fulfillmentSubmit') }}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
