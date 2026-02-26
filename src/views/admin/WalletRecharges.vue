<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { paymentStatusClass, paymentStatusLabel } from '@/utils/status'
import { formatDate, toRFC3339 } from '@/utils/format'

const { t } = useI18n()
const loading = ref(true)
const recharges = ref<any[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const jumpPage = ref('')
const adminPath = import.meta.env.VITE_ADMIN_PATH || ''

const filters = reactive({
  rechargeNo: '',
  userId: '',
  userKeyword: '',
  paymentId: '',
  channelId: '',
  providerType: '__all__',
  status: '__all__',
  createdFrom: '',
  createdTo: '',
  paidFrom: '',
  paidTo: '',
})

const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const fetchRecharges = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getWalletRecharges({
      page,
      page_size: pagination.value.page_size,
      recharge_no: filters.rechargeNo || undefined,
      user_id: filters.userId || undefined,
      user_keyword: filters.userKeyword || undefined,
      payment_id: filters.paymentId || undefined,
      channel_id: filters.channelId || undefined,
      provider_type: normalizeFilterValue(filters.providerType) || undefined,
      status: normalizeFilterValue(filters.status) || undefined,
      created_from: toRFC3339(filters.createdFrom),
      created_to: toRFC3339(filters.createdTo),
      paid_from: toRFC3339(filters.paidFrom),
      paid_to: toRFC3339(filters.paidTo),
    })
    recharges.value = (response.data.data as any[]) || []
    pagination.value = response.data.pagination || pagination.value
  } catch (error) {
    recharges.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchRecharges(1)
}

const refresh = () => {
  fetchRecharges(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchRecharges(page)
}

const jumpToPage = () => {
  if (!jumpPage.value) return
  const raw = Number(jumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), pagination.value.total_page)
  if (target === pagination.value.page) return
  changePage(target)
}

const userLink = (userID: number) => `${adminPath}/users/${userID}`
const paymentLink = (paymentID: number) => `${adminPath}/payments?payment_id=${paymentID}`
const channelLink = (channelID: number) => `${adminPath}/payment-channels?channel_id=${channelID}`

const statusClass = (status?: string) => paymentStatusClass(status)
const statusLabel = (status?: string) => paymentStatusLabel(t, status)

const providerTypeLabel = (value?: string) => {
  const map: Record<string, string> = {
    official: t('admin.paymentChannels.providerTypes.official'),
    epay: t('admin.paymentChannels.providerTypes.epay'),
    epusdt: t('admin.paymentChannels.providerTypes.epusdt'),
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
    'usdt-trc20': t('admin.paymentChannels.channelTypes.usdtTrc20'),
    'usdc-trc20': t('admin.paymentChannels.channelTypes.usdcTrc20'),
    trx: t('admin.paymentChannels.channelTypes.trx'),
    balance: t('admin.paymentChannels.channelTypes.balance'),
  }
  if (!value) return '-'
  return map[value] || value
}

