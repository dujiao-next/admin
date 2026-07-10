<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminPaymentChannel } from '@/api/types'
import { getImageUrl } from '@/utils/image'
import { resolveOkpayConfiguredCoin } from '@/utils/paymentChannelDisplay'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import ListPagination from '@/components/ListPagination.vue'
import { useListRefresh, type ListFetchOptions } from '@/composables/useListRefresh'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { confirmAction } from '@/utils/confirm'
import PaymentChannelModal from './components/PaymentChannelModal.vue'
import ComplianceGuardWrapper from '@/components/ComplianceGuardWrapper.vue'

const loading = ref(true)
const { refreshing, refreshList } = useListRefresh()
const channels = ref<AdminPaymentChannel[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const filters = reactive({
  providerType: '__all__',
  channelType: '__all__',
})
const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const route = useRoute()
const showModal = ref(false)
const editingId = ref<number | null>(null)
const { t } = useI18n()

const fetchChannels = async (page = 1, options: ListFetchOptions = {}) => {
  if (!options.preserveRows) loading.value = true
  try {
    const response = await adminAPI.getPaymentChannels({
      page,
      page_size: pagination.value.page_size,
      provider_type: normalizeFilterValue(filters.providerType) || undefined,
      channel_type: normalizeFilterValue(filters.channelType) || undefined,
    })
    channels.value = response.data.data || []
    pagination.value = response.data.pagination || pagination.value
  } catch (error) {
    if (!options.preserveRows) channels.value = []
  } finally {
    if (!options.preserveRows) loading.value = false
  }
}

const handleSearch = () => {
  fetchChannels(1)
}

const refresh = () => {
  refreshList(() => fetchChannels(pagination.value.page, { preserveRows: true }))
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchChannels(page)
}

const pageSizeOptions = [10, 20, 50, 100]

const changePageSize = (size: number) => {
  if (size === pagination.value.page_size) return
  pagination.value.page_size = size
  fetchChannels(1)
}

const providerTypeLabel = (value?: string) => {
  const map: Record<string, string> = {
    official: t('admin.paymentChannels.providerTypes.official'),
    epay: t('admin.paymentChannels.providerTypes.epay'),
    bepusdt: t('admin.paymentChannels.providerTypes.bepusdt'),
    epusdt: t('admin.paymentChannels.providerTypes.epusdt'),
    okpay: t('admin.paymentChannels.providerTypes.okpay'),
    dujiaopay: t('admin.paymentChannels.providerTypes.dujiaopay'),
    tokenpay: t('admin.paymentChannels.providerTypes.tokenpay'),
  }
  return map[value || ''] || value || '-'
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
    bepusdt: t('admin.paymentChannels.channelTypes.bepusdtCashier'),
    'tron-usdt': t('admin.paymentChannels.channelTypes.tronUsdt'),
    'tron-trx': t('admin.paymentChannels.channelTypes.tronTrx'),
    'ethereum-usdt': t('admin.paymentChannels.channelTypes.ethereumUsdt'),
    'ethereum-usdc': t('admin.paymentChannels.channelTypes.ethereumUsdc'),
    'ethereum-eth': t('admin.paymentChannels.channelTypes.ethereumEth'),
    'bsc-usdt': t('admin.paymentChannels.channelTypes.bscUsdt'),
    'bsc-bnb': t('admin.paymentChannels.channelTypes.bscBnb'),
    'polygon-usdc': t('admin.paymentChannels.channelTypes.polygonUsdc'),
    'polygon-usdt0': t('admin.paymentChannels.channelTypes.polygonUsdt0'),
    'base-usdc': t('admin.paymentChannels.channelTypes.baseUsdc'),
    'arbitrum-usdc': t('admin.paymentChannels.channelTypes.arbitrumUsdc'),
    'arbitrum-usdt0': t('admin.paymentChannels.channelTypes.arbitrumUsdt0'),
    'plasma-usdt0': t('admin.paymentChannels.channelTypes.plasmaUsdt0'),
    'x-layer-usdt0': t('admin.paymentChannels.channelTypes.xLayerUsdt0'),
    'solana-usdc': t('admin.paymentChannels.channelTypes.solanaUsdc'),
    'solana-usdt': t('admin.paymentChannels.channelTypes.solanaUsdt'),
    'aptos-usdc': t('admin.paymentChannels.channelTypes.aptosUsdc'),
    'aptos-usdt': t('admin.paymentChannels.channelTypes.aptosUsdt'),
  }
  return map[value || ''] || value || '-'
}

