<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { paymentStatusClass, paymentStatusLabel } from '@/utils/status'
import { formatDate, toRFC3339 } from '@/utils/format'

const loading = ref(true)
const payments = ref<any[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const jumpPage = ref('')
const adminPath = import.meta.env.VITE_ADMIN_PATH || ''
const filters = reactive({
  userId: '',
  orderId: '',
  channelId: '',
  providerType: '__all__',
  createdFrom: '',
  createdTo: '',
  status: '__all__',
})
const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)
const { t } = useI18n()
const route = useRoute()
const showDetail = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detailPayment = ref<any>(null)
const exporting = ref(false)
const exportError = ref('')

const fetchPayments = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getPayments({
      page,
      page_size: pagination.value.page_size,
      status: normalizeFilterValue(filters.status) || undefined,
      user_id: filters.userId || undefined,
      order_id: filters.orderId || undefined,
      channel_id: filters.channelId || undefined,
      provider_type: normalizeFilterValue(filters.providerType) || undefined,
      created_from: toRFC3339(filters.createdFrom),
      created_to: toRFC3339(filters.createdTo),
    })
    payments.value = (response.data.data as any[]) || []
    pagination.value = response.data.pagination || pagination.value
  } catch (error) {
    payments.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchPayments(1)
}

const refresh = () => {
  fetchPayments(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchPayments(page)
}

const jumpToPage = () => {
  if (!jumpPage.value) return
  const raw = Number(jumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), pagination.value.total_page)
  if (target === pagination.value.page) return
  changePage(target)
}

const orderLink = (orderId: number) => `${adminPath}/orders?order_id=${orderId}`
const channelLink = (channelId: number) => `${adminPath}/payment-channels?channel_id=${channelId}`

