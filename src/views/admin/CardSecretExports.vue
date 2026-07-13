<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { AlertTriangle, Copy, Download, PackageCheck, Upload, X } from 'lucide-vue-next'
import { adminAPI } from '@/api/admin'
import type { AdminCardSecretBatch, AdminProduct, AdminProductSKU } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAdminRouteUrl } from '@/utils/adminPath'
import { getLocalizedText } from '@/utils/format'

const { t } = useI18n()
const productKeyword = ref('')
const productOptions = ref<AdminProduct[]>([])
const productOptionsLoading = ref(false)
const selectedProductValue = ref('__all__')
const productInfo = ref<AdminProduct | null>(null)
const skuFilterValue = ref('__all__')
const batchFilterValue = ref('__all__')
const batches = ref<AdminCardSecretBatch[]>([])
const batchesLoading = ref(false)
const availableCount = ref(0)
const exportCount = ref(1)
const exportFormat = ref<'txt' | 'csv'>('txt')
const deleteAfterExport = ref(false)
const exporting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const confirmExportOpen = ref(false)
const resultMessage = ref('')
const exportResult = ref<{
  content: string
  blob: Blob
  filename: string
  format: 'txt' | 'csv'
  count: number
  deleted: boolean
  productLabel: string
  skuLabel: string
} | null>(null)

const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const parsePositiveInteger = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.floor(parsed)
}

const parseProductId = () => parsePositiveInteger(normalizeFilterValue(selectedProductValue.value)) || null
const parseSkuId = () => parsePositiveInteger(normalizeFilterValue(skuFilterValue.value))
const parseBatchId = () => parsePositiveInteger(normalizeFilterValue(batchFilterValue.value))

const formatSkuSpecValues = (specValues: Record<string, string> | null | undefined) => {
  if (!specValues || typeof specValues !== 'object' || Array.isArray(specValues)) return ''
  return Object.entries(specValues)
    .map(([key, value]) => {
      const keyText = String(key || '').trim()
      const valueText = Array.isArray(value)
        ? value.map((entry) => String(entry || '').trim()).filter(Boolean).join(', ')
        : String(value ?? '').trim()
      if (!valueText) return ''
      if (!keyText) return valueText
      return `${keyText}:${valueText}`
    })
    .filter(Boolean)
    .join(' / ')
}

const buildSkuLabel = (sku: AdminProductSKU | null | undefined) => {
  const skuCode = String(sku?.sku_code || '').trim()
  const specText = formatSkuSpecValues(sku?.spec_values)
  if (skuCode && specText) return `${skuCode} · ${specText}`
  if (skuCode) return skuCode
  if (specText) return specText
  if (sku?.id) return `#${sku.id}`
  return '-'
}

const buildProductLabel = (product: AdminProduct | null | undefined) => {
  const id = Number(product?.id || 0)
  const name = getLocalizedText(product?.title || {})
  if (id > 0 && name) return `#${id} ${name}`
  if (id > 0) return `#${id}`
  return name || '-'
}

const buildBatchLabel = (batch: AdminCardSecretBatch) => {
  const batchNo = String(batch?.batch_no || '').trim()
  const prefix = batchNo ? `${batchNo}` : `#${batch.id}`
  return `${prefix} · ${t('admin.cardSecrets.stats.available')} ${Number(batch.available_count || 0)}`
}

const currentProductId = computed(() => parseProductId())
const currentSkuId = computed(() => parseSkuId())
const currentBatchId = computed(() => parseBatchId())
const currentAvailableCount = computed(() => {
  if (currentBatchId.value) {
    const batch = batches.value.find((item) => Number(item.id || 0) === currentBatchId.value)
    return Number(batch?.available_count || 0)
  }
  return availableCount.value
})

const productInfoName = computed(() => {
  if (productInfo.value) return getLocalizedText(productInfo.value.title)
  const option = productOptions.value.find((item) => Number(item?.id || 0) === currentProductId.value)
  if (!option) return ''
  return getLocalizedText(option.title || {})
})