const resolveChannelTypeDisplay = (channel: AdminPaymentChannel) => {
  if (channel.provider_type === 'tokenpay') {
    const currency = String(channel.config_json?.currency || '').trim().toUpperCase()
    return currency || 'USDT'
  }
  if (channel.provider_type === 'bepusdt') {
    const orderMode = String(channel.config_json?.order_mode || '').trim()
    if (orderMode === 'cashier') {
      return channelTypeLabel('bepusdt')
    }
    const tradeType = String(channel.config_json?.trade_type || '').trim()
    return tradeType || channelTypeLabel(channel.channel_type)
  }
  if (channel.provider_type === 'epusdt') {
    const tradeType = String(channel.config_json?.trade_type || '').trim()
    return tradeType || 'usdt.trc20'
  }
  if (channel.provider_type === 'okpay') {
    const coin = resolveOkpayConfiguredCoin(channel.config_json)
    return coin || channelTypeLabel(channel.channel_type)
  }
  if (channel.provider_type === 'dujiaopay') {
    const tokenID = String(channel.config_json?.token_id || channel.channel_type || '').trim()
    return channelTypeLabel(tokenID)
  }
  return channelTypeLabel(channel.channel_type)
}

const interactionModeLabel = (value?: string) => {
  const map: Record<string, string> = {
    qr: t('admin.paymentChannels.interactionModes.qr'),
    redirect: t('admin.paymentChannels.interactionModes.redirect'),
    wap: t('admin.paymentChannels.interactionModes.wap'),
    page: t('admin.paymentChannels.interactionModes.page'),
  }
  return map[value || ''] || value || '-'
}

const formatFeeRate = (channel: AdminPaymentChannel) => {
  const feeRate = channel.fee_rate
  const fixedFee = channel.fixed_fee

  let display = '-'
  if (feeRate !== undefined && feeRate !== null && feeRate !== '') {
    const rateParsed = Number(feeRate)
    if (!Number.isNaN(rateParsed)) {
      display = `${rateParsed.toFixed(2)}%`
    }
  }

  if (fixedFee !== undefined && fixedFee !== null && fixedFee !== '') {
    const fixedParsed = Number(fixedFee)
    if (!Number.isNaN(fixedParsed) && fixedParsed > 0) {
      if (display === '-') {
        display = fixedParsed.toFixed(2)
      } else {
        display += ` + ${fixedParsed.toFixed(2)}`
      }
    }
  }

  return display
}

const openCreateModal = () => {
  editingId.value = null
  showModal.value = true
}

const openEditModal = (channel: AdminPaymentChannel) => {
  editingId.value = channel.id
  showModal.value = true
}

const handleModalSuccess = () => {
  fetchChannels(pagination.value.page)
}

const handleDelete = async (channel: AdminPaymentChannel) => {
  const confirmed = await confirmAction({ description: t('admin.paymentChannels.confirmDelete', { name: channel.name }), confirmText: t('admin.common.delete'), variant: 'destructive' })
  if (!confirmed) return
  await adminAPI.deletePaymentChannel(channel.id)
  fetchChannels(pagination.value.page)
}

const openEditById = async (rawId: unknown) => {
  const id = Number(rawId)
  if (!Number.isFinite(id) || id <= 0) return
  editingId.value = id
  showModal.value = true
}

onMounted(() => {
  fetchChannels()
  openEditById(route.query.channel_id)
})

watch(
  () => route.query.channel_id,
  (value) => {
    if (value) {
      openEditById(value)
    }
  }
)
</script>

