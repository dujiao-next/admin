<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  orderStatusClass as orderStatusClassMap,
  orderStatusLabel as orderStatusLabelMap,
  paymentStatusClass as paymentStatusClassMap,
  paymentStatusLabel as paymentStatusLabelMap,
  userStatusClass,
  userStatusLabel,
} from '@/utils/status'
import { formatDate, formatMoney, getLocalizedText } from '@/utils/format'

const { t } = useI18n()
const route = useRoute()
const adminPath = import.meta.env.VITE_ADMIN_PATH || ''
const userId = computed(() => Number(route.params.id))

const user = ref<any>(null)
const userError = ref('')

const activeTab = ref<'orders' | 'payments' | 'coupons' | 'wallet'>('orders')
const tabs = computed<Array<{ key: 'orders' | 'payments' | 'coupons' | 'wallet'; label: string }>>(() => [
  { key: 'orders', label: t('admin.userDetail.tabs.orders') },
  { key: 'payments', label: t('admin.userDetail.tabs.payments') },
  { key: 'coupons', label: t('admin.userDetail.tabs.coupons') },
  { key: 'wallet', label: t('admin.userDetail.tabs.wallet') },
])

const orders = ref<any[]>([])
const ordersLoading = ref(false)
const ordersPagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })
const ordersJumpPage = ref('')

const payments = ref<any[]>([])
const paymentsLoading = ref(false)
const paymentsPagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })
const paymentsJumpPage = ref('')

const couponUsages = ref<any[]>([])
const couponsLoading = ref(false)
const couponsPagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })
const couponsJumpPage = ref('')

const walletAccount = ref<any>(null)
const walletTransactions = ref<any[]>([])
const walletLoading = ref(false)
const walletPagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })
const walletJumpPage = ref('')
const walletSubmitting = ref(false)
const walletError = ref('')
const walletSuccess = ref('')
const walletAdjustForm = reactive({
  operation: 'add',
  amount: '',
  remark: '',
})
const siteCurrency = ref('CNY')

const fetchUser = async () => {
  if (!Number.isFinite(userId.value) || userId.value <= 0) return
  userError.value = ''
  try {
    const response = await adminAPI.getUser(userId.value)
    user.value = response.data.data
  } catch (err: any) {
    userError.value = err?.message || t('admin.userDetail.fetchFailed')
  }
}

const fetchSiteCurrency = async () => {
  try {
    const response = await adminAPI.getSettings({ key: 'site_config' })
    const data = response.data?.data as any
    const raw = String(data?.currency || 'CNY').trim().toUpperCase()
    siteCurrency.value = /^[A-Z]{3}$/.test(raw) ? raw : 'CNY'
  } catch {
    siteCurrency.value = 'CNY'
  }
}

const fetchOrders = async (page = 1) => {
  if (!Number.isFinite(userId.value) || userId.value <= 0) return
  ordersLoading.value = true
  try {
    const response = await adminAPI.getOrders({
      page,
      page_size: ordersPagination.value.page_size,
      user_id: userId.value,
    })
    orders.value = (response.data.data as any[]) || []
    ordersPagination.value = response.data.pagination || ordersPagination.value
  } finally {
    ordersLoading.value = false
  }
}

const fetchPayments = async (page = 1) => {
  if (!Number.isFinite(userId.value) || userId.value <= 0) return
  paymentsLoading.value = true
  try {
    const response = await adminAPI.getPayments({
      page,
      page_size: paymentsPagination.value.page_size,
      user_id: userId.value,
    })
    payments.value = (response.data.data as any[]) || []
    paymentsPagination.value = response.data.pagination || paymentsPagination.value
  } finally {
    paymentsLoading.value = false
  }
}

const fetchCoupons = async (page = 1) => {
  if (!Number.isFinite(userId.value) || userId.value <= 0) return
  couponsLoading.value = true
  try {
    const response = await adminAPI.getUserCouponUsages(userId.value, {
      page,
      page_size: couponsPagination.value.page_size,
    })
    couponUsages.value = (response.data.data as any[]) || []
    couponsPagination.value = response.data.pagination || couponsPagination.value
  } finally {
    couponsLoading.value = false
  }
}

const fetchWalletAccount = async () => {
  if (!Number.isFinite(userId.value) || userId.value <= 0) return
  const response = await adminAPI.getUserWallet(userId.value)
  walletAccount.value = response.data.data?.account || null
}