const currentProductLabel = computed(() => {
  if (productInfo.value) return buildProductLabel(productInfo.value)
  if (currentProductId.value) return `#${currentProductId.value}`
  return '-'
})

const availableSkus = computed(() => {
  const rows = Array.isArray(productInfo.value?.skus) ? productInfo.value.skus : []
  return rows
    .filter((sku: AdminProductSKU) => Boolean(sku?.is_active))
    .map((sku: AdminProductSKU) => ({
      ...sku,
      id: Number(sku.id),
      label: buildSkuLabel(sku),
    }))
    .filter((sku: AdminProductSKU & { label: string }) => Number.isFinite(sku.id) && sku.id > 0)
})

const skuFilterDisabled = computed(() => !currentProductId.value || availableSkus.value.length === 0)
const currentSkuLabel = computed(() => {
  if (!currentSkuId.value) return t('admin.cardSecrets.skuAll')
  const matched = availableSkus.value.find((sku) => sku.id === currentSkuId.value)
  if (!matched) return `#${currentSkuId.value}`
  return matched.label
})

const exportDisabled = computed(() => {
  return exporting.value || !currentProductId.value || exportCount.value <= 0 || exportCount.value > currentAvailableCount.value
})

const confirmExportMessage = computed(() => {
  return deleteAfterExport.value
    ? t('admin.cardSecretExports.confirmDelete', { count: exportCount.value })
    : t('admin.cardSecretExports.confirmUsed', { count: exportCount.value })
})

const productLink = (productId: number) => getAdminRouteUrl(`/products?product_id=${productId}`)

const resetMessages = () => {
  successMessage.value = ''
  errorMessage.value = ''
  resultMessage.value = ''
}

const syncSkuSelection = () => {
  if (!currentProductId.value || availableSkus.value.length === 0) {
    skuFilterValue.value = '__all__'
    return
  }
  const matched = availableSkus.value.some((sku) => sku.id === currentSkuId.value)
  if (currentSkuId.value && !matched) {
    skuFilterValue.value = '__all__'
  }
}

const loadProductOptions = async () => {
  productOptionsLoading.value = true
  try {
    const keyword = String(productKeyword.value || '').trim()
    const rows: AdminProduct[] = []
    let page = 1
    let totalPage = 1
    do {
      const response = await adminAPI.getProducts({
        page,
        page_size: 100,
        search: keyword || undefined,
        fulfillment_type: 'auto',
      })
      const list = Array.isArray(response.data.data) ? response.data.data : []
      rows.push(...list.filter((item: AdminProduct) => String(item?.fulfillment_type || '').trim() === 'auto'))
      totalPage = Number(response.data?.pagination?.total_page || 1)
      page += 1
    } while (page <= totalPage && page <= 20)

    const dedup = new Map<number, AdminProduct>()
    rows.forEach((item: AdminProduct) => {
      const id = Number(item?.id || 0)
      if (!Number.isFinite(id) || id <= 0) return
      if (!dedup.has(id)) dedup.set(id, item)
    })

    const options = Array.from(dedup.values())
    if (
      currentProductId.value &&
      !options.some((item: AdminProduct) => Number(item?.id || 0) === currentProductId.value)
    ) {
      if (productInfo.value && Number(productInfo.value.id || 0) === currentProductId.value) {
        options.unshift(productInfo.value)
      } else {
        options.unshift({
          id: currentProductId.value,
          title: {
            'zh-CN': `#${currentProductId.value}`,
            'zh-TW': `#${currentProductId.value}`,
            'en-US': `#${currentProductId.value}`,
          },
          fulfillment_type: 'auto',
        } as unknown as AdminProduct)
      }
    }

    productOptions.value = options
  } catch {
    productOptions.value = []
  } finally {
    productOptionsLoading.value = false
  }
}