<template>
  <ComplianceGuardWrapper>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.paymentChannels.title') }}</h1>
      <Button class="w-full gap-2 sm:w-auto" @click="openCreateModal">
        <span>{{ t('admin.paymentChannels.create') }}</span>
      </Button>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="w-full md:w-56">
          <Select v-model="filters.providerType" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.paymentChannels.filterProviderAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.paymentChannels.filterProviderAll') }}</SelectItem>
              <SelectItem value="official">{{ t('admin.paymentChannels.providerTypes.official') }}</SelectItem>
              <SelectItem value="dujiaopay">
                <span class="flex w-full items-center justify-between gap-2">
                  <span>{{ t('admin.paymentChannels.providerTypes.dujiaopay') }}</span>
                  <span class="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-600 dark:text-emerald-400">
                    {{ t('admin.paymentChannels.providerOfficialCertified') }}
                  </span>
                </span>
              </SelectItem>
              <SelectItem value="epay">{{ t('admin.paymentChannels.providerTypes.epay') }}</SelectItem>
              <SelectItem value="bepusdt">{{ t('admin.paymentChannels.providerTypes.bepusdt') }}</SelectItem>
              <SelectItem value="epusdt">{{ t('admin.paymentChannels.providerTypes.epusdt') }}</SelectItem>
              <SelectItem value="okpay">{{ t('admin.paymentChannels.providerTypes.okpay') }}</SelectItem>
              <SelectItem value="tokenpay">{{ t('admin.paymentChannels.providerTypes.tokenpay') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-full md:w-56">
          <Select v-model="filters.channelType" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
            <SelectValue :placeholder="t('admin.paymentChannels.filterChannelAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.paymentChannels.filterChannelAll') }}</SelectItem>
              <SelectItem value="wechat">{{ t('admin.paymentChannels.channelTypes.wechat') }}</SelectItem>
              <SelectItem value="alipay">{{ t('admin.paymentChannels.channelTypes.alipay') }}</SelectItem>
              <SelectItem value="qqpay">{{ t('admin.paymentChannels.channelTypes.qqpay') }}</SelectItem>
              <SelectItem value="paypal">{{ t('admin.paymentChannels.channelTypes.paypal') }}</SelectItem>
              <SelectItem value="stripe">{{ t('admin.paymentChannels.channelTypes.stripe') }}</SelectItem>
              <SelectItem value="usdt">{{ t('admin.paymentChannels.channelTypes.usdt') }}</SelectItem>
              <SelectItem value="usdt-trc20">{{ t('admin.paymentChannels.channelTypes.usdtTrc20') }}</SelectItem>
              <SelectItem value="usdc-trc20">{{ t('admin.paymentChannels.channelTypes.usdcTrc20') }}</SelectItem>
              <SelectItem value="trx">{{ t('admin.paymentChannels.channelTypes.trx') }}</SelectItem>
              <SelectItem value="tron-usdt">{{ t('admin.paymentChannels.channelTypes.tronUsdt') }}</SelectItem>
              <SelectItem value="tron-trx">{{ t('admin.paymentChannels.channelTypes.tronTrx') }}</SelectItem>
              <SelectItem value="ethereum-usdt">{{ t('admin.paymentChannels.channelTypes.ethereumUsdt') }}</SelectItem>
              <SelectItem value="ethereum-usdc">{{ t('admin.paymentChannels.channelTypes.ethereumUsdc') }}</SelectItem>
              <SelectItem value="base-usdc">{{ t('admin.paymentChannels.channelTypes.baseUsdc') }}</SelectItem>
              <SelectItem value="solana-usdt">{{ t('admin.paymentChannels.channelTypes.solanaUsdt') }}</SelectItem>
              <SelectItem value="aptos-usdt">{{ t('admin.paymentChannels.channelTypes.aptosUsdt') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="hidden flex-1 sm:block"></div>
        <Button size="sm" variant="outline" class="w-full sm:w-auto" :disabled="refreshing" @click="refresh">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[980px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.paymentChannels.table.id') }}</TableHead>
            <TableHead class="min-w-[220px] px-6 py-3">{{ t('admin.paymentChannels.table.name') }}</TableHead>
            <TableHead class="min-w-[220px] px-6 py-3">{{ t('admin.paymentChannels.table.type') }}</TableHead>
            <TableHead class="min-w-[140px] px-6 py-3">{{ t('admin.paymentChannels.table.interaction') }}</TableHead>
            <TableHead class="min-w-[120px] px-6 py-3">{{ t('admin.paymentChannels.table.feeRate') }}</TableHead>
            <TableHead class="min-w-[120px] px-6 py-3">{{ t('admin.paymentChannels.table.status') }}</TableHead>
            <TableHead class="min-w-[120px] px-6 py-3">{{ t('admin.paymentChannels.table.sort') }}</TableHead>
            <TableHead class="min-w-[160px] px-6 py-3 text-right">{{ t('admin.paymentChannels.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell :colspan="8" class="p-0">
              <TableSkeleton :columns="8" :rows="5" />
            </TableCell>
          </TableRow>
          <TableRow v-else-if="channels.length === 0">
            <TableCell colspan="8" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.paymentChannels.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="channel in channels" :key="channel.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="channel.id" />
            </TableCell>
            <TableCell class="min-w-[220px] px-6 py-4">
              <div class="flex items-center gap-2">
                <img v-if="channel.icon" :src="getImageUrl(channel.icon)" class="h-6 w-6 shrink-0 rounded object-contain" />
                <span class="break-words font-medium text-foreground">{{ channel.name }}</span>
              </div>
            </TableCell>
            <TableCell class="min-w-[220px] px-6 py-4 text-xs text-muted-foreground">
              <div class="break-words">{{ providerTypeLabel(channel.provider_type) }}</div>
              <div class="break-words text-muted-foreground">{{ resolveChannelTypeDisplay(channel) }}</div>
            </TableCell>
            <TableCell class="min-w-[140px] px-6 py-4 text-xs text-muted-foreground">{{ interactionModeLabel(channel.interaction_mode) }}</TableCell>
            <TableCell class="min-w-[120px] px-6 py-4 text-xs text-muted-foreground">{{ formatFeeRate(channel) }}</TableCell>
            <TableCell class="min-w-[120px] px-6 py-4">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="channel.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-muted-foreground border-border bg-muted/30'">
                {{ channel.is_active ? t('admin.common.enabled') : t('admin.common.disabled') }}
              </span>
            </TableCell>
            <TableCell class="min-w-[120px] px-6 py-4 text-xs text-muted-foreground">{{ channel.sort_order }}</TableCell>
            <TableCell class="min-w-[160px] px-6 py-4 text-right">
              <div class="flex flex-wrap items-center justify-end gap-2">
                <Button size="sm" variant="outline" @click="openEditModal(channel)">
                  {{ t('admin.common.edit') }}
                </Button>
                <Button size="sm" variant="destructive" @click="handleDelete(channel)">
                  {{ t('admin.common.delete') }}
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

    <PaymentChannelModal
      v-model="showModal"
      :channel-id="editingId"
      @success="handleModalSuccess"
    />
  </div>
  </ComplianceGuardWrapper>
</template>