const fetchWalletTransactions = async (page = 1) => {
  if (!Number.isFinite(userId.value) || userId.value <= 0) return
  walletLoading.value = true
  try {
    const response = await adminAPI.getUserWalletTransactions(userId.value, {
      page,
      page_size: walletPagination.value.page_size,
    })
    walletTransactions.value = (response.data.data as any[]) || []
    walletPagination.value = response.data.pagination || walletPagination.value
  } finally {
    walletLoading.value = false
  }
}

const loadWalletData = async (page = walletPagination.value.page) => {
  walletError.value = ''
  try {
    await Promise.all([
      fetchWalletAccount(),
      fetchWalletTransactions(page),
    ])
  } catch (err: any) {
    walletError.value = err?.message || t('admin.userDetail.wallet.errors.loadFailed')
  }
}

const jumpOrdersPage = () => {
  if (!ordersJumpPage.value) return
  const raw = Number(ordersJumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), ordersPagination.value.total_page)
  if (target === ordersPagination.value.page) return
  fetchOrders(target)
}

const jumpPaymentsPage = () => {
  if (!paymentsJumpPage.value) return
  const raw = Number(paymentsJumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), paymentsPagination.value.total_page)
  if (target === paymentsPagination.value.page) return
  fetchPayments(target)
}

const jumpCouponsPage = () => {
  if (!couponsJumpPage.value) return
  const raw = Number(couponsJumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), couponsPagination.value.total_page)
  if (target === couponsPagination.value.page) return
  fetchCoupons(target)
}

const jumpWalletPage = () => {
  if (!walletJumpPage.value) return
  const raw = Number(walletJumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), walletPagination.value.total_page)
  if (target === walletPagination.value.page) return
  fetchWalletTransactions(target)
}

const changeTab = (tab: 'orders' | 'payments' | 'coupons' | 'wallet') => {
  activeTab.value = tab
  if (tab === 'orders') {
    fetchOrders(ordersPagination.value.page)
  } else if (tab === 'payments') {
    fetchPayments(paymentsPagination.value.page)
  } else if (tab === 'coupons') {
    fetchCoupons(couponsPagination.value.page)
  } else {
    walletError.value = ''
    walletSuccess.value = ''
    void loadWalletData(walletPagination.value.page)
  }
}

const orderLink = (orderId: number) => `${adminPath}/orders?order_id=${orderId}`
const orderListLink = computed(() => `${adminPath}/orders?user_id=${userId.value}`)
const paymentListLink = computed(() => `${adminPath}/payments?user_id=${userId.value}`)

const statusClass = (status?: string) => userStatusClass(status)
const statusLabel = (status?: string) => userStatusLabel(t, status)
const orderStatusClass = (status?: string) => orderStatusClassMap(status)
const orderStatusLabel = (status?: string) => orderStatusLabelMap(t, status)
const paymentStatusClass = (status?: string) => paymentStatusClassMap(status)
const paymentStatusLabel = (status?: string) => paymentStatusLabelMap(t, status)

const walletDirectionClass = (direction?: string) => {
  if (direction === 'in') return 'theme-badge-success'
  if (direction === 'out') return 'theme-badge-danger'
  return 'theme-badge-warning'
}

const walletDirectionLabel = (direction?: string) => {
  if (direction === 'in') return t('admin.userDetail.wallet.directionIn')
  if (direction === 'out') return t('admin.userDetail.wallet.directionOut')
  return direction || '-'
}

const walletTypeLabel = (type?: string) => {
  const key = `admin.userDetail.wallet.types.${type || ''}`
  const translated = t(key)
  if (translated === key) return type || '-'
  return translated
}

const walletBalanceDisplay = computed(() => formatMoney(walletAccount.value?.balance, siteCurrency.value))

const submitWalletAdjust = async () => {
  if (!Number.isFinite(userId.value) || userId.value <= 0) return
  walletError.value = ''
  walletSuccess.value = ''
  const amount = walletAdjustForm.amount.trim()
  const value = Number(amount)
  if (!amount || Number.isNaN(value) || value <= 0) {
    walletError.value = t('admin.userDetail.wallet.errors.invalidAmount')
    return
  }
  walletSubmitting.value = true
  try {
    const response = await adminAPI.adjustUserWallet(userId.value, {
      operation: walletAdjustForm.operation as 'add' | 'subtract',
      amount,
      remark: walletAdjustForm.remark.trim() || undefined,
    })
    walletAccount.value = response.data.data?.account || walletAccount.value
    walletAdjustForm.amount = ''
    walletAdjustForm.remark = ''
    await Promise.all([
      fetchUser(),
      fetchWalletTransactions(1),
    ])
    walletSuccess.value = t('admin.userDetail.wallet.adjustSuccess')
  } catch (err: any) {
    walletError.value = err?.message || t('admin.userDetail.wallet.errors.adjustFailed')
  } finally {
    walletSubmitting.value = false
  }
}

