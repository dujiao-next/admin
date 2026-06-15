<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { BadgePercent, CircleHelp, Search } from 'lucide-vue-next'
import { adminAPI } from '@/api/admin'
import type { AdminProduct, AdminProductSKU, AdminWholesalePrice } from '@/api/types'
import IdCell from '@/components/IdCell.vue'
import ListPagination from '@/components/ListPagination.vue'
import TableSkeleton from '@/components/TableSkeleton.vue'
import type { ListFetchOptions } from '@/composables/useListRefresh'
import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getLocalizedText, formatMoney } from '@/utils/format'
import { getFirstImageUrl } from '@/utils/image'
import { notifyError, notifySuccess } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'
import { buildWholesaleSkuPriceReferences, formatWholesaleSkuLabel, formatWholesaleTierScopeLabel, hasMultipleActiveWholesaleSkus } from '@/utils/wholesalePricing'

const { t, locale } = useI18n()
const loading = ref(false)
const searchQuery = ref('')
const wholesaleStatus = ref('all')
const siteCurrency = ref('CNY')
const products = ref<AdminProduct[]>([])

type WholesaleTierFormItem = {
  sku_id: number | string
  sku_code: string
  min_quantity: number | string
  unit_price: number | string
}

const showModal = ref(false)
const submitting = ref(false)
const editingProduct = ref<AdminProduct | null>(null)
const tierForm = ref<WholesaleTierFormItem[]>([])
const wholesaleRuleNoteKeys = [
  'admin.wholesalePrices.modal.ruleProductLevel',
  'admin.wholesalePrices.modal.ruleQuantityShared',
  'admin.wholesalePrices.modal.ruleNoRaise',
]

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 0,
})

const statusQueryValue = computed(() => {
  if (wholesaleStatus.value === 'enabled') return 'enabled'
  if (wholesaleStatus.value === 'disabled') return 'disabled'
  return 'all'
})

const formatPrice = (amount: number | string) => formatMoney(amount, siteCurrency.value)

const productName = (product: AdminProduct) => getLocalizedText(product.title || {}) || `#${product.id}`

const activeProductSkus = (product: AdminProduct | null | undefined) => {
  const rows = Array.isArray(product?.skus) ? product.skus : []
  return rows
    .filter((sku) => sku?.is_active !== false)
    .slice()
    .sort((a, b) => {
      const orderA = Number(a.sort_order || 0)
      const orderB = Number(b.sort_order || 0)
      if (orderA !== orderB) return orderA - orderB
      return Number(a.id || 0) - Number(b.id || 0)
    })
}

const skuScopeOptions = computed(() => activeProductSkus(editingProduct.value))

const tierSkuOptionValue = (sku: AdminProductSKU) => {
  const id = Number(sku?.id || 0)
  if (id > 0) return `id:${id}`
  const code = String(sku?.sku_code || '').trim()
  return code ? `code:${code}` : '__all__'
}

const tierSkuSelectValue = (tier: WholesaleTierFormItem) => {
  const skuId = Number(tier?.sku_id || 0)
  if (Number.isFinite(skuId) && skuId > 0) return `id:${Math.floor(skuId)}`
  const skuCode = String(tier?.sku_code || '').trim()
  return skuCode ? `code:${skuCode}` : '__all__'
}

const skuOptionLabel = (sku: AdminProductSKU) => {
  const label = formatWholesaleSkuLabel(sku, String(locale.value || 'zh-CN'))
  const code = String(sku?.sku_code || '').trim()
  return code ? `${label} (${code})` : label
}

const updateTierSkuScope = (tier: WholesaleTierFormItem, value: unknown) => {
  const raw = String(value || '__all__')
  if (raw === '__all__') {
    tier.sku_id = ''
    tier.sku_code = ''
    return
  }
  if (raw.startsWith('id:')) {
    const id = Math.floor(Number(raw.slice(3)))
    const sku = skuScopeOptions.value.find((item) => Number(item.id || 0) === id)
    tier.sku_id = Number.isFinite(id) && id > 0 ? id : ''
    tier.sku_code = String(sku?.sku_code || '').trim()
    return
  }
  if (raw.startsWith('code:')) {
    const code = raw.slice(5).trim()
    const sku = skuScopeOptions.value.find((item) => String(item.sku_code || '').trim().toLowerCase() === code.toLowerCase())
    const skuId = Number(sku?.id || 0)
    tier.sku_id = Number.isFinite(skuId) && skuId > 0 ? skuId : ''
    tier.sku_code = code
  }
}

