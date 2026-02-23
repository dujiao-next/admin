<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, getLocalizedText } from '@/utils/format'
import { notifyError } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'

const loading = ref(true)
const coupons = ref<any[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const jumpPage = ref('')
const filters = reactive({
  id: '',
  code: '',
  scopeRefId: '__all__',
  isActive: '__all__',
})
const autoOpenId = ref<number | null>(null)
const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)
const normalizeScopeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const showModal = ref(false)
const error = ref('')
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const scopeFilterKeyword = ref('')
const productKeyword = ref('')
const productOptions = ref<any[]>([])
const productOptionsLoading = ref(false)
const selectedScopeIDs = ref<number[]>([])
const form = reactive({
  code: '',
  type: 'percent',
  value: 0,
  min_amount: 0,
  max_discount: 0,
  usage_limit: 0,
  per_user_limit: 0,
  starts_at: '',
  ends_at: '',
  is_active: true,
})
const { t } = useI18n()
const route = useRoute()

const applyRouteFilter = () => {
  const rawCode = route.query.code
  if (typeof rawCode === 'string' && rawCode.trim() !== '') {
    filters.code = rawCode.trim()
  } else {
    filters.code = ''
  }
  const rawId = route.query.id || route.query.coupon_id
  const parsed = Number(rawId)
  if (Number.isFinite(parsed) && parsed > 0) {
    filters.id = String(parsed)
    autoOpenId.value = parsed
  } else {
    filters.id = ''
    autoOpenId.value = null
  }

  const rawScopeRefID = Number(route.query.scope_ref_id)
  if (Number.isFinite(rawScopeRefID) && rawScopeRefID > 0) {
    filters.scopeRefId = String(Math.floor(rawScopeRefID))
  } else {
    filters.scopeRefId = '__all__'
  }
}

const discountTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    percent: t('admin.common.discountTypes.percent'),
    fixed: t('admin.common.discountTypes.fixed'),
  }
  return map[type] || type
}

const resetForm = () => {
  form.code = ''
  form.type = 'percent'
  form.value = 0
  form.min_amount = 0
  form.max_discount = 0
  form.usage_limit = 0
  form.per_user_limit = 0
  form.starts_at = ''
  form.ends_at = ''
  form.is_active = true
  selectedScopeIDs.value = []
  editingId.value = null
  isEditing.value = false
}

const toISO = (raw: string) => {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toISOString()
}

const toLocalInput = (raw?: string) => {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

const normalizeScopeIDs = (raw: any) => {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(
        raw
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item) && item > 0)
          .map((item) => Math.floor(item))
      )
    )
  }
  if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return []
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return normalizeScopeIDs(parsed)
    } catch (_err) {
      // 兼容历史逗号分隔的输入格式
    }
    return Array.from(
      new Set(
        text
          .split(/[,，\s]+/)
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item) && item > 0)
          .map((item) => Math.floor(item))
      )
    )
  }
  return []
}

const buildProductLabel = (product: any) => {
  const id = Number(product?.id || 0)
  const name = getLocalizedText(product?.title || {})
  if (id > 0 && name) return `#${id} ${name}`
  if (id > 0) return `#${id}`
  return name || '-'
}

const ensureScopeProductsInOptions = (rows: any[]) => {
  if (!selectedScopeIDs.value.length) return rows
  const exists = new Set(
    rows.map((item: any) => Number(item?.id || 0)).filter((id: number) => Number.isFinite(id) && id > 0)
  )
  selectedScopeIDs.value.forEach((id) => {
    if (exists.has(id)) return
    rows.unshift({
      id,
      title: {
        'zh-CN': `#${id}`,
        'zh-TW': `#${id}`,
        'en-US': `#${id}`,
      },
    })
    exists.add(id)
  })
  return rows
}

const loadProductOptions = async (keywordInput?: string) => {
  productOptionsLoading.value = true
  try {
    const keyword = String((keywordInput ?? productKeyword.value) || '').trim()
    const rows: any[] = []
    let page = 1
    let totalPage = 1
    do {
      const response = await adminAPI.getProducts({
        page,
        page_size: 100,
        search: keyword || undefined,
      })
      const list = Array.isArray(response.data.data) ? response.data.data : []
      rows.push(...list)
      totalPage = Number(response.data?.pagination?.total_page || 1)
      page += 1
    } while (page <= totalPage && page <= 20)

    const dedup = new Map<number, any>()
    rows.forEach((item: any) => {
      const id = Number(item?.id || 0)
      if (!Number.isFinite(id) || id <= 0) return
      if (!dedup.has(id)) dedup.set(id, item)
    })
    productOptions.value = ensureScopeProductsInOptions(Array.from(dedup.values()))
  } catch {
    productOptions.value = ensureScopeProductsInOptions([])
  } finally {
    productOptionsLoading.value = false
  }
}