const formatLocale = (raw?: string) => {
  if (!raw) return '-'
  const map: Record<string, string> = {
    'zh-CN': t('admin.common.lang.zhCN'),
    'zh-TW': t('admin.common.lang.zhTW'),
    'en-US': t('admin.common.lang.enUS'),
  }
  return map[raw] || raw
}

const formatCouponType = (raw?: string) => {
  if (!raw) return '-'
  const map: Record<string, string> = {
    percent: t('admin.common.discountTypes.percent'),
    fixed: t('admin.common.discountTypes.fixed'),
  }
  return map[raw] || raw
}

const formatScopeProducts = (products?: any[]) => {
  if (!Array.isArray(products) || products.length === 0) return '-'
  const names = products.map((item) => getLocalizedText(item.title)).filter((item) => item)
  if (names.length === 0) return '-'
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')}...`
}

onMounted(() => {
  fetchSiteCurrency()
  fetchUser()
  fetchOrders()
})

watch(
  () => route.params.id,
  () => {
    fetchUser()
    fetchOrders(1)
    fetchPayments(1)
    fetchCoupons(1)
    void loadWalletData(1)
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <router-link :to="`${adminPath}/users`" class="text-muted-foreground hover:text-foreground transition-colors">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </router-link>
        <h1 class="text-2xl font-semibold">{{ t('admin.userDetail.title') }}</h1>
      </div>
      <div class="flex items-center gap-2">
        <Button as-child size="sm" variant="outline">
          <router-link :to="orderListLink">{{ t('admin.userDetail.actions.orders') }}</router-link>
        </Button>
        <Button as-child size="sm" variant="outline">
          <router-link :to="paymentListLink">{{ t('admin.userDetail.actions.payments') }}</router-link>
        </Button>
      </div>
    </div>

    <div v-if="userError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {{ userError }}
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.id') }}</div>
          <div class="text-sm text-foreground">
            <IdCell v-if="user?.id" :value="user.id" />
            <span v-else>-</span>
          </div>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.email') }}</div>
          <div class="text-sm text-foreground">{{ user?.email || '-' }}</div>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.nickname') }}</div>
          <div class="text-sm text-foreground">{{ user?.display_name || '-' }}</div>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.status') }}</div>
          <div class="text-sm text-foreground">
            <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(user?.status)">
              {{ statusLabel(user?.status) }}
            </span>
          </div>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.locale') }}</div>
          <div class="text-sm text-foreground">{{ formatLocale(user?.locale) }}</div>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.createdAt') }}</div>
          <div class="text-sm text-foreground">{{ formatDate(user?.created_at) }}</div>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.lastLoginAt') }}</div>
          <div class="text-sm text-foreground">{{ formatDate(user?.last_login_at) }}</div>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.walletBalance') }}</div>
          <div class="text-sm font-mono text-foreground">{{ formatMoney(user?.wallet_balance, siteCurrency) }}</div>
        </CardContent>
      </Card>
    </div>

    <div class="flex w-fit gap-2 rounded-xl border border-border bg-card p-1">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        :class="activeTab === tab.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'"
        @click="changeTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="activeTab === 'orders'" class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.orders.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.orders.orderNo') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.orders.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.orders.amount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.orders.createdAt') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="ordersLoading">
            <TableCell colspan="5" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="orders.length === 0">
            <TableCell colspan="5" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.userDetail.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="order in orders" :key="order.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="order.id" />
            </TableCell>
            <TableCell class="px-6 py-4 text-foreground font-mono">{{ order.order_no }}</TableCell>
            <TableCell class="px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="orderStatusClass(order.status)">
                {{ orderStatusLabel(order.status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-foreground font-mono">{{ formatMoney(order.total_amount, order.currency) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(order.created_at) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div
        v-if="ordersPagination.total_page > 1"
        class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4"
      >
        <div class="flex items-center gap-3">
          <span class="text-xs text-muted-foreground">
            {{ t('admin.common.pageInfo', { total: ordersPagination.total, page: ordersPagination.page, totalPage: ordersPagination.total_page }) }}
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2">
            <Input
              v-model="ordersJumpPage"
              type="number"
              min="1"
              :max="ordersPagination.total_page"
              class="h-8 w-20"
              :placeholder="t('admin.common.jumpPlaceholder')"
            />
            <Button variant="outline" size="sm" class="h-8" @click="jumpOrdersPage">
              {{ t('admin.common.jumpTo') }}
            </Button>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="ordersPagination.page <= 1"
              @click="fetchOrders(ordersPagination.page - 1)"
            >
              {{ t('admin.common.prevPage') }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="ordersPagination.page >= ordersPagination.total_page"
              @click="fetchOrders(ordersPagination.page + 1)"
            >
              {{ t('admin.common.nextPage') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'payments'" class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.payments.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.payments.orderId') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.payments.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.payments.amount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.payments.createdAt') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="paymentsLoading">
            <TableCell colspan="5" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="payments.length === 0">
            <TableCell colspan="5" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.userDetail.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="payment in payments" :key="payment.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="payment.id" />
            </TableCell>
            <TableCell class="px-6 py-4 text-foreground font-mono">
              <router-link
                v-if="payment.order_id"
                :to="orderLink(payment.order_id)"
                class="text-primary underline-offset-4 hover:underline"
              >
                #{{ payment.order_id }}
              </router-link>
              <span v-else-if="payment.recharge_no">{{ payment.recharge_no }}</span>
              <span v-else>-</span>
              <div v-if="payment.recharge_no" class="mt-1 text-xs text-muted-foreground">
                {{ t('admin.payments.rechargeStatus') }}:
                <span v-if="payment.recharge_status">{{ paymentStatusLabel(payment.recharge_status) }}</span>
                <span v-else>-</span>
              </div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="paymentStatusClass(payment.status)">
                {{ paymentStatusLabel(payment.status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-foreground font-mono">{{ formatMoney(payment.amount, payment.currency) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(payment.created_at) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div
        v-if="paymentsPagination.total_page > 1"
        class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4"
      >
        <div class="flex items-center gap-3">
          <span class="text-xs text-muted-foreground">
            {{ t('admin.common.pageInfo', { total: paymentsPagination.total, page: paymentsPagination.page, totalPage: paymentsPagination.total_page }) }}
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2">
            <Input
              v-model="paymentsJumpPage"
              type="number"
              min="1"
              :max="paymentsPagination.total_page"
              class="h-8 w-20"
              :placeholder="t('admin.common.jumpPlaceholder')"
            />
            <Button variant="outline" size="sm" class="h-8" @click="jumpPaymentsPage">
              {{ t('admin.common.jumpTo') }}
            </Button>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="paymentsPagination.page <= 1"
              @click="fetchPayments(paymentsPagination.page - 1)"
            >
              {{ t('admin.common.prevPage') }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="paymentsPagination.page >= paymentsPagination.total_page"
              @click="fetchPayments(paymentsPagination.page + 1)"
            >
              {{ t('admin.common.nextPage') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'coupons'" class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.coupons.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.coupons.coupon') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.coupons.type') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.coupons.products') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.coupons.orderId') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.coupons.discount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.coupons.createdAt') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="couponsLoading">
            <TableCell colspan="7" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="couponUsages.length === 0">
            <TableCell colspan="7" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.userDetail.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="usage in couponUsages" :key="usage.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="usage.id" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <div class="text-foreground font-mono">{{ usage.coupon_code || '-' }}</div>
              <div class="text-xs text-muted-foreground">#{{ usage.coupon_id }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatCouponType(usage.coupon_type) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatScopeProducts(usage.scope_products) }}</TableCell>
            <TableCell class="px-6 py-4 text-foreground font-mono">
              <router-link
                v-if="usage.order_id"
                :to="orderLink(usage.order_id)"
                class="text-primary underline-offset-4 hover:underline"
              >
                #{{ usage.order_id }}
              </router-link>
              <span v-else>-</span>
            </TableCell>
            <TableCell class="px-6 py-4 text-foreground font-mono">{{ formatMoney(usage.discount_amount) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(usage.created_at) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div
        v-if="couponsPagination.total_page > 1"
        class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4"
      >
        <div class="flex items-center gap-3">
          <span class="text-xs text-muted-foreground">
            {{ t('admin.common.pageInfo', { total: couponsPagination.total, page: couponsPagination.page, totalPage: couponsPagination.total_page }) }}
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2">
            <Input
              v-model="couponsJumpPage"
              type="number"
              min="1"
              :max="couponsPagination.total_page"
              class="h-8 w-20"
              :placeholder="t('admin.common.jumpPlaceholder')"
            />
            <Button variant="outline" size="sm" class="h-8" @click="jumpCouponsPage">
              {{ t('admin.common.jumpTo') }}
            </Button>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="couponsPagination.page <= 1"
              @click="fetchCoupons(couponsPagination.page - 1)"
            >
              {{ t('admin.common.prevPage') }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="couponsPagination.page >= couponsPagination.total_page"
              @click="fetchCoupons(couponsPagination.page + 1)"
            >
              {{ t('admin.common.nextPage') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'wallet'" class="space-y-4">
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <div>
            <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.wallet.balanceLabel') }}</div>
            <div class="mt-1 text-xl font-bold text-foreground">{{ walletBalanceDisplay }}</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.wallet.updatedAtLabel') }}</div>
            <div class="mt-1 text-sm text-foreground">{{ formatDate(walletAccount?.updated_at) }}</div>
          </div>
        </CardContent>
      </Card>

      <div class="rounded-xl border border-border bg-card p-4">
        <div class="mb-4 text-sm font-semibold text-foreground">{{ t('admin.userDetail.wallet.adjustTitle') }}</div>
        <form class="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr_2fr_auto]" @submit.prevent="submitWalletAdjust">
          <div>
            <label class="mb-1.5 block text-xs text-muted-foreground">{{ t('admin.userDetail.wallet.operationLabel') }}</label>
            <Select v-model="walletAdjustForm.operation">
              <SelectTrigger class="h-9 w-full">
                <SelectValue :placeholder="t('admin.userDetail.wallet.operations.add')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">{{ t('admin.userDetail.wallet.operations.add') }}</SelectItem>
                <SelectItem value="subtract">{{ t('admin.userDetail.wallet.operations.subtract') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-muted-foreground">{{ t('admin.userDetail.wallet.amountLabel') }}</label>
            <Input v-model="walletAdjustForm.amount" :placeholder="t('admin.userDetail.wallet.amountPlaceholder')" />
          </div>
          <div>
            <label class="mb-1.5 block text-xs text-muted-foreground">{{ t('admin.userDetail.wallet.remarkLabel') }}</label>
            <Input v-model="walletAdjustForm.remark" :placeholder="t('admin.userDetail.wallet.remarkPlaceholder')" />
          </div>
          <div class="flex items-end">
            <Button type="submit" :disabled="walletSubmitting">
              {{ walletSubmitting ? t('admin.userDetail.wallet.adjusting') : t('admin.userDetail.wallet.adjustSubmit') }}
            </Button>
          </div>
        </form>
        <div v-if="walletError" class="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {{ walletError }}
        </div>
        <div v-if="walletSuccess" class="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {{ walletSuccess }}
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <TableRow>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.id') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.type') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.direction') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.amount') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.balanceAfter') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.remark') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.createdAt') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody class="divide-y divide-border">
            <TableRow v-if="walletLoading">
              <TableCell colspan="7" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
            </TableRow>
            <TableRow v-else-if="walletTransactions.length === 0">
              <TableCell colspan="7" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.userDetail.empty') }}</TableCell>
            </TableRow>
            <TableRow v-for="item in walletTransactions" :key="item.id" class="hover:bg-muted/30">
              <TableCell class="px-6 py-4">
                <IdCell :value="item.id" />
              </TableCell>
              <TableCell class="px-6 py-4 text-xs text-foreground">{{ walletTypeLabel(item.type) }}</TableCell>
              <TableCell class="px-6 py-4 text-xs">
                <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="walletDirectionClass(item.direction)">
                  {{ walletDirectionLabel(item.direction) }}
                </span>
              </TableCell>
              <TableCell class="px-6 py-4 text-xs font-mono text-foreground">{{ formatMoney(item.amount, item.currency) }}</TableCell>
              <TableCell class="px-6 py-4 text-xs font-mono text-foreground">{{ formatMoney(item.balance_after, item.currency) }}</TableCell>
              <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ item.remark || '-' }}</TableCell>
              <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.created_at) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div
          v-if="walletPagination.total_page > 1"
          class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4"
        >
          <span class="text-xs text-muted-foreground">
            {{ t('admin.common.pageInfo', { total: walletPagination.total, page: walletPagination.page, totalPage: walletPagination.total_page }) }}
          </span>
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex items-center gap-2">
              <Input
                v-model="walletJumpPage"
                type="number"
                min="1"
                :max="walletPagination.total_page"
                class="h-8 w-20"
                :placeholder="t('admin.common.jumpPlaceholder')"
              />
              <Button variant="outline" size="sm" class="h-8" @click="jumpWalletPage">
                {{ t('admin.common.jumpTo') }}
              </Button>
            </div>
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                class="h-8"
                :disabled="walletPagination.page <= 1"
                @click="fetchWalletTransactions(walletPagination.page - 1)"
              >
                {{ t('admin.common.prevPage') }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-8"
                :disabled="walletPagination.page >= walletPagination.total_page"
                @click="fetchWalletTransactions(walletPagination.page + 1)"
              >
                {{ t('admin.common.nextPage') }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