const skuPriceReferences = computed(() => {
  if (!editingProduct.value) return []
  return buildWholesaleSkuPriceReferences(editingProduct.value, {
    tiers: tierForm.value,
    locale: String(locale.value || 'zh-CN'),
    formatPrice: (amount) => formatPrice(amount),
  })
})

const showSkuPriceReference = computed(() => {
  return Boolean(editingProduct.value && hasMultipleActiveWholesaleSkus(editingProduct.value) && skuPriceReferences.value.length > 0)
})

const sortedWholesaleTiers = (product: AdminProduct): AdminWholesalePrice[] => {
  const tiers = Array.isArray(product.wholesale_prices) ? product.wholesale_prices : []
  return tiers
    .slice()
    .sort((a, b) => {
      const scopeA = formatWholesaleTierScopeLabel(product, a, { locale: String(locale.value || 'zh-CN'), allLabel: t('admin.wholesalePrices.modal.skuAll') })
      const scopeB = formatWholesaleTierScopeLabel(product, b, { locale: String(locale.value || 'zh-CN'), allLabel: t('admin.wholesalePrices.modal.skuAll') })
      if (scopeA !== scopeB) return scopeA.localeCompare(scopeB)
      return Number(a.min_quantity || 0) - Number(b.min_quantity || 0)
    })
}

const hasWholesalePrices = (product: AdminProduct) => sortedWholesaleTiers(product).length > 0

const formatWholesaleSummary = (product: AdminProduct) => {
  const tiers = sortedWholesaleTiers(product)
  if (!tiers.length) return t('admin.wholesalePrices.tiersEmpty')
  return tiers
    .map((tier) => {
      const scope = formatWholesaleTierScopeLabel(product, tier, { locale: String(locale.value || 'zh-CN'), allLabel: t('admin.wholesalePrices.modal.skuAll') })
      return `${scope} >=${Number(tier.min_quantity || 0)} ${formatPrice(tier.unit_price)}`
    })
    .join(' / ')
}

const createTierFormItem = (raw?: Partial<WholesaleTierFormItem>): WholesaleTierFormItem => ({
  sku_id: raw?.sku_id ?? '',
  sku_code: String(raw?.sku_code || '').trim(),
  min_quantity: raw?.min_quantity ?? '',
  unit_price: raw?.unit_price ?? '',
})

const openConfigureModal = (product: AdminProduct) => {
  editingProduct.value = product
  tierForm.value = sortedWholesaleTiers(product).map((tier) => createTierFormItem({
    sku_id: Number(tier.sku_id || 0) > 0 ? Number(tier.sku_id) : '',
    sku_code: String(tier.sku_code || '').trim(),
    min_quantity: Number(tier.min_quantity || 0),
    unit_price: Number(tier.unit_price || 0),
  }))
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  submitting.value = false
  editingProduct.value = null
  tierForm.value = []
}

const addTier = () => {
  tierForm.value.push(createTierFormItem())
}

const removeTier = (index: number) => {
  tierForm.value.splice(index, 1)
}