onMounted(() => {
  fetchRecharges()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.walletRecharges.title') }}</h1>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-44">
          <Input v-model="filters.rechargeNo" :placeholder="t('admin.walletRecharges.filterRechargeNo')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-32">
          <Input v-model="filters.userId" :placeholder="t('admin.walletRecharges.filterUserId')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-48">
          <Input v-model="filters.userKeyword" :placeholder="t('admin.walletRecharges.filterUserKeyword')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-40">
          <Input v-model="filters.paymentId" :placeholder="t('admin.walletRecharges.filterPaymentId')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-40">
          <Input v-model="filters.channelId" :placeholder="t('admin.walletRecharges.filterChannelId')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-40">
          <Select v-model="filters.providerType" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.walletRecharges.filterProviderAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.walletRecharges.filterProviderAll') }}</SelectItem>
              <SelectItem value="official">{{ t('admin.paymentChannels.providerTypes.official') }}</SelectItem>
              <SelectItem value="epay">{{ t('admin.paymentChannels.providerTypes.epay') }}</SelectItem>
              <SelectItem value="epusdt">{{ t('admin.paymentChannels.providerTypes.epusdt') }}</SelectItem>
              <SelectItem value="wallet">{{ t('admin.paymentChannels.providerTypes.wallet') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-full md:w-40">
          <Select v-model="filters.status" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.walletRecharges.filterStatusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.walletRecharges.filterStatusAll') }}</SelectItem>
              <SelectItem value="pending">{{ t('payment.status.pending') }}</SelectItem>
              <SelectItem value="success">{{ t('payment.status.success') }}</SelectItem>
              <SelectItem value="failed">{{ t('payment.status.failed') }}</SelectItem>
              <SelectItem value="expired">{{ t('payment.status.expired') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-muted-foreground whitespace-nowrap">{{ t('admin.walletRecharges.filterCreatedRange') }}</span>
          <Input
            v-model="filters.createdFrom"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            :placeholder="t('admin.walletRecharges.filterCreatedFrom')"
            @update:modelValue="handleSearch"
          />
          <span class="text-muted-foreground">-</span>
          <Input
            v-model="filters.createdTo"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            :placeholder="t('admin.walletRecharges.filterCreatedTo')"
            @update:modelValue="handleSearch"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-muted-foreground whitespace-nowrap">{{ t('admin.walletRecharges.filterPaidRange') }}</span>
          <Input
            v-model="filters.paidFrom"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            :placeholder="t('admin.walletRecharges.filterPaidFrom')"
            @update:modelValue="handleSearch"
          />
          <span class="text-muted-foreground">-</span>
          <Input
            v-model="filters.paidTo"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            :placeholder="t('admin.walletRecharges.filterPaidTo')"
            @update:modelValue="handleSearch"
          />
        </div>
        <div class="flex-1"></div>
        <Button size="sm" variant="outline" @click="refresh">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.walletRecharges.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.walletRecharges.table.rechargeNo') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.walletRecharges.table.user') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.walletRecharges.table.payment') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.walletRecharges.table.channel') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.walletRecharges.table.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.walletRecharges.table.amount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.walletRecharges.table.paidAt') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.walletRecharges.table.createdAt') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="9" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="recharges.length === 0">
            <TableCell colspan="9" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.walletRecharges.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="item in recharges" :key="item.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="item.id" />
            </TableCell>
            <TableCell class="px-6 py-4 text-foreground font-mono">
              {{ item.recharge_no }}
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div class="text-foreground">
                <a v-if="item.user_id" :href="userLink(item.user_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                  #{{ item.user_id }}
                </a>
                <span v-else>-</span>
              </div>
              <div v-if="item.user?.display_name" class="text-foreground mt-0.5">{{ item.user.display_name }}</div>
              <div v-if="item.user?.email" class="mt-0.5">{{ item.user.email }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div class="text-foreground">
                <a v-if="item.payment_id" :href="paymentLink(item.payment_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                  #{{ item.payment_id }}
                </a>
                <span v-else>-</span>
              </div>
              <div v-if="item.payment_status" class="mt-1">
                <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(item.payment_status)">
                  {{ statusLabel(item.payment_status) }}
                </span>
              </div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div class="text-foreground">{{ item.channel_name || '-' }}</div>
              <div class="text-muted-foreground">{{ providerTypeLabel(item.provider_type) }} / {{ channelTypeLabel(item.channel_type) }}</div>
              <div class="mt-1">
                {{ t('admin.walletRecharges.channelId') }}:
                <a v-if="item.channel_id" :href="channelLink(item.channel_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                  #{{ item.channel_id }}
                </a>
                <span v-else>-</span>
              </div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(item.status)">
                {{ statusLabel(item.status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div class="font-mono text-foreground">{{ item.amount }} {{ item.currency }}</div>
              <div class="mt-1">{{ t('admin.walletRecharges.payableAmount') }}: <span class="font-mono text-foreground">{{ item.payable_amount }} {{ item.currency }}</span></div>
              <div class="mt-1">{{ t('admin.walletRecharges.feeAmount') }}: <span class="font-mono text-foreground">{{ item.fee_amount }} {{ item.currency }}</span></div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.paid_at) || '-' }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.created_at) }}</TableCell>
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
            <Button variant="outline" size="sm" class="h-8" :disabled="pagination.page >= pagination.total_page" @click="changePage(pagination.page + 1)">
              {{ t('admin.common.nextPage') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