const handleSearchProducts = async () => {
  await loadProductOptions(productKeyword.value)
}

const handleSearchScopeProducts = async () => {
  await loadProductOptions(scopeFilterKeyword.value)
}

const toggleScopeProduct = (rawProductID: number | string) => {
  const productID = Number(rawProductID)
  if (!Number.isFinite(productID) || productID <= 0) return
  const normalizedID = Math.floor(productID)
  if (selectedScopeIDs.value.includes(normalizedID)) {
    selectedScopeIDs.value = selectedScopeIDs.value.filter((id) => id !== normalizedID)
    return
  }
  selectedScopeIDs.value = Array.from(new Set([...selectedScopeIDs.value, normalizedID])).sort((a, b) => a - b)
}

const scopeProductChecked = (rawProductID: number | string) => {
  const productID = Number(rawProductID)
  if (!Number.isFinite(productID) || productID <= 0) return false
  return selectedScopeIDs.value.includes(Math.floor(productID))
}

const selectAllScopeProducts = () => {
  const ids = productOptions.value
    .map((item: any) => Number(item?.id || 0))
    .filter((id: number) => Number.isFinite(id) && id > 0)
    .map((id: number) => Math.floor(id))
  selectedScopeIDs.value = Array.from(new Set([...selectedScopeIDs.value, ...ids])).sort((a, b) => a - b)
}

const clearScopeProducts = () => {
  selectedScopeIDs.value = []
}

const resolveProductNameByID = (rawProductID: number | string) => {
  const productID = Number(rawProductID)
  if (!Number.isFinite(productID) || productID <= 0) return ''
  const target = productOptions.value.find((item: any) => Number(item?.id || 0) === Math.floor(productID))
  if (!target) return ''
  return getLocalizedText(target?.title || {})
}