const loadProductInfo = async () => {
  const productId = parseProductId()
  if (!productId) {
    productInfo.value = null
    skuFilterValue.value = '__all__'
    batches.value = []
    availableCount.value = 0
    return
  }
  try {
    const response = await adminAPI.getProduct(productId)
    productInfo.value = response.data.data
    if (!productOptions.value.some((item: AdminProduct) => Number(item?.id || 0) === productId)) {
      productOptions.value.unshift(response.data.data)
    }
    syncSkuSelection()
  } catch {
    productInfo.value = null
    skuFilterValue.value = '__all__'
  }
}

const loadInventoryMeta = async () => {
  if (!currentProductId.value) {
    batches.value = []
    availableCount.value = 0
    return
  }
  batchesLoading.value = true
  try {
    const params = {
      product_id: currentProductId.value,
      sku_id: currentSkuId.value || undefined,
    }
    const [statsResponse, batchesResponse] = await Promise.all([
      adminAPI.getCardSecretStats(params),
      adminAPI.getCardSecretBatches({ ...params, page: 1, page_size: 100 }),
    ])
    availableCount.value = Number(statsResponse.data?.data?.available || 0)
    batches.value = Array.isArray(batchesResponse.data?.data) ? batchesResponse.data.data : []
    if (currentBatchId.value && !batches.value.some((item) => Number(item.id || 0) === currentBatchId.value)) {
      batchFilterValue.value = '__all__'
    }
  } catch {
    availableCount.value = 0
    batches.value = []
  } finally {
    batchesLoading.value = false
  }
}

const handleSearchProducts = async () => {
  await loadProductOptions()
}

const debouncedSearchProducts = useDebounceFn(handleSearchProducts, 300)

const handleProductSelectionChange = async () => {
  resetMessages()
  skuFilterValue.value = '__all__'
  batchFilterValue.value = '__all__'
  exportCount.value = 1
  await loadProductInfo()
  await loadInventoryMeta()
}

const handleSkuSelectionChange = async () => {
  resetMessages()
  batchFilterValue.value = '__all__'
  exportCount.value = 1
  await loadInventoryMeta()
}

const resolveExportFilename = (response: any, format: 'txt' | 'csv') => {
  const contentDisposition = String(response?.headers?.['content-disposition'] || '')
  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
  const fallbackName = `card-secrets-available-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`
  return filenameMatch?.[1] || fallbackName
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const submitExport = async () => {
  resetMessages()
  if (!currentProductId.value) {
    errorMessage.value = t('admin.cardSecrets.errors.productRequired')
    return
  }
  if (exportCount.value <= 0 || exportCount.value > currentAvailableCount.value) {
    errorMessage.value = t('admin.cardSecretExports.errors.countInvalid')
    return
  }
  confirmExportOpen.value = true
}

const runConfirmedExport = async () => {
  if (!currentProductId.value) return
  confirmExportOpen.value = false
  exporting.value = true
  try {
    const format = exportFormat.value
    const deleted = deleteAfterExport.value
    const count = exportCount.value
    const response = await adminAPI.exportAvailableCardSecrets({
      product_id: currentProductId.value,
      sku_id: currentSkuId.value || undefined,
      batch_id: currentBatchId.value || undefined,
      limit: count,
      format,
      delete_after_export: deleted,
    })
    const blob = response.data as Blob
    const content = await blob.text()
    exportResult.value = {
      content,
      blob,
      filename: resolveExportFilename(response, format),
      format,
      count,
      deleted,
      productLabel: currentProductLabel.value,
      skuLabel: currentSkuLabel.value,
    }
    successMessage.value = deleted
      ? t('admin.cardSecretExports.success.deleted', { count })
      : t('admin.cardSecretExports.success.used', { count })
    await loadInventoryMeta()
  } catch (error: any) {
    errorMessage.value = error?.message || t('admin.cardSecretExports.errors.exportFailed')
  } finally {
    exporting.value = false
  }
}

const copyExportContent = async () => {
  if (!exportResult.value) return
  resultMessage.value = ''
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(exportResult.value.content)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = exportResult.value.content
      textarea.setAttribute('readonly', 'true')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    resultMessage.value = t('admin.cardSecretExports.result.copied')
  } catch {
    resultMessage.value = t('admin.common.copyFailed')
  }
}