const handleExport = async () => {
  exportError.value = ''
  exporting.value = true
  try {
    const response = await adminAPI.exportPayments({
      user_id: filters.userId || undefined,
      order_id: filters.orderId || undefined,
      channel_id: filters.channelId || undefined,
      provider_type: normalizeFilterValue(filters.providerType) || undefined,
      created_from: toRFC3339(filters.createdFrom),
      created_to: toRFC3339(filters.createdTo),
      status: normalizeFilterValue(filters.status) || undefined,
    })
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.href = url
    link.download = `payments_${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    exportError.value = t('admin.payments.exportFailed')
  } finally {
    exporting.value = false
  }
}

const openDetail = async (payment: any) => {
  showDetail.value = true
  detailLoading.value = true
  detailError.value = ''
  detailPayment.value = null
  try {
    const response = await adminAPI.getPayment(payment.id)
    detailPayment.value = response.data.data
  } catch (err: any) {
    detailError.value = err?.message || t('admin.payments.detailFetchFailed')
  } finally {
    detailLoading.value = false
  }
}

const openDetailById = async (paymentId: number) => {
  if (!paymentId || paymentId <= 0) return
  await openDetail({ id: paymentId })
}

const closeDetail = () => {
  showDetail.value = false
  detailPayment.value = null
  detailError.value = ''
}

const statusClass = (status: string) => paymentStatusClass(status)

const statusLabel = (status: string) => paymentStatusLabel(t, status)

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

const interactionModeLabel = (value?: string) => {
  const map: Record<string, string> = {
    qr: t('admin.paymentChannels.interactionModes.qr'),
    redirect: t('admin.paymentChannels.interactionModes.redirect'),
    wap: t('admin.paymentChannels.interactionModes.wap'),
    page: t('admin.paymentChannels.interactionModes.page'),
    balance: t('admin.paymentChannels.interactionModes.balance'),
  }
  if (!value) return '-'
  return map[value] || value
}

const formatFeeRate = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return '-'
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return '-'
  return `${parsed.toFixed(2)}%`
}

const formatMoney = (value: string | number | null | undefined, currency?: string) => {
  if (value === undefined || value === null || value === '') return '-'
  const displayCurrency = currency ? ` ${currency}` : ''
  return `${value}${displayCurrency}`
}

const formatPayload = (payload: any) => {
  if (!payload) return '-'
  try {
    return JSON.stringify(payload, null, 2)
  } catch (error) {
    return String(payload)
  }
}

onMounted(() => {
  if (route.query.user_id) {
    filters.userId = String(route.query.user_id || '')
  }
  fetchPayments()
  const paymentId = Number(route.query.payment_id)
  if (Number.isFinite(paymentId) && paymentId > 0) {
    openDetailById(paymentId)
  }
})

watch(
  () => route.query.user_id,
  (value) => {
    if (value) {
      filters.userId = String(value)
      fetchPayments(1)
    }
  }
)

watch(
  () => route.query.payment_id,
  (value) => {
    const paymentId = Number(value)
    if (Number.isFinite(paymentId) && paymentId > 0) {
      openDetailById(paymentId)
    }
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.payments.title') }}</h1>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-32">
          <Input v-model="filters.userId" :placeholder="t('admin.payments.filterUserId')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-48">
          <Input v-model="filters.orderId" :placeholder="t('admin.payments.filterOrderId')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-48">
          <Input v-model="filters.channelId" :placeholder="t('admin.payments.filterChannelId')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-40">
          <Select v-model="filters.providerType" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.payments.filterProviderAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.payments.filterProviderAll') }}</SelectItem>
              <SelectItem value="wallet">{{ t('admin.paymentChannels.providerTypes.wallet') }}</SelectItem>
              <SelectItem value="official">{{ t('admin.paymentChannels.providerTypes.official') }}</SelectItem>
              <SelectItem value="epay">{{ t('admin.paymentChannels.providerTypes.epay') }}</SelectItem>
              <SelectItem value="epusdt">{{ t('admin.paymentChannels.providerTypes.epusdt') }}</SelectItem>
              <SelectItem value="tokenpay">{{ t('admin.paymentChannels.providerTypes.tokenpay') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-muted-foreground whitespace-nowrap">{{ t('admin.payments.filterCreatedRange') }}</span>
          <Input
            v-model="filters.createdFrom"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            :placeholder="t('admin.payments.filterCreatedFrom')"
            @update:modelValue="handleSearch"
          />
          <span class="text-muted-foreground">-</span>
          <Input
            v-model="filters.createdTo"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            :placeholder="t('admin.payments.filterCreatedTo')"
            @update:modelValue="handleSearch"
          />
        </div>
        <div class="w-full md:w-40">
          <Select v-model="filters.status" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
            <SelectValue :placeholder="t('admin.payments.filterStatusAll')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{{ t('admin.payments.filterStatusAll') }}</SelectItem>
            <SelectItem value="initiated">{{ t('payment.status.initiated') }}</SelectItem>
            <SelectItem value="pending">{{ t('payment.status.pending') }}</SelectItem>
            <SelectItem value="success">{{ t('payment.status.success') }}</SelectItem>
            <SelectItem value="failed">{{ t('payment.status.failed') }}</SelectItem>
            <SelectItem value="expired">{{ t('payment.status.expired') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex-1"></div>
        <Button size="sm" variant="outline" @click="refresh">{{ t('admin.common.refresh') }}</Button>
        <Button size="sm" :disabled="exporting" @click="handleExport">
          {{ exporting ? t('admin.payments.exporting') : t('admin.payments.export') }}
        </Button>
      </div>
    </div>

    <div v-if="exportError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {{ exportError }}
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.payments.table.paymentId') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.payments.table.orderId') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.payments.table.channel') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.payments.table.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.payments.table.amount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.payments.table.feeRate') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.payments.table.feeAmount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.payments.table.createdAt') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.payments.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="9" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="payments.length === 0">
            <TableCell colspan="9" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.payments.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="payment in payments" :key="payment.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="payment.id" />
            </TableCell>
            <TableCell class="px-6 py-4 text-foreground">
              <a v-if="payment.order_id" :href="orderLink(payment.order_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                #{{ payment.order_id }}
              </a>
              <div v-else-if="payment.recharge_no" class="text-foreground font-mono">
                {{ payment.recharge_no }}
              </div>
              <span v-else>-</span>
              <div v-if="payment.recharge_no" class="text-xs text-muted-foreground mt-1">
                {{ t('admin.payments.rechargeUser') }}:
                <span v-if="payment.recharge_user_id" class="font-mono">#{{ payment.recharge_user_id }}</span>
                <span v-else>-</span>
              </div>
              <div v-if="payment.recharge_no && payment.recharge_status" class="text-xs text-muted-foreground mt-0.5">
                {{ t('admin.payments.rechargeStatus') }}: {{ statusLabel(payment.recharge_status) }}
              </div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div class="text-foreground">{{ payment.channel_name || '-' }}</div>
              <div class="text-muted-foreground">{{ providerTypeLabel(payment.provider_type) }} / {{ channelTypeLabel(payment.channel_type) }}</div>
              <div class="text-muted-foreground mt-0.5">
                {{ t('admin.payments.channelId') }}:
                <a v-if="payment.channel_id" :href="channelLink(payment.channel_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                  #{{ payment.channel_id }}
                </a>
                <span v-else>-</span>
              </div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(payment.status)">
                {{ statusLabel(payment.status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 font-mono text-foreground">{{ payment.amount }} {{ payment.currency }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatFeeRate(payment.fee_rate) }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-foreground">{{ formatMoney(payment.fee_amount, payment.currency) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(payment.created_at) }}</TableCell>
            <TableCell class="px-6 py-4 text-right">
              <Button size="sm" variant="outline" @click="openDetail(payment)">
                {{ t('admin.payments.view') }}
              </Button>
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
          <DialogTitle>{{ t('admin.payments.detailTitle') }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-6">
          <div v-if="detailLoading" class="h-32 rounded-lg border border-border bg-muted/40 animate-pulse"></div>
          <div v-else-if="detailError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {{ detailError }}
          </div>
          <div v-else-if="detailPayment" class="space-y-6 text-sm text-muted-foreground">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailPaymentId') }}</div>
                  <div class="text-foreground font-mono text-sm break-all">
                    <IdCell :value="detailPayment.id" />
                  </div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailOrderId') }}</div>
                  <div class="text-foreground font-mono text-sm break-all">
                    <a v-if="detailPayment.order_id" :href="orderLink(detailPayment.order_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                      #{{ detailPayment.order_id }}
                    </a>
                    <span v-else-if="detailPayment.recharge_no">{{ detailPayment.recharge_no }}</span>
                    <span v-else>-</span>
                    <div v-if="detailPayment.recharge_no" class="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div>
                        {{ t('admin.payments.rechargeUser') }}:
                        <span v-if="detailPayment.recharge_user_id" class="font-mono">#{{ detailPayment.recharge_user_id }}</span>
                        <span v-else>-</span>
                      </div>
                      <div v-if="detailPayment.recharge_status">
                        {{ t('admin.payments.rechargeStatus') }}: {{ statusLabel(detailPayment.recharge_status) }}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailChannel') }}</div>
                  <div class="text-foreground text-sm break-words">{{ detailPayment.channel_name || '-' }}</div>
                  <div class="text-xs text-muted-foreground mt-1 break-words">{{ providerTypeLabel(detailPayment.provider_type) }} / {{ channelTypeLabel(detailPayment.channel_type) }}</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.channelId') }}</div>
                  <div class="text-foreground font-mono text-sm break-all">
                    <a v-if="detailPayment.channel_id" :href="channelLink(detailPayment.channel_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                      #{{ detailPayment.channel_id }}
                    </a>
                    <span v-else>-</span>
                  </div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailStatus') }}</div>
                  <div class="text-foreground text-sm">{{ statusLabel(detailPayment.status) }}</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailAmount') }}</div>
                  <div class="text-foreground font-mono text-sm">{{ detailPayment.amount }} {{ detailPayment.currency }}</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailFeeRate') }}</div>
                  <div class="text-foreground font-mono text-sm">{{ formatFeeRate(detailPayment.fee_rate) }}</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailFeeAmount') }}</div>
                  <div class="text-foreground font-mono text-sm">{{ formatMoney(detailPayment.fee_amount, detailPayment.currency) }}</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailInteraction') }}</div>
                  <div class="text-foreground text-sm">{{ interactionModeLabel(detailPayment.interaction_mode) }}</div>
                </CardContent>
              </Card>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailCreatedAt') }}</div>
                  <div class="text-foreground text-sm">{{ formatDate(detailPayment.created_at) }}</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailPaidAt') }}</div>
                  <div class="text-foreground text-sm">{{ formatDate(detailPayment.paid_at) }}</div>
                </CardContent>
              </Card>
              <Card class="rounded-lg border-border bg-background shadow-none">
                <CardContent class="p-4">
                  <div class="text-xs text-muted-foreground mb-2">{{ t('admin.payments.detailExpiredAt') }}</div>
                  <div class="text-foreground text-sm">{{ formatDate(detailPayment.expired_at) }}</div>
                </CardContent>
              </Card>
            </div>

            <Card class="rounded-lg border-border bg-background shadow-none">
              <CardContent class="p-4">
                <div class="text-xs text-muted-foreground mb-3">{{ t('admin.payments.detailProviderRef') }}</div>
                <div class="text-foreground break-all text-sm">{{ detailPayment.provider_ref || '-' }}</div>
              </CardContent>
            </Card>

            <Card v-if="detailPayment.pay_url" class="rounded-lg border-border bg-background shadow-none">
              <CardContent class="p-4">
                <div class="text-xs text-muted-foreground mb-3">{{ t('admin.payments.detailPayUrl') }}</div>
                <div class="text-foreground break-all text-sm">{{ detailPayment.pay_url }}</div>
              </CardContent>
            </Card>

            <Card v-if="detailPayment.qr_code" class="rounded-lg border-border bg-background shadow-none">
              <CardContent class="p-4">
                <div class="text-xs text-muted-foreground mb-3">{{ t('admin.payments.detailQrCode') }}</div>
                <div class="text-foreground break-all text-sm">{{ detailPayment.qr_code }}</div>
              </CardContent>
            </Card>

            <Card class="rounded-lg border-border bg-background shadow-none">
              <CardContent class="p-4">
                <div class="text-xs text-muted-foreground mb-3">{{ t('admin.payments.detailPayload') }}</div>
                <div class="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/40 p-4 rounded-lg border border-border overflow-auto max-h-64 break-all word-break-break-all">
                  {{ formatPayload(detailPayment.provider_payload) }}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>

<style scoped>
.break-all {
  word-break: break-all;
  overflow-wrap: break-word;
}
</style>
