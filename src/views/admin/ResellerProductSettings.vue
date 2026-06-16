<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type {
  AdminResellerProductSetting,
  AdminResellerProductSettingDetail,
  AdminResellerProductSettingPayloadItem,
  AdminResellerProductSettingRule,
  AdminResellerProductSettingSKU,
} from '@/api/types'
import {
  RESELLER_PRICING_MODE_FIXED_MARKUP,
  RESELLER_PRICING_MODE_FIXED_PRICE,
  RESELLER_PRICING_MODE_INHERIT,
  RESELLER_PRICING_MODE_MARKUP_PERCENT,
} from '@/constants/reseller'
import IdCell from '@/components/IdCell.vue'
import ListPagination from '@/components/ListPagination.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useListRefresh, type ListFetchOptions } from '@/composables/useListRefresh'
import { confirmAction } from '@/utils/confirm'
import { formatDate, getLocalizedText } from '@/utils/format'
import { notifyError, notifySuccess } from '@/utils/notify'
import {
  buildResellerProductSettingStatusClass,
  getAdminResellerProductSettingOwnerLabel,
} from '@/utils/resellerProductSettings'

const { t } = useI18n()
const loading = ref(true)
const { refreshing, refreshList } = useListRefresh()
const rows = ref<AdminResellerProductSetting[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const operatingId = ref<number | null>(null)
const saving = ref(false)
const showEditor = ref(false)
const selectedScope = ref<{ resellerId: number; productId: number } | null>(null)
const detail = ref<AdminResellerProductSettingDetail | null>(null)
const productForm = ref<AdminResellerProductSettingPayloadItem>(createBlankForm(0))
const skuForms = reactive<Record<number, AdminResellerProductSettingPayloadItem>>({})

const filters = reactive({
  keyword: '',
  resellerId: '',
  userId: '',
  productId: '',
  pricingMode: '__all__',
  listed: '__all__',
})

const pageSizeOptions = [10, 20, 50, 100]
const pricingModes = [
  RESELLER_PRICING_MODE_INHERIT,
  RESELLER_PRICING_MODE_MARKUP_PERCENT,
  RESELLER_PRICING_MODE_FIXED_MARKUP,
  RESELLER_PRICING_MODE_FIXED_PRICE,
]

function createBlankForm(skuID: number): AdminResellerProductSettingPayloadItem {
  return {
    sku_id: skuID,
    is_listed: true,
    pricing_mode: RESELLER_PRICING_MODE_INHERIT,
    markup_percent: '0.00',
    fixed_markup_amount: '0.00',
    fixed_price_amount: '0.00',
    sort_order: 0,
  }
}

const moneyOrZero = (value?: string | number) => {
  const normalized = String(value ?? '').trim()
  return normalized || '0.00'
}

const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const formFromRule = (
  rule: AdminResellerProductSettingRule | undefined,
  skuID: number,
): AdminResellerProductSettingPayloadItem => ({
  sku_id: skuID,
  is_listed: rule?.is_listed !== false,
  pricing_mode: String(rule?.pricing_mode || RESELLER_PRICING_MODE_INHERIT),
  markup_percent: moneyOrZero(rule?.markup_percent),
  fixed_markup_amount: moneyOrZero(rule?.fixed_markup_amount),
  fixed_price_amount: moneyOrZero(rule?.fixed_price_amount),
  sort_order: Number(rule?.sort_order || 0),
})

const clearSkuForms = () => {
  Object.keys(skuForms).forEach((key) => {
    delete skuForms[Number(key)]
  })
}

const skuFormFor = (skuID: number): AdminResellerProductSettingPayloadItem => {
  if (!skuForms[skuID]) {
    skuForms[skuID] = createBlankForm(skuID)
  }
  return skuForms[skuID]
}

const updateSkuForm = (skuID: number, value: AdminResellerProductSettingPayloadItem) => {
  skuForms[skuID] = value
}

const applyDetailToEditor = (source: AdminResellerProductSettingDetail) => {
  detail.value = source
  productForm.value = formFromRule(source.product_setting, 0)
  clearSkuForms()
  source.skus.forEach((sku) => {
    skuForms[sku.id] = formFromRule(sku.setting, sku.id)
  })
}

const buildPayload = () => ({
  settings: [
    productForm.value,
    ...(detail.value?.skus || []).map((sku) => skuFormFor(sku.id)),
  ],
})

const fetchRows = async (page = 1, options: ListFetchOptions = {}) => {
  if (!options.preserveRows) loading.value = true
  try {
    const response = await adminAPI.getResellerProductSettings({
      page,
      page_size: pagination.value.page_size,
      keyword: filters.keyword || undefined,
      reseller_id: filters.resellerId || undefined,
      user_id: filters.userId || undefined,
      product_id: filters.productId || undefined,
      pricing_mode: normalizeFilterValue(filters.pricingMode) || undefined,
      listed: normalizeFilterValue(filters.listed) || undefined,
    })
    rows.value = response.data.data || []
    pagination.value = response.data.pagination || pagination.value
  } catch (err: any) {
    if (!options.preserveRows) rows.value = []
    notifyError(err?.message || t('admin.resellerProductSettings.actions.loadFailed'))
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

const productTitle = (row: AdminResellerProductSetting) =>
  getLocalizedText(row.product?.title) || `#${row.product_id}`

const productDetailTitle = () =>
  detail.value ? getLocalizedText(detail.value.product.title) || `#${detail.value.product.id}` : '-'

const skuLabel = (sku: AdminResellerProductSettingSKU) => {
  const specs = Object.values(sku.spec_values || {})
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(' / ')
  return specs || sku.sku_code || `#${sku.id}`
}

const pricingModeKey = (mode?: string) => {
  if (mode === RESELLER_PRICING_MODE_INHERIT) return 'inherit'
  if (mode === RESELLER_PRICING_MODE_MARKUP_PERCENT) return 'markupPercent'
  if (mode === RESELLER_PRICING_MODE_FIXED_MARKUP) return 'fixedMarkup'
  if (mode === RESELLER_PRICING_MODE_FIXED_PRICE) return 'fixedPrice'
  return 'unknown'
}

const pricingModeLabel = (mode?: string) =>
  t(`admin.resellerProductSettings.modes.${pricingModeKey(mode)}`)

const pricingValue = (row: {
  pricing_mode: string
  markup_percent: string | number
  fixed_markup_amount: string | number
  fixed_price_amount: string | number
}) => {
  if (row.pricing_mode === RESELLER_PRICING_MODE_MARKUP_PERCENT) return `${row.markup_percent}%`
  if (row.pricing_mode === RESELLER_PRICING_MODE_FIXED_MARKUP) return `+${row.fixed_markup_amount}`
  if (row.pricing_mode === RESELLER_PRICING_MODE_FIXED_PRICE) return String(row.fixed_price_amount)
  return '-'
}

const openEditor = async (row: AdminResellerProductSetting) => {
  operatingId.value = row.id
  selectedScope.value = { resellerId: row.reseller_id, productId: row.product_id }
  try {
    const response = await adminAPI.getResellerProductSetting(row.reseller_id, row.product_id)
    applyDetailToEditor(response.data.data as AdminResellerProductSettingDetail)
    showEditor.value = true
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerProductSettings.actions.loadFailed'))
  } finally {
    operatingId.value = null
  }
}

const reloadEditor = async () => {
  if (!selectedScope.value) return
  const response = await adminAPI.getResellerProductSetting(selectedScope.value.resellerId, selectedScope.value.productId)
  applyDetailToEditor(response.data.data as AdminResellerProductSettingDetail)
}

const saveSettings = async () => {
  if (!selectedScope.value) return
  saving.value = true
  try {
    const response = await adminAPI.updateResellerProductSettings(
      selectedScope.value.resellerId,
      selectedScope.value.productId,
      buildPayload(),
    )
    applyDetailToEditor(response.data.data as AdminResellerProductSettingDetail)
    notifySuccess(t('admin.resellerProductSettings.actions.saveSuccess'))
    await fetchRows(pagination.value.page, { preserveRows: true })
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerProductSettings.actions.saveFailed'))
  } finally {
    saving.value = false
  }
}

const resetSetting = async (row: AdminResellerProductSetting) => {
  const confirmed = await confirmAction({
    description: t('admin.resellerProductSettings.actions.resetConfirm'),
    variant: 'destructive',
  })
  if (!confirmed) return
  operatingId.value = row.id
  try {
    await adminAPI.resetResellerProductSetting(row.reseller_id, row.product_id, row.sku_id)
    notifySuccess(t('admin.resellerProductSettings.actions.resetSuccess'))
    await fetchRows(pagination.value.page, { preserveRows: true })
    if (selectedScope.value?.resellerId === row.reseller_id && selectedScope.value.productId === row.product_id) {
      await reloadEditor()
    }
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerProductSettings.actions.resetFailed'))
  } finally {
    operatingId.value = null
  }
}

const closeEditor = () => {
  selectedScope.value = null
  detail.value = null
  productForm.value = createBlankForm(0)
  clearSkuForms()
}

onMounted(() => {
  fetchRows()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ t('admin.resellerProductSettings.title') }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('admin.resellerProductSettings.subtitle') }}</p>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="w-full md:w-64">
          <Input v-model="filters.keyword" :placeholder="t('admin.resellerProductSettings.filters.keyword')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-32">
          <Input v-model="filters.resellerId" :placeholder="t('admin.resellerProductSettings.filters.resellerId')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-32">
          <Input v-model="filters.userId" :placeholder="t('admin.resellerProductSettings.filters.userId')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-32">
          <Input v-model="filters.productId" :placeholder="t('admin.resellerProductSettings.filters.productId')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-48">
          <Select v-model="filters.pricingMode" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.resellerProductSettings.filters.pricingMode')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.resellerProductSettings.filters.all') }}</SelectItem>
              <SelectItem v-for="mode in pricingModes" :key="mode" :value="mode">{{ pricingModeLabel(mode) }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-full md:w-36">
          <Select v-model="filters.listed" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.resellerProductSettings.filters.listed')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.resellerProductSettings.filters.all') }}</SelectItem>
              <SelectItem value="listed">{{ t('admin.resellerProductSettings.status.listed') }}</SelectItem>
              <SelectItem value="hidden">{{ t('admin.resellerProductSettings.status.hidden') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="hidden flex-1 sm:block"></div>
        <Button size="sm" variant="outline" class="w-full sm:w-auto" :disabled="refreshing" @click="refreshCurrentPage">
          {{ t('admin.common.refresh') }}
        </Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[1320px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.resellerProductSettings.columns.id') }}</TableHead>
            <TableHead class="min-w-[190px] px-6 py-3">{{ t('admin.resellerProductSettings.columns.owner') }}</TableHead>
            <TableHead class="min-w-[220px] px-6 py-3">{{ t('admin.resellerProductSettings.columns.product') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.resellerProductSettings.columns.sku') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.resellerProductSettings.columns.listed') }}</TableHead>
            <TableHead class="min-w-[150px] px-6 py-3">{{ t('admin.resellerProductSettings.columns.pricingMode') }}</TableHead>
            <TableHead class="min-w-[130px] px-6 py-3">{{ t('admin.resellerProductSettings.columns.pricingValue') }}</TableHead>
            <TableHead class="min-w-[170px] px-6 py-3">{{ t('admin.resellerProductSettings.columns.updatedAt') }}</TableHead>
            <TableHead class="min-w-[160px] px-6 py-3 text-right">{{ t('admin.resellerProductSettings.columns.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <template v-if="loading">
            <TableRow v-for="n in 5" :key="n">
              <TableCell colspan="9" class="px-6 py-4">
                <TableSkeleton :rows="1" />
              </TableCell>
            </TableRow>
          </template>
          <template v-else-if="rows.length">
            <TableRow v-for="item in rows" :key="item.id">
              <TableCell class="px-6 py-4">
                <IdCell :value="item.id" />
              </TableCell>
              <TableCell class="px-6 py-4">
                <div class="font-medium text-foreground">#{{ item.reseller_id }}</div>
                <div class="break-all text-xs text-muted-foreground">{{ getAdminResellerProductSettingOwnerLabel(item) }}</div>
              </TableCell>
              <TableCell class="px-6 py-4">
                <div class="font-medium text-foreground">{{ productTitle(item) }}</div>
                <div class="mt-1 text-xs text-muted-foreground">#{{ item.product_id }} / {{ item.product?.slug || '-' }}</div>
              </TableCell>
              <TableCell class="px-6 py-4 font-mono text-sm text-muted-foreground">
                {{ item.sku_id || 0 }}
              </TableCell>
              <TableCell class="px-6 py-4">
                <span class="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold" :class="buildResellerProductSettingStatusClass(item.is_listed)">
                  {{ item.is_listed ? t('admin.resellerProductSettings.status.listed') : t('admin.resellerProductSettings.status.hidden') }}
                </span>
              </TableCell>
              <TableCell class="px-6 py-4 text-sm text-foreground">{{ pricingModeLabel(item.pricing_mode) }}</TableCell>
              <TableCell class="px-6 py-4 font-mono text-sm text-muted-foreground">{{ pricingValue(item) }}</TableCell>
              <TableCell class="px-6 py-4 text-sm text-muted-foreground">{{ formatDate(item.updated_at) }}</TableCell>
              <TableCell class="px-6 py-4">
                <div class="flex justify-end gap-2">
                  <Button size="sm" variant="outline" :disabled="operatingId === item.id" @click="openEditor(item)">
                    {{ t('admin.resellerProductSettings.actions.edit') }}
                  </Button>
                  <Button size="sm" variant="outline" class="text-destructive" :disabled="operatingId === item.id" @click="resetSetting(item)">
                    {{ t('admin.resellerProductSettings.actions.reset') }}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell colspan="9" class="px-6 py-12 text-center text-sm text-muted-foreground">
              {{ t('admin.resellerProductSettings.empty') }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ListPagination
      :page="pagination.page"
      :total-page="pagination.total_page"
      :total="pagination.total"
      :page-size="pagination.page_size"
      :page-size-options="pageSizeOptions"
      @change-page="changePage"
      @change-page-size="changePageSize"
    />

    <Dialog v-model:open="showEditor" @update:open="(value) => { if (!value) closeEditor() }">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-6xl p-4 sm:p-6" @interact-outside="(event) => event.preventDefault()">
        <DialogHeader>
          <DialogTitle>
            {{ t('admin.resellerProductSettings.actions.edit') }} · #{{ selectedScope?.resellerId || '-' }} / {{ productDetailTitle() }}
          </DialogTitle>
        </DialogHeader>

        <div v-if="detail" class="space-y-4">
          <section class="rounded-lg border border-border p-4">
            <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 class="text-sm font-semibold text-foreground">{{ t('admin.resellerProductSettings.columns.product') }}</h2>
              <span class="text-xs text-muted-foreground">#{{ detail.product.id }} / {{ detail.product.slug }}</span>
            </div>
            <div class="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_120px_170px_repeat(3,minmax(120px,1fr))_96px] lg:items-end">
              <div>
                <Label>{{ t('admin.resellerProductSettings.columns.product') }}</Label>
                <div class="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                  {{ productDetailTitle() }}
                </div>
              </div>
              <div>
                <Label>{{ t('admin.resellerProductSettings.columns.listed') }}</Label>
                <div class="mt-2 flex h-9 items-center">
                  <Switch v-model="productForm.is_listed" />
                </div>
              </div>
              <div>
                <Label>{{ t('admin.resellerProductSettings.columns.pricingMode') }}</Label>
                <Select v-model="productForm.pricing_mode">
                  <SelectTrigger class="mt-2 h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="mode in pricingModes" :key="mode" :value="mode">{{ pricingModeLabel(mode) }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{{ t('admin.resellerProductSettings.modes.markupPercent') }}</Label>
                <Input v-model="productForm.markup_percent" class="mt-2 h-9 font-mono" />
              </div>
              <div>
                <Label>{{ t('admin.resellerProductSettings.modes.fixedMarkup') }}</Label>
                <Input v-model="productForm.fixed_markup_amount" class="mt-2 h-9 font-mono" />
              </div>
              <div>
                <Label>{{ t('admin.resellerProductSettings.modes.fixedPrice') }}</Label>
                <Input v-model="productForm.fixed_price_amount" class="mt-2 h-9 font-mono" />
              </div>
              <div>
                <Label>{{ t('admin.resellerProductSettings.columns.pricingValue') }}</Label>
                <div class="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm text-muted-foreground">
                  {{ pricingValue(productForm) }}
                </div>
              </div>
            </div>
          </section>

          <section class="space-y-3 rounded-lg border border-border p-4">
            <h2 class="text-sm font-semibold text-foreground">{{ t('admin.resellerProductSettings.columns.sku') }}</h2>
            <div v-if="detail.skus.length" class="space-y-3">
              <div
                v-for="sku in detail.skus"
                :key="sku.id"
                class="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[minmax(180px,1fr)_120px_170px_repeat(3,minmax(120px,1fr))_96px] lg:items-end"
              >
                <div>
                  <Label>{{ t('admin.resellerProductSettings.columns.sku') }}</Label>
                  <div class="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                    {{ skuLabel(sku) }}
                  </div>
                </div>
                <div>
                  <Label>{{ t('admin.resellerProductSettings.columns.listed') }}</Label>
                  <div class="mt-2 flex h-9 items-center">
                    <Switch :model-value="skuFormFor(sku.id).is_listed" @update:model-value="updateSkuForm(sku.id, { ...skuFormFor(sku.id), is_listed: Boolean($event) })" />
                  </div>
                </div>
                <div>
                  <Label>{{ t('admin.resellerProductSettings.columns.pricingMode') }}</Label>
                  <Select :model-value="skuFormFor(sku.id).pricing_mode" @update:modelValue="(value) => updateSkuForm(sku.id, { ...skuFormFor(sku.id), pricing_mode: String(value) })">
                    <SelectTrigger class="mt-2 h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="mode in pricingModes" :key="mode" :value="mode">{{ pricingModeLabel(mode) }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{{ t('admin.resellerProductSettings.modes.markupPercent') }}</Label>
                  <Input :model-value="skuFormFor(sku.id).markup_percent" class="mt-2 h-9 font-mono" @update:modelValue="(value) => updateSkuForm(sku.id, { ...skuFormFor(sku.id), markup_percent: String(value) })" />
                </div>
                <div>
                  <Label>{{ t('admin.resellerProductSettings.modes.fixedMarkup') }}</Label>
                  <Input :model-value="skuFormFor(sku.id).fixed_markup_amount" class="mt-2 h-9 font-mono" @update:modelValue="(value) => updateSkuForm(sku.id, { ...skuFormFor(sku.id), fixed_markup_amount: String(value) })" />
                </div>
                <div>
                  <Label>{{ t('admin.resellerProductSettings.modes.fixedPrice') }}</Label>
                  <Input :model-value="skuFormFor(sku.id).fixed_price_amount" class="mt-2 h-9 font-mono" @update:modelValue="(value) => updateSkuForm(sku.id, { ...skuFormFor(sku.id), fixed_price_amount: String(value) })" />
                </div>
                <div>
                  <Label>{{ t('admin.resellerProductSettings.columns.pricingValue') }}</Label>
                  <div class="mt-2 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-sm text-muted-foreground">
                    {{ pricingValue(skuFormFor(sku.id)) }}
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              {{ t('admin.resellerProductSettings.empty') }}
            </div>
          </section>

          <div class="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" :disabled="saving" @click="showEditor = false">
              {{ t('admin.common.cancel') }}
            </Button>
            <Button :disabled="saving" @click="saveSettings">
              {{ saving ? t('admin.resellerProductSettings.actions.saving') : t('admin.resellerProductSettings.actions.save') }}
            </Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