const fetchCoupons = async (page = 1) => {
  loading.value = true
  try {
    const normalizedIsActive = normalizeFilterValue(filters.isActive)
    const normalizedScopeRefID = normalizeScopeFilterValue(filters.scopeRefId)
    const isActiveValue = normalizedIsActive === '' ? undefined : normalizedIsActive === 'true'
    const response = await adminAPI.getCoupons({
      page,
      page_size: pagination.value.page_size,
      id: filters.id || undefined,
      code: filters.code || undefined,
      scope_ref_id: normalizedScopeRefID || undefined,
      is_active: isActiveValue,
    })
    coupons.value = (response.data.data as any[]) || []
    pagination.value = response.data.pagination || pagination.value
    if (autoOpenId.value) {
      const target = coupons.value.find((item) => item.id === autoOpenId.value)
      if (target) {
        openEditModal(target)
      }
      autoOpenId.value = null
    }
  } catch {
    coupons.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchCoupons(1)
}

const handleScopeFilterChange = () => {
  fetchCoupons(1)
}

const refresh = () => {
  fetchCoupons(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchCoupons(page)
}

const jumpToPage = () => {
  if (!jumpPage.value) return
  const raw = Number(jumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), pagination.value.total_page)
  if (target === pagination.value.page) return
  changePage(target)
}

const openCreateModal = () => {
  error.value = ''
  resetForm()
  showModal.value = true
  void loadProductOptions()
}

const openEditModal = (coupon: any) => {
  error.value = ''
  isEditing.value = true
  editingId.value = coupon.id
  form.code = coupon.code || ''
  form.type = coupon.type || 'percent'
  form.value = coupon.value || 0
  selectedScopeIDs.value = normalizeScopeIDs(coupon.scope_ref_ids)
  form.min_amount = coupon.min_amount || 0
  form.max_discount = coupon.max_discount || 0
  form.usage_limit = coupon.usage_limit || 0
  form.per_user_limit = coupon.per_user_limit || 0
  form.starts_at = toLocalInput(coupon.starts_at)
  form.ends_at = toLocalInput(coupon.ends_at)
  form.is_active = Boolean(coupon.is_active)
  showModal.value = true
  void loadProductOptions()
}

const closeModal = () => {
  showModal.value = false
  isEditing.value = false
  editingId.value = null
}

const handleSubmit = async () => {
  error.value = ''
  const scopeIDs = normalizeScopeIDs(selectedScopeIDs.value)
  if (!scopeIDs.length) {
    error.value = t('admin.coupons.errors.scopeRequired')
    return
  }
  try {
    const payload = {
      code: form.code.trim(),
      type: form.type,
      value: Number(form.value),
      scope_ref_ids: scopeIDs,
      min_amount: Number(form.min_amount || 0),
      max_discount: Number(form.max_discount || 0),
      usage_limit: Number(form.usage_limit || 0),
      per_user_limit: Number(form.per_user_limit || 0),
      starts_at: form.starts_at ? toISO(form.starts_at) : '',
      ends_at: form.ends_at ? toISO(form.ends_at) : '',
      is_active: form.is_active,
    }
    if (isEditing.value && editingId.value) {
      await adminAPI.updateCoupon(editingId.value, payload)
    } else {
      await adminAPI.createCoupon(payload)
    }
    closeModal()
    fetchCoupons(1)
  } catch (err: any) {
    error.value =
      err.message ||
      (isEditing.value ? t('admin.coupons.errors.updateFailed') : t('admin.coupons.errors.createFailed'))
  }
}

const handleDelete = async (coupon: any) => {
  const confirmed = await confirmAction({ description: t('admin.coupons.confirmDelete', { code: coupon.code }), confirmText: t('admin.common.delete'), variant: 'destructive' })
  if (!confirmed) return
  try {
    await adminAPI.deleteCoupon(coupon.id)
    fetchCoupons(pagination.value.page)
  } catch (err: any) {
    const message = err.message || t('admin.coupons.errors.deleteFailed')
    notifyError(message)
  }
}

const formatScope = (scope?: any) => {
  const ids = normalizeScopeIDs(scope)
  if (!ids.length) return '-'
  return ids
    .map((id) => {
      const productName = resolveProductNameByID(id)
      if (productName) return `#${id} ${productName}`
      return `#${id}`
    })
    .join(', ')
}

onMounted(async () => {
  applyRouteFilter()
  await loadProductOptions()
  fetchCoupons()
})

watch(
  () => route.query.id,
  () => {
    applyRouteFilter()
    fetchCoupons(1)
  }
)

watch(
  () => route.query.coupon_id,
  () => {
    applyRouteFilter()
    fetchCoupons(1)
  }
)

watch(
  () => route.query.code,
  () => {
    applyRouteFilter()
    fetchCoupons(1)
  }
)

watch(
  () => route.query.scope_ref_id,
  () => {
    applyRouteFilter()
    fetchCoupons(1)
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.coupons.title') }}</h1>
      <Button size="sm" class="gap-2" @click="openCreateModal">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('admin.coupons.create') }}
      </Button>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-48">
          <Input v-model="filters.code" :placeholder="t('admin.coupons.filterCode')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-72 flex items-center gap-2">
          <Input
            v-model="scopeFilterKeyword"
            :placeholder="t('admin.coupons.filterScopeSearchPlaceholder')"
            @keyup.enter="handleSearchScopeProducts"
          />
          <Button
            size="sm"
            variant="outline"
            :disabled="productOptionsLoading"
            @click="handleSearchScopeProducts"
          >
            {{ productOptionsLoading ? t('admin.common.loading') : t('admin.coupons.filterScopeSearchAction') }}
          </Button>
        </div>
        <div class="w-full md:w-60">
          <Select v-model="filters.scopeRefId" @update:modelValue="handleScopeFilterChange">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.coupons.filterScope')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.coupons.filterScopeAll') }}</SelectItem>
              <SelectItem
                v-for="product in productOptions"
                :key="`coupon-filter-product-${product.id}`"
                :value="String(product.id)"
              >
                {{ buildProductLabel(product) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-full md:w-48">
          <Select v-model="filters.isActive" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
            <SelectValue :placeholder="t('admin.coupons.filterStatusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.coupons.filterStatusAll') }}</SelectItem>
              <SelectItem value="true">{{ t('admin.common.enabled') }}</SelectItem>
              <SelectItem value="false">{{ t('admin.common.disabled') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex-1"></div>
        <Button size="sm" @click="refresh">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.code') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.type') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.value') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.scope') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.limits') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.period') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.status') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.coupons.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="9" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="coupons.length === 0">
            <TableCell colspan="9" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.coupons.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="coupon in coupons" :key="coupon.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="coupon.id" />
            </TableCell>
            <TableCell class="px-6 py-4 text-foreground font-medium">{{ coupon.code }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ discountTypeLabel(coupon.type) }}</TableCell>
            <TableCell class="px-6 py-4 text-foreground font-mono">{{ coupon.value }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatScope(coupon.scope_ref_ids) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div>{{ t('admin.coupons.limit.minAmount') }}：{{ coupon.min_amount || '-' }}</div>
              <div>{{ t('admin.coupons.limit.maxDiscount') }}：{{ coupon.max_discount || '-' }}</div>
              <div>{{ t('admin.coupons.limit.usageLimit') }}：{{ coupon.usage_limit || '-' }}</div>
              <div>{{ t('admin.coupons.limit.perUserLimit') }}：{{ coupon.per_user_limit || '-' }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div>{{ t('admin.coupons.period.startsAt') }}：{{ formatDate(coupon.starts_at) || '-' }}</div>
              <div>{{ t('admin.coupons.period.endsAt') }}：{{ formatDate(coupon.ends_at) || '-' }}</div>
            </TableCell>
            <TableCell class="px-6 py-4">
              <span
                class="inline-flex rounded-full border px-2.5 py-1 text-xs"
                :class="coupon.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-muted-foreground border-border bg-muted/30'"
              >
                {{ coupon.is_active ? t('admin.common.enabled') : t('admin.common.disabled') }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" @click="openEditModal(coupon)">{{ t('admin.coupons.actions.edit') }}</Button>
                <Button size="sm" variant="destructive" @click="handleDelete(coupon)">{{ t('admin.coupons.actions.delete') }}</Button>
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

    <Dialog v-model:open="showModal" @update:open="(value) => { if (!value) closeModal() }">
      <DialogScrollContent class="w-full max-w-3xl" @interact-outside="(e) => e.preventDefault()">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? t('admin.coupons.modal.editTitle') : t('admin.coupons.modal.title') }}</DialogTitle>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.code') }} *</label>
              <Input v-model="form.code" required placeholder="PROMO2026" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.type') }} *</label>
              <Select v-model="form.type">
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.common.discountTypes.percent')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">{{ t('admin.common.discountTypes.percent') }}</SelectItem>
                  <SelectItem value="fixed">{{ t('admin.common.discountTypes.fixed') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.value') }} *</label>
              <Input v-model.number="form.value" type="number" step="0.01" required placeholder="20" />
            </div>
            <div class="md:col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.scope') }} *</label>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <Input
                    v-model="productKeyword"
                    :placeholder="t('admin.coupons.modal.scopeSearchPlaceholder')"
                    @keyup.enter="handleSearchProducts"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    :disabled="productOptionsLoading"
                    @click="handleSearchProducts"
                  >
                    {{ productOptionsLoading ? t('admin.common.loading') : t('admin.coupons.modal.scopeSearchAction') }}
                  </Button>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{{ t('admin.coupons.modal.scopeSelectedCount', { count: selectedScopeIDs.length }) }}</span>
                  <Button type="button" size="sm" variant="ghost" class="h-7 px-2" @click="selectAllScopeProducts">
                    {{ t('admin.coupons.modal.scopeSelectAll') }}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" class="h-7 px-2" @click="clearScopeProducts">
                    {{ t('admin.coupons.modal.scopeClear') }}
                  </Button>
                </div>
                <div class="max-h-56 overflow-auto rounded-lg border border-border bg-background">
                  <div v-if="productOptionsLoading" class="px-3 py-3 text-xs text-muted-foreground">
                    {{ t('admin.common.loading') }}
                  </div>
                  <div v-else-if="productOptions.length === 0" class="px-3 py-3 text-xs text-muted-foreground">
                    {{ t('admin.coupons.modal.scopeEmpty') }}
                  </div>
                  <label
                    v-for="product in productOptions"
                    :key="`scope-product-${product.id}`"
                    class="flex cursor-pointer items-center gap-2 border-b border-border/60 px-3 py-2 text-sm last:border-b-0 hover:bg-muted/30"
                  >
                    <input
                      type="checkbox"
                      class="h-4 w-4 accent-primary"
                      :checked="scopeProductChecked(product.id)"
                      @change="toggleScopeProduct(product.id)"
                    />
                    <span class="truncate">{{ buildProductLabel(product) }}</span>
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.minAmount') }}</label>
              <Input v-model.number="form.min_amount" type="number" step="0.01" placeholder="0" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.maxDiscount') }}</label>
              <Input v-model.number="form.max_discount" type="number" step="0.01" placeholder="0" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.usageLimit') }}</label>
              <Input v-model.number="form.usage_limit" type="number" placeholder="0" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.perUserLimit') }}</label>
              <Input v-model.number="form.per_user_limit" type="number" placeholder="0" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.startsAt') }}</label>
              <Input v-model="form.starts_at" type="datetime-local" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.endsAt') }}</label>
              <Input v-model="form.ends_at" type="datetime-local" />
            </div>
            <div class="flex items-center gap-2 md:col-span-2">
              <input v-model="form.is_active" type="checkbox" class="h-4 w-4 accent-primary" />
              <span class="text-xs text-muted-foreground">{{ t('admin.common.enabled') }}</span>
            </div>
          </div>

          <div v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {{ error }}
          </div>

          <div class="flex justify-end gap-3">
            <Button type="button" variant="outline" @click="closeModal">{{ t('admin.common.cancel') }}</Button>
            <Button type="submit">{{ t('admin.common.save') }}</Button>
          </div>
        </form>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