const downloadExportResult = () => {
  if (!exportResult.value) return
  downloadBlob(exportResult.value.blob, exportResult.value.filename)
}

const closeExportResult = () => {
  exportResult.value = null
  resultMessage.value = ''
}

watch(currentAvailableCount, (count) => {
  if (count <= 0) {
    exportCount.value = 1
    return
  }
  if (exportCount.value > count) {
    exportCount.value = count
  }
})

onMounted(async () => {
  await loadProductOptions()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ t('admin.cardSecretExports.title') }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('admin.cardSecretExports.subtitle') }}</p>
      </div>
      <Button class="w-full lg:w-auto" variant="outline" as-child>
        <RouterLink to="/card-secret-imports">
          <Upload class="mr-2 h-4 w-4" />
          {{ t('admin.cardSecretExports.importAction') }}
        </RouterLink>
      </Button>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="mb-4">
        <h2 class="text-lg font-semibold text-foreground">{{ t('admin.cardSecretExports.selectionTitle') }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('admin.cardSecretExports.selectionDescription') }}</p>
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div class="flex flex-col gap-2 md:col-span-4 sm:flex-row sm:items-center">
          <Input
            v-model="productKeyword"
            :placeholder="t('admin.cardSecrets.productSearchPlaceholder')"
            @update:modelValue="debouncedSearchProducts"
            @keyup.enter="handleSearchProducts"
          />
          <Button
            size="sm"
            variant="outline"
            class="h-9 w-full shrink-0 sm:w-auto"
            :disabled="productOptionsLoading"
            @click="handleSearchProducts"
          >
            {{ productOptionsLoading ? t('admin.common.loading') : t('admin.cardSecrets.searchProducts') }}
          </Button>
        </div>

        <div class="md:col-span-4">
          <Select v-model="selectedProductValue" @update:modelValue="handleProductSelectionChange">
            <SelectTrigger class="h-10">
              <SelectValue :placeholder="t('admin.cardSecrets.productSelectPlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.cardSecrets.productAll') }}</SelectItem>
              <SelectItem v-for="product in productOptions" :key="product.id" :value="String(product.id)">
                {{ buildProductLabel(product) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="md:col-span-4">
          <Select v-model="skuFilterValue" :disabled="skuFilterDisabled" @update:modelValue="handleSkuSelectionChange">
            <SelectTrigger class="h-10">
              <SelectValue :placeholder="t('admin.cardSecrets.skuPlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.cardSecrets.skuAll') }}</SelectItem>
              <SelectItem v-for="sku in availableSkus" :key="sku.id" :value="String(sku.id)">
                {{ sku.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="mt-4 space-y-1 text-xs text-muted-foreground">
        <p v-if="!currentProductId">{{ t('admin.cardSecretExports.selectionTip') }}</p>
        <p v-else>{{ t('admin.cardSecrets.productHintCurrent', { id: currentProductId }) }}</p>
        <p v-if="productInfoName">
          {{ t('admin.cardSecrets.productNameLabel') }}：
          <a
            v-if="currentProductId"
            :href="productLink(currentProductId)"
            target="_blank"
            rel="noopener"
            class="text-primary underline-offset-4 hover:underline"
          >
            {{ productInfoName }}
          </a>
          <span v-else>{{ productInfoName }}</span>
        </p>
        <p v-if="currentProductId">
          {{ t('admin.cardSecrets.skuLabel') }}：{{ currentSkuLabel }}
        </p>
      </div>
    </div>

    <div v-if="!currentProductId" class="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8">
      <div class="mx-auto max-w-xl space-y-4 text-center">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <PackageCheck class="h-8 w-8 text-primary" />
        </div>
        <h2 class="text-xl font-semibold text-foreground">{{ t('admin.cardSecretExports.emptyTitle') }}</h2>
        <p class="text-sm text-muted-foreground">{{ t('admin.cardSecretExports.emptyDescription') }}</p>
      </div>
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div class="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div>
          <h2 class="text-lg font-semibold text-foreground">{{ t('admin.cardSecretExports.formTitle') }}</h2>
          <p class="mt-1 text-sm text-muted-foreground">{{ t('admin.cardSecretExports.formDescription') }}</p>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.cardSecretExports.batchLabel') }}</label>
            <Select v-model="batchFilterValue" :disabled="batchesLoading || batches.length === 0">
              <SelectTrigger class="h-10">
                <SelectValue :placeholder="t('admin.cardSecretExports.batchPlaceholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{{ t('admin.cardSecretExports.batchAll') }}</SelectItem>
                <SelectItem v-for="batch in batches" :key="batch.id" :value="String(batch.id)">
                  {{ buildBatchLabel(batch) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.cardSecretExports.countLabel') }}</label>
            <Input v-model.number="exportCount" type="number" min="1" :max="currentAvailableCount || undefined" step="1" />
            <p class="text-xs text-muted-foreground">
              {{ t('admin.cardSecretExports.availableHint', { count: currentAvailableCount }) }}
            </p>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.cardSecretExports.formatLabel') }}</label>
            <Select v-model="exportFormat">
              <SelectTrigger class="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="txt">TXT</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <Checkbox
            :model-value="deleteAfterExport"
            @update:model-value="(v) => deleteAfterExport = !!v"
            class="mt-0.5"
          />
          <div>
            <p class="text-sm font-medium text-foreground">{{ t('admin.cardSecretExports.deleteAfterExport') }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.cardSecretExports.deleteAfterExportHint') }}</p>
          </div>
        </div>

        <div v-if="successMessage" class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {{ successMessage }}
        </div>
        <div v-if="errorMessage" class="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {{ errorMessage }}
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" :disabled="exporting" @click="loadInventoryMeta">
            {{ t('admin.common.refresh') }}
          </Button>
          <Button :disabled="exportDisabled" @click="submitExport">
            <Download class="mr-2 h-4 w-4" />
            {{ exporting ? t('admin.cardSecretExports.exporting') : t('admin.cardSecretExports.submit') }}
          </Button>
        </div>
      </div>

      <div class="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p class="text-sm font-medium text-foreground">{{ t('admin.cardSecretExports.targetTitle') }}</p>
        <p class="mt-2 text-sm text-muted-foreground">{{ currentProductLabel }}</p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ t('admin.cardSecrets.skuLabel') }}：{{ currentSkuLabel }}
        </p>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <div class="rounded-lg border border-border bg-background p-3">
            <p class="text-xs text-muted-foreground">{{ t('admin.cardSecrets.stats.available') }}</p>
            <p class="mt-1 text-2xl font-semibold text-emerald-600">{{ currentAvailableCount }}</p>
          </div>
          <div class="rounded-lg border border-border bg-background p-3">
            <p class="text-xs text-muted-foreground">{{ t('admin.cardSecretExports.batchCount') }}</p>
            <p class="mt-1 text-2xl font-semibold text-foreground">{{ batches.length }}</p>
          </div>
        </div>
        <p class="mt-4 text-xs text-muted-foreground">{{ t('admin.cardSecretExports.targetHint') }}</p>
      </div>
    </div>

    <div
      v-if="confirmExportOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div class="flex items-start gap-3 border-b border-border px-5 py-4">
          <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <AlertTriangle class="h-5 w-5" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-base font-semibold text-foreground">{{ t('admin.cardSecretExports.confirmTitle') }}</h3>
            <p class="mt-1 text-sm leading-6 text-muted-foreground">{{ confirmExportMessage }}</p>
          </div>
          <button
            type="button"
            class="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            :aria-label="t('admin.common.cancel')"
            @click="confirmExportOpen = false"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
        <div class="space-y-2 px-5 py-4 text-sm">
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">{{ t('admin.cardSecretExports.targetTitle') }}</span>
            <span class="text-right font-medium text-foreground">{{ currentProductLabel }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">{{ t('admin.cardSecrets.skuLabel') }}</span>
            <span class="text-right text-foreground">{{ currentSkuLabel }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">{{ t('admin.cardSecretExports.countLabel') }}</span>
            <span class="font-mono text-foreground">{{ exportCount }}</span>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-4">
          <Button variant="outline" :disabled="exporting" @click="confirmExportOpen = false">
            {{ t('admin.common.cancel') }}
          </Button>
          <Button :variant="deleteAfterExport ? 'destructive' : 'default'" :disabled="exporting" @click="runConfirmedExport">
            {{ exporting ? t('admin.cardSecretExports.exporting') : t('admin.common.confirm') }}
          </Button>
        </div>
      </div>
    </div>

    <div
      v-if="exportResult"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div class="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-foreground">{{ t('admin.cardSecretExports.result.title') }}</h3>
            <p class="mt-1 text-sm text-muted-foreground">
              {{
                exportResult.deleted
                  ? t('admin.cardSecretExports.success.deleted', { count: exportResult.count })
                  : t('admin.cardSecretExports.success.used', { count: exportResult.count })
              }}
            </p>
          </div>
          <div class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            {{ exportResult.format.toUpperCase() }}
          </div>
        </div>

        <div class="grid gap-3 border-b border-border bg-muted/20 px-5 py-3 text-sm md:grid-cols-3">
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ t('admin.cardSecretExports.targetTitle') }}</div>
            <div class="mt-1 truncate text-foreground">{{ exportResult.productLabel }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ t('admin.cardSecrets.skuLabel') }}</div>
            <div class="mt-1 truncate text-foreground">{{ exportResult.skuLabel }}</div>
          </div>
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ t('admin.cardSecretExports.result.filename') }}</div>
            <div class="mt-1 truncate font-mono text-foreground">{{ exportResult.filename }}</div>
          </div>
        </div>

        <div class="min-h-0 flex-1 p-5">
          <div class="mb-2 flex items-center justify-between gap-3">
            <div class="text-sm font-medium text-foreground">{{ t('admin.cardSecretExports.result.content') }}</div>
            <div v-if="resultMessage" class="text-xs text-muted-foreground">{{ resultMessage }}</div>
          </div>
          <textarea
            :value="exportResult.content"
            readonly
            spellcheck="false"
            class="h-[52vh] min-h-[320px] w-full resize-none rounded-xl border border-border bg-background p-4 font-mono text-xs leading-5 text-foreground outline-none focus:border-primary"
          />
          <p class="mt-2 text-xs leading-5 text-muted-foreground">
            {{ t('admin.cardSecretExports.result.keepOpenHint') }}
          </p>
        </div>

        <div class="flex flex-col gap-3 border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" class="w-full sm:w-auto" @click="copyExportContent">
            <Copy class="mr-2 h-4 w-4" />
            {{ t('admin.cardSecretExports.result.copy') }}
          </Button>
          <div class="flex flex-col gap-2 sm:flex-row">
            <Button class="w-full sm:w-auto" @click="downloadExportResult">
              <Download class="mr-2 h-4 w-4" />
              {{ t('admin.cardSecretExports.result.download') }}
            </Button>
            <Button variant="outline" class="w-full sm:w-auto" @click="closeExportResult">
              {{ t('admin.common.close') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