const normalizeTiersForSubmit = (): AdminWholesalePrice[] => {
  const seen = new Set<string>()
  return tierForm.value
    .map((item, index) => {
      const skuId = Math.floor(Number(item.sku_id || 0))
      const skuCode = String(item.sku_code || '').trim()
      const minQuantity = Math.floor(Number(item.min_quantity))
      const unitPrice = Number(item.unit_price)
      if (!Number.isFinite(minQuantity) || minQuantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error(t('admin.wholesalePrices.errors.invalidTier', { index: index + 1 }))
      }
      const scopeKey = skuId > 0 ? `id:${skuId}` : (skuCode ? `code:${skuCode.toLowerCase()}` : 'all')
      const uniqueKey = `${scopeKey}:${minQuantity}`
      if (seen.has(uniqueKey)) {
        throw new Error(t('admin.wholesalePrices.errors.duplicateQuantity', { quantity: minQuantity }))
      }
      seen.add(uniqueKey)
      return {
        sku_id: skuId > 0 ? skuId : undefined,
        sku_code: skuCode || undefined,
        min_quantity: minQuantity,
        unit_price: unitPrice,
      }
    })
    .sort((a, b) => {
      const scopeA = Number(a.sku_id || 0) > 0 ? `id:${a.sku_id}` : (String(a.sku_code || '').trim() ? `code:${String(a.sku_code).trim().toLowerCase()}` : 'all')
      const scopeB = Number(b.sku_id || 0) > 0 ? `id:${b.sku_id}` : (String(b.sku_code || '').trim() ? `code:${String(b.sku_code).trim().toLowerCase()}` : 'all')
      if (scopeA !== scopeB) return scopeA.localeCompare(scopeB)
      return Number(a.min_quantity || 0) - Number(b.min_quantity || 0)
    })
}

const fetchSiteCurrency = async () => {
  try {
    const response = await adminAPI.getSettings({ key: 'site_config' })
    const data = response.data?.data as Record<string, unknown> | undefined
    const raw = String(data?.currency || 'CNY').trim().toUpperCase()
    siteCurrency.value = /^[A-Z]{3}$/.test(raw) ? raw : 'CNY'
  } catch {
    siteCurrency.value = 'CNY'
  }
}

const fetchProducts = async (options: ListFetchOptions = {}) => {
  if (!options.preserveRows) loading.value = true
  try {
    const response = await adminAPI.getProducts({
      page: pagination.page,
      page_size: pagination.page_size,
      search: searchQuery.value.trim() || undefined,
      wholesale: statusQueryValue.value,
    })
    products.value = response.data.data || []
    if (response.data.pagination) {
      Object.assign(pagination, response.data.pagination)
    }
  } catch {
    if (!options.preserveRows) products.value = []
  } finally {
    if (!options.preserveRows) loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchProducts()
}

const debouncedSearch = useDebounceFn(handleSearch, 300)

const handleStatusChange = () => {
  pagination.page = 1
  fetchProducts()
}

const resetFilters = () => {
  searchQuery.value = ''
  wholesaleStatus.value = 'all'
  pagination.page = 1
  fetchProducts({ preserveRows: true })
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.total_page) return
  pagination.page = page
  fetchProducts()
}

const pageSizeOptions = [10, 20, 50, 100]

const changePageSize = (size: number) => {
  if (size === pagination.page_size) return
  pagination.page_size = size
  pagination.page = 1
  fetchProducts()
}

const saveWholesalePrices = async () => {
  if (!editingProduct.value) return
  submitting.value = true
  try {
    const wholesalePrices = normalizeTiersForSubmit()
    await adminAPI.updateProductWholesalePrices(editingProduct.value.id, {
      wholesale_prices: wholesalePrices,
    })
    notifySuccess(t('admin.wholesalePrices.saveSuccess'))
    closeModal()
    await fetchProducts()
  } catch (err: any) {
    notifyError(err?.message || t('admin.wholesalePrices.errors.saveFailed'))
  } finally {
    submitting.value = false
  }
}

const clearWholesalePrices = async (product: AdminProduct) => {
  const confirmed = await confirmAction({
    description: t('admin.wholesalePrices.confirmClear', { name: productName(product) }),
    confirmText: t('admin.wholesalePrices.actions.clear'),
    variant: 'destructive',
  })
  if (!confirmed) return
  try {
    await adminAPI.updateProductWholesalePrices(product.id, { wholesale_prices: [] })
    notifySuccess(t('admin.wholesalePrices.saveSuccess'))
    await fetchProducts()
  } catch (err: any) {
    notifyError(err?.message || t('admin.wholesalePrices.errors.clearFailed'))
  }
}

