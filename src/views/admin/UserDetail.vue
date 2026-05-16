<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI, type AdminWalletAccount, type AdminWalletTransaction } from '@/api/admin'
import type { AdminUser, AdminOrder, AdminPayment, AdminMemberLevel } from '@/api/types'
import IdCell from '@/components/IdCell.vue'
import { Copy } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ListPagination from '@/components/ListPagination.vue'
import type { AcceptableValue } from 'reka-ui'
import { copyText } from '@/utils/clipboard'
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

interface UserDetailCouponUsage {
  id: number
  coupon_code?: string
  coupon_id?: number
  coupon_type?: string
  scope_products?: Array<{ title: Record<string, string> }>
  order_id?: number
  discount_amount?: number
  created_at: string
}

const user = ref<(AdminUser & Record<string, unknown>) | null>(null)
const userError = ref('')

const activeTab = ref<'orders' | 'payments' | 'coupons' | 'wallet'>('orders')
const tabs = computed<Array<{ key: 'orders' | 'payments' | 'coupons' | 'wallet'; label: string }>>(() => [
  { key: 'orders', label: t('admin.userDetail.tabs.orders') },
  { key: 'payments', label: t('admin.userDetail.tabs.payments') },
  { key: 'coupons', label: t('admin.userDetail.tabs.coupons') },
  { key: 'wallet', label: t('admin.userDetail.tabs.wallet') },
])

const orders = ref<AdminOrder[]>([])
const ordersLoading = ref(false)
const ordersPagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })

const payments = ref<AdminPayment[]>([])
const paymentsLoading = ref(false)
const paymentsPagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })

const couponUsages = ref<UserDetailCouponUsage[]>([])
const couponsLoading = ref(false)
const couponsPagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })

const walletAccount = ref<AdminWalletAccount | null>(null)
const walletTransactions = ref<AdminWalletTransaction[]>([])
const walletLoading = ref(false)
const walletPagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })

const pageSizeOptions = [10, 20, 50, 100]
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
    const data = response.data?.data as Record<string, unknown>
    const raw = String(data?.currency || 'CNY').trim().toUpperCase()
    siteCurrency.value = /^[A-Z]{3}$/.test(raw) ? raw : 'CNY'
  } catch {
    siteCurrency.value = 'CNY'
  }
}

const memberLevels = ref<AdminMemberLevel[]>([])
const memberLevelUpdating = ref(false)

const fetchMemberLevels = async () => {
  try {
    const response = await adminAPI.getMemberLevels({ page: 1, page_size: 100 })
    memberLevels.value = response.data.data || []
  } catch {
    memberLevels.value = []
  }
}

const currentMemberLevelName = computed(() => {
  const levelId = Number(user.value?.member_level_id || 0)
  if (!levelId) return '-'
  const level = memberLevels.value.find((l) => l.id === levelId)
  if (!level) return `#${levelId}`
  return getLocalizedText(level.name)
})