onMounted(async () => {
  await fetchSiteCurrency()
  await fetchProducts()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ t('admin.wholesalePrices.title') }}</h1>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div class="relative w-full lg:max-w-md">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            class="pl-9"
            :placeholder="t('admin.wholesalePrices.searchPlaceholder')"
            @input="debouncedSearch"
            @keyup.enter="handleSearch"
          />
        </div>
        <div class="w-full lg:w-56">
          <Select v-model="wholesaleStatus" @update:modelValue="handleStatusChange">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.wholesalePrices.statusFilter')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ t('admin.wholesalePrices.statusAll') }}</SelectItem>
              <SelectItem value="enabled">{{ t('admin.wholesalePrices.statusEnabled') }}</SelectItem>
              <SelectItem value="disabled">{{ t('admin.wholesalePrices.statusDisabled') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" class="h-9 w-full sm:w-auto" @click="resetFilters">
          {{ t('admin.common.reset') }}
        </Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[960px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.wholesalePrices.table.id') }}</TableHead>
            <TableHead class="min-w-[320px] px-6 py-3">{{ t('admin.wholesalePrices.table.product') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.wholesalePrices.table.price') }}</TableHead>
            <TableHead class="min-w-[260px] px-6 py-3">{{ t('admin.wholesalePrices.table.tiers') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.wholesalePrices.table.status') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.wholesalePrices.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell :colspan="6" class="p-0">
              <TableSkeleton :columns="6" :rows="5" />
            </TableCell>
          </TableRow>
          <TableRow v-else-if="products.length === 0">
            <TableCell colspan="6" class="px-6 py-8 text-center text-muted-foreground">
              {{ t('admin.wholesalePrices.empty') }}
            </TableCell>
          </TableRow>
          <TableRow v-for="product in products" v-else :key="product.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="product.id" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <div class="flex min-w-[320px] items-center gap-4">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground">
                  <img v-if="getFirstImageUrl(product.images)" :src="getFirstImageUrl(product.images)" class="h-full w-full object-cover" />
                  <span v-else>{{ t('admin.common.noImage') }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="break-words font-medium text-foreground">{{ productName(product) }}</div>
                  <div class="break-all font-mono text-xs text-muted-foreground">{{ product.slug }}</div>
                </div>
              </div>
            </TableCell>
            <TableCell class="px-6 py-4 font-mono text-foreground">
              {{ formatPrice(product.price_amount) }}
            </TableCell>
            <TableCell class="px-6 py-4">
              <div class="max-w-[360px] break-words text-sm" :class="hasWholesalePrices(product) ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'">
                {{ formatWholesaleSummary(product) }}
              </div>
            </TableCell>
            <TableCell class="px-6 py-4">
              <span
                class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
                :class="hasWholesalePrices(product) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-muted/30 text-muted-foreground'"
              >
                <BadgePercent class="h-3.5 w-3.5" />
                {{ hasWholesalePrices(product) ? t('admin.wholesalePrices.status.enabled') : t('admin.wholesalePrices.status.disabled') }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-right">
              <div class="flex justify-end gap-2">
                <Button size="sm" variant="outline" @click="openConfigureModal(product)">
                  {{ t('admin.wholesalePrices.actions.configure') }}
                </Button>
                <Button
                  v-if="hasWholesalePrices(product)"
                  size="sm"
                  variant="destructive"
                  @click="clearWholesalePrices(product)"
                >
                  {{ t('admin.wholesalePrices.actions.clear') }}
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

    <Dialog v-model:open="showModal">
      <DialogScrollContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ t('admin.wholesalePrices.modal.title') }}</DialogTitle>
        </DialogHeader>

        <div v-if="editingProduct" class="space-y-5">
          <div class="rounded-lg border border-border bg-muted/30 p-4">
            <div class="text-xs text-muted-foreground">{{ t('admin.wholesalePrices.modal.productInfo') }}</div>
            <div class="mt-2 flex flex-col gap-1 text-sm">
              <div class="font-medium text-foreground">#{{ editingProduct.id }} {{ productName(editingProduct) }}</div>
              <div class="break-all font-mono text-xs text-muted-foreground">{{ editingProduct.slug }}</div>
              <div class="font-mono text-xs text-muted-foreground">{{ formatPrice(editingProduct.price_amount) }}</div>
            </div>
          </div>

          <div class="rounded-lg border border-sky-200 bg-sky-50/70 p-4 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/25 dark:text-sky-100">
            <div class="flex items-start gap-3">
              <CircleHelp class="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
              <div class="min-w-0">
                <div class="text-sm font-medium">{{ t('admin.wholesalePrices.modal.ruleTitle') }}</div>
                <ul class="mt-2 space-y-1 text-xs leading-5 text-sky-800 dark:text-sky-200/90">
                  <li v-for="ruleKey in wholesaleRuleNoteKeys" :key="ruleKey">
                    {{ t(ruleKey) }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div v-if="showSkuPriceReference" class="rounded-lg border border-border bg-background p-4">
            <div class="flex items-start gap-3">
              <BadgePercent class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <div class="min-w-0">
                <div class="text-sm font-medium text-foreground">{{ t('admin.wholesalePrices.modal.skuReferenceTitle') }}</div>
                <div class="mt-1 text-xs leading-5 text-muted-foreground">{{ t('admin.wholesalePrices.modal.skuReferenceDesc') }}</div>
              </div>
            </div>

            <div class="mt-3 grid gap-2">
              <div
                v-for="item in skuPriceReferences"
                :key="item.id"
                class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md border border-border bg-muted/20 px-3 py-2"
              >
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-foreground">{{ item.label }}</div>
                  <div v-if="item.code" class="truncate font-mono text-[11px] text-muted-foreground">{{ item.code }}</div>
                </div>
                <div class="text-right">
                  <div class="font-mono text-sm text-foreground">{{ item.priceText }}</div>
                  <div
                    class="text-[11px]"
                    :class="item.tierApplies === true ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground'"
                  >
                    {{
                      item.tierApplies === null
                        ? t('admin.wholesalePrices.modal.skuReferencePending')
                        : item.tierApplies
                          ? t('admin.wholesalePrices.modal.skuReferenceApplies')
                          : t('admin.wholesalePrices.modal.skuReferenceNotApplies')
                    }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="text-sm font-medium text-foreground">{{ t('admin.wholesalePrices.table.tiers') }}</div>
              <Button type="button" size="sm" variant="outline" @click="addTier">
                {{ t('admin.wholesalePrices.actions.addTier') }}
              </Button>
            </div>

            <div v-if="tierForm.length === 0" class="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              {{ t('admin.wholesalePrices.modal.empty') }}
            </div>

            <div
              v-for="(tier, index) in tierForm"
              :key="`wholesale-tier-${index}`"
              class="grid grid-cols-1 gap-3 rounded-lg border border-border bg-background p-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end"
            >
              <div>
                <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {{ t('admin.wholesalePrices.modal.skuScope') }}
                </label>
                <Select
                  :model-value="tierSkuSelectValue(tier)"
                  @update:modelValue="(value) => updateTierSkuScope(tier, value)"
                >
                  <SelectTrigger class="h-9 w-full">
                    <SelectValue :placeholder="t('admin.wholesalePrices.modal.skuAll')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{{ t('admin.wholesalePrices.modal.skuAll') }}</SelectItem>
                    <SelectItem
                      v-for="sku in skuScopeOptions"
                      :key="tierSkuOptionValue(sku)"
                      :value="tierSkuOptionValue(sku)"
                    >
                      {{ skuOptionLabel(sku) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {{ t('admin.wholesalePrices.modal.minQuantity') }}
                </label>
                <Input
                  v-model.number="tier.min_quantity"
                  type="number"
                  min="1"
                  step="1"
                  :placeholder="t('admin.wholesalePrices.modal.minQuantityPlaceholder')"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {{ t('admin.wholesalePrices.modal.unitPrice') }}
                </label>
                <Input
                  v-model.number="tier.unit_price"
                  type="number"
                  min="0"
                  step="0.01"
                  :placeholder="t('admin.wholesalePrices.modal.unitPricePlaceholder')"
                />
              </div>
              <Button type="button" size="sm" variant="destructive" @click="removeTier(index)">
                {{ t('admin.wholesalePrices.actions.removeTier') }}
              </Button>
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <Button type="button" variant="outline" @click="closeModal">{{ t('admin.common.cancel') }}</Button>
            <Button type="button" :disabled="submitting" @click="saveWholesalePrices">
              {{ submitting ? t('admin.wholesalePrices.actions.saving') : t('admin.wholesalePrices.actions.save') }}
            </Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