const handleMemberLevelChange = async (value: AcceptableValue) => {
  const levelId = Number(value)
  if (!Number.isFinite(levelId) || !user.value) return
  memberLevelUpdating.value = true
  try {
    await adminAPI.setUserMemberLevel(userId.value, levelId)
    user.value.member_level_id = levelId
  } catch {
    // revert
  } finally {
    memberLevelUpdating.value = false
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
    orders.value = response.data.data || []
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
    payments.value = response.data.data || []
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
    couponUsages.value = (response.data.data as UserDetailCouponUsage[]) || []
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
    walletTransactions.value = response.data.data || []
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

const changeOrdersPage = (page: number) => {
  if (page < 1 || page > ordersPagination.value.total_page) return
  fetchOrders(page)
}

const changeOrdersPageSize = (size: number) => {
  if (size === ordersPagination.value.page_size) return
  ordersPagination.value.page_size = size
  fetchOrders(1)
}

const handleCopyOrderNo = async (orderNo: string) => {
  try { await copyText(orderNo) } catch {}
}

const handleCopyRechargeNo = async (rechargeNo: string) => {
  try { await copyText(rechargeNo) } catch {}
}

const changePaymentsPage = (page: number) => {
  if (page < 1 || page > paymentsPagination.value.total_page) return
  fetchPayments(page)
}

const changePaymentsPageSize = (size: number) => {
  if (size === paymentsPagination.value.page_size) return
  paymentsPagination.value.page_size = size
  fetchPayments(1)
}

const changeCouponsPage = (page: number) => {
  if (page < 1 || page > couponsPagination.value.total_page) return
  fetchCoupons(page)
}

const changeCouponsPageSize = (size: number) => {
  if (size === couponsPagination.value.page_size) return
  couponsPagination.value.page_size = size
  fetchCoupons(1)
}

const changeWalletPage = (page: number) => {
  if (page < 1 || page > walletPagination.value.total_page) return
  fetchWalletTransactions(page)
}

const changeWalletPageSize = (size: number) => {
  if (size === walletPagination.value.page_size) return
  walletPagination.value.page_size = size
  fetchWalletTransactions(1)
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
const paymentDetailLink = (paymentId: number) => `${adminPath}/payments?payment_id=${paymentId}`
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

const formatScopeProducts = (products?: Array<{ title: Record<string, string> }>) => {
  if (!Array.isArray(products) || products.length === 0) return '-'
  const names = products.map((item) => getLocalizedText(item.title)).filter((item) => item)
  if (names.length === 0) return '-'
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 3).join(', ')}...`
}

const oauthIdentities = computed(() => {
  const list = user.value?.oauth_identities
  return Array.isArray(list) ? list : []
})

const twofaEnabled = computed(() => Boolean(user.value?.totp_enabled_at))
const twofaEnabledAt = computed(() => (user.value?.totp_enabled_at as string | undefined) || '')
const twofaResetting = ref(false)
const twofaError = ref('')
const twofaSuccess = ref('')

const handleResetUser2FA = async () => {
  if (!Number.isFinite(userId.value) || userId.value <= 0) return
  if (!twofaEnabled.value) return
  const email = user.value?.email || `#${userId.value}`
  if (!confirm(t('admin.userDetail.twofa.confirmReset', { email }))) return
  twofaError.value = ''
  twofaSuccess.value = ''
  twofaResetting.value = true
  try {
    await adminAPI.resetUser2FA(userId.value)
    twofaSuccess.value = t('admin.userDetail.twofa.resetSuccess')
    await fetchUser()
  } catch (err: any) {
    twofaError.value = err?.message || t('admin.userDetail.twofa.resetFailed')
  } finally {
    twofaResetting.value = false
  }
}

const formatProviderLabel = (provider?: string) => {
  if (!provider) return '-'
  const normalized = provider.trim().toLowerCase()
  if (normalized === 'telegram') return 'Telegram'
  return normalized
}

onMounted(() => {
  fetchSiteCurrency()
  fetchUser()
  fetchOrders()
  fetchMemberLevels()
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
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <router-link :to="`${adminPath}/users`" class="text-muted-foreground hover:text-foreground transition-colors">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </router-link>
        <h1 class="text-2xl font-semibold">{{ t('admin.userDetail.title') }}</h1>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button as-child size="sm" variant="outline" class="w-full sm:w-auto">
          <router-link :to="orderListLink">{{ t('admin.userDetail.actions.orders') }}</router-link>
        </Button>
        <Button as-child size="sm" variant="outline" class="w-full sm:w-auto">
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
          <div class="text-sm text-foreground break-all">{{ user?.email || '-' }}</div>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.nickname') }}</div>
          <div class="text-sm text-foreground break-words">{{ user?.display_name || '-' }}</div>
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
      <Card class="rounded-lg border-border bg-background shadow-none">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.memberLevel') }}</div>
          <div class="mt-1">
            <Select
              :model-value="String(user?.member_level_id || 0)"
              :disabled="memberLevelUpdating"
              @update:model-value="handleMemberLevelChange"
            >
              <SelectTrigger class="h-8 w-full">
                <SelectValue>{{ currentMemberLevelName }}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">-</SelectItem>
                <SelectItem
                  v-for="level in memberLevels"
                  :key="level.id"
                  :value="String(level.id)"
                >
                  {{ level.icon }} {{ getLocalizedText(level.name) }}
                  <span v-if="level.is_default" class="text-muted-foreground">({{ t('admin.memberLevels.default') }})</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border bg-background shadow-none md:col-span-3">
        <CardContent class="p-3">
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.adminNote') }}</div>
          <div class="text-sm text-foreground whitespace-pre-wrap">{{ (user?.admin_note as string) || '-' }}</div>
        </CardContent>
      </Card>
      <Card class="rounded-lg border-border bg-background shadow-none md:col-span-3">
        <CardContent class="space-y-2 p-3">
          <div class="flex flex-wrap items-center gap-3">
            <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.fields.twofa') }}</div>
            <span
              class="inline-flex rounded-full border px-2.5 py-1 text-xs"
              :class="twofaEnabled ? 'theme-badge-success' : 'theme-badge-warning'"
            >
              {{ twofaEnabled ? t('admin.userDetail.twofa.enabled') : t('admin.userDetail.twofa.disabled') }}
            </span>
            <span v-if="twofaEnabled" class="text-xs text-muted-foreground">
              {{ t('admin.userDetail.twofa.enabledAt') }}: {{ formatDate(twofaEnabledAt) }}
            </span>
            <Button
              v-if="twofaEnabled"
              size="sm"
              variant="destructive"
              :disabled="twofaResetting"
              @click="handleResetUser2FA"
            >
              {{ twofaResetting ? t('admin.userDetail.twofa.resetting') : t('admin.userDetail.twofa.reset') }}
            </Button>
          </div>
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.twofa.hint') }}</div>
          <div v-if="twofaError" class="text-xs text-destructive">{{ twofaError }}</div>
          <div v-if="twofaSuccess" class="text-xs text-emerald-600">{{ twofaSuccess }}</div>
        </CardContent>
      </Card>
    </div>

    <Card class="rounded-lg border-border bg-background shadow-none">
      <CardContent class="space-y-3 p-4">
        <div>
          <div class="text-xs text-muted-foreground">{{ t('admin.userDetail.oauth.title') }}</div>
          <div class="text-sm text-muted-foreground">{{ t('admin.userDetail.oauth.subtitle') }}</div>
        </div>
        <div v-if="oauthIdentities.length === 0" class="text-sm text-muted-foreground">
          {{ t('admin.userDetail.oauth.empty') }}
        </div>
        <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="identity in oauthIdentities"
            :key="identity.id"
            class="rounded-lg border border-border bg-card px-4 py-3"
          >
            <div class="flex items-center gap-3">
              <img
                v-if="identity.avatar_url"
                :src="identity.avatar_url"
                :alt="identity.username || identity.provider_user_id"
                class="h-10 w-10 rounded-full border border-border object-cover"
              />
              <div class="min-w-0">
                <div class="text-sm font-medium text-foreground">{{ formatProviderLabel(identity.provider) }}</div>
                <div class="truncate text-xs text-muted-foreground">
                  {{ identity.username ? `@${identity.username}` : identity.provider_user_id }}
                </div>
              </div>
            </div>
            <div class="mt-3 space-y-1 text-xs text-muted-foreground">
              <div>{{ t('admin.userDetail.oauth.providerUserId') }}: <span class="font-mono text-foreground">{{ identity.provider_user_id || '-' }}</span></div>
              <div>{{ t('admin.userDetail.oauth.username') }}: <span class="text-foreground">{{ identity.username ? `@${identity.username}` : '-' }}</span></div>
              <div>{{ t('admin.userDetail.oauth.boundAt') }}: <span class="text-foreground">{{ formatDate(identity.created_at) }}</span></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="flex w-full gap-2 overflow-x-auto rounded-xl border border-border bg-card p-1 sm:w-fit">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        :class="activeTab === tab.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'"
        @click="changeTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="activeTab === 'orders'" class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[720px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.orders.id') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[220px]">{{ t('admin.userDetail.orders.orderNo') }}</TableHead>
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
            <TableCell class="min-w-[220px] px-6 py-4 text-foreground font-mono">
              <div class="flex items-center gap-1.5">
                <router-link
                  :to="orderLink(order.id)"
                  class="break-all text-primary underline-offset-4 hover:underline"
                >
                  {{ order.order_no }}
                </router-link>
                <button
                  type="button"
                  class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                  :title="t('admin.common.copy')"
                  @click="handleCopyOrderNo(order.order_no)"
                >
                  <Copy class="h-3 w-3" />
                </button>
              </div>
            </TableCell>
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
      <ListPagination
        :page="ordersPagination.page"
        :total-page="ordersPagination.total_page"
        :total="ordersPagination.total"
        :page-size="ordersPagination.page_size"
        :page-size-options="pageSizeOptions"
        @change-page="changeOrdersPage"
        @change-page-size="changeOrdersPageSize"
      />
    </div>

    <div v-if="activeTab === 'payments'" class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[760px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.payments.id') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[220px]">{{ t('admin.userDetail.payments.orderId') }}</TableHead>
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
            <TableCell class="min-w-[220px] px-6 py-4 text-foreground font-mono">
              <router-link
                v-if="payment.order_id"
                :to="orderLink(payment.order_id)"
                class="break-all text-primary underline-offset-4 hover:underline"
              >
                {{ payment.order_no }}
              </router-link>
              <button
                v-if="payment.order_id"
                type="button"
                class="ml-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                :title="t('admin.common.copy')"
                @click="handleCopyOrderNo(payment.order_no)"
              >
                <Copy class="h-3 w-3" />
              </button>
              <div v-else-if="payment.recharge_no" class="flex items-center gap-1.5">
                <router-link
                  :to="paymentDetailLink(payment.id)"
                  class="break-all text-primary underline-offset-4 hover:underline"
                >
                  {{ payment.recharge_no }}
                </router-link>
                <button
                  type="button"
                  class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                  :title="t('admin.common.copy')"
                  @click="handleCopyRechargeNo(payment.recharge_no)"
                >
                  <Copy class="h-3 w-3" />
                </button>
              </div>
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
      <ListPagination
        :page="paymentsPagination.page"
        :total-page="paymentsPagination.total_page"
        :total="paymentsPagination.total"
        :page-size="paymentsPagination.page_size"
        :page-size-options="pageSizeOptions"
        @change-page="changePaymentsPage"
        @change-page-size="changePaymentsPageSize"
      />
    </div>

    <div v-if="activeTab === 'coupons'" class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[900px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.coupons.id') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[180px]">{{ t('admin.userDetail.coupons.coupon') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.userDetail.coupons.type') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[220px]">{{ t('admin.userDetail.coupons.products') }}</TableHead>
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
            <TableCell class="min-w-[180px] px-6 py-4">
              <div class="text-foreground font-mono">{{ usage.coupon_code || '-' }}</div>
              <div class="text-xs text-muted-foreground">#{{ usage.coupon_id }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatCouponType(usage.coupon_type) }}</TableCell>
            <TableCell class="min-w-[220px] px-6 py-4 text-xs text-muted-foreground break-words">{{ formatScopeProducts(usage.scope_products) }}</TableCell>
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
      <ListPagination
        :page="couponsPagination.page"
        :total-page="couponsPagination.total_page"
        :total="couponsPagination.total"
        :page-size="couponsPagination.page_size"
        :page-size-options="pageSizeOptions"
        @change-page="changeCouponsPage"
        @change-page-size="changeCouponsPageSize"
      />
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
            <Button type="submit" class="w-full md:w-auto" :disabled="walletSubmitting">
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

      <div class="rounded-xl border border-border bg-card overflow-x-auto">
        <Table class="min-w-[920px]">
          <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <TableRow>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.id') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.type') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.direction') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.amount') }}</TableHead>
              <TableHead class="px-6 py-3">{{ t('admin.userDetail.wallet.table.balanceAfter') }}</TableHead>
              <TableHead class="px-6 py-3 min-w-[220px]">{{ t('admin.userDetail.wallet.table.remark') }}</TableHead>
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
              <TableCell class="min-w-[220px] px-6 py-4 text-xs text-muted-foreground break-words">{{ item.remark || '-' }}</TableCell>
              <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.created_at) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <ListPagination
          :page="walletPagination.page"
          :total-page="walletPagination.total_page"
          :total="walletPagination.total"
          :page-size="walletPagination.page_size"
          :page-size-options="pageSizeOptions"
          @change-page="changeWalletPage"
          @change-page-size="changeWalletPageSize"
        />
      </div>
    </div>
  </div>
</template>
