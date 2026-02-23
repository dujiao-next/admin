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
const promotions = ref<any[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const jumpPage = ref('')
const filters = reactive({
  id: '',
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
const productKeyword = ref('')
const productOptions = ref<any[]>([])
const productOptionsLoading = ref(false)
const modalScopeValue = ref('__none__')
const form = reactive({
  name: '',
  type: 'percent',
  scope_ref_id: 0,
  value: 0,
  min_amount: 0,
  starts_at: '',
  ends_at: '',
  is_active: true,
})
const { t } = useI18n()
const route = useRoute()

const applyRouteFilter = () => {
  const rawId = route.query.id || route.query.promotion_id
  const parsed = Number(rawId)
  if (Number.isFinite(parsed) && parsed > 0) {
    filters.id = String(parsed)
    autoOpenId.value = parsed
    return
  }
  filters.id = ''
}

const discountTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    percent: t('admin.common.discountTypes.percent'),
    fixed: t('admin.common.discountTypes.fixed'),
  }
  return map[type] || type
}

const resetForm = () => {
  form.name = ''
  form.type = 'percent'
  form.scope_ref_id = 0
  form.value = 0
  form.min_amount = 0
  form.starts_at = ''
  form.ends_at = ''
  form.is_active = true
  modalScopeValue.value = '__none__'
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

const parseScopeFilterID = () => {
  const normalized = normalizeScopeFilterValue(filters.scopeRefId)
  if (!normalized) return 0
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.floor(parsed)
}

const buildProductLabel = (product: any) => {
  const id = Number(product?.id || 0)
  const name = getLocalizedText(product?.title || {})
  if (id > 0 && name) return `#${id} ${name}`
  if (id > 0) return `#${id}`
  return name || '-'
}

const ensureReferencedProductsInOptions = (rows: any[]) => {
  const ids: number[] = []
  const scopeFilterID = parseScopeFilterID()
  if (scopeFilterID > 0) ids.push(scopeFilterID)
  if (form.scope_ref_id > 0) ids.push(Math.floor(form.scope_ref_id))

  if (!ids.length) return rows
  const exists = new Set(
    rows.map((item: any) => Number(item?.id || 0)).filter((id: number) => Number.isFinite(id) && id > 0)
  )
  ids.forEach((id) => {
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

const loadProductOptions = async () => {
  productOptionsLoading.value = true
  try {
    const keyword = String(productKeyword.value || '').trim()
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
    productOptions.value = ensureReferencedProductsInOptions(Array.from(dedup.values()))
  } catch {
    productOptions.value = ensureReferencedProductsInOptions([])
  } finally {
    productOptionsLoading.value = false
  }
}

const handleSearchProducts = async () => {
  await loadProductOptions()
}

const resolveProductNameByID = (rawProductID: number | string) => {
  const productID = Number(rawProductID)
  if (!Number.isFinite(productID) || productID <= 0) return ''
  const target = productOptions.value.find((item: any) => Number(item?.id || 0) === Math.floor(productID))
  if (!target) return ''
  return getLocalizedText(target?.title || {})
}

const formatPromotionScope = (rawScopeID: any) => {
  const scopeID = Number(rawScopeID || 0)
  if (!Number.isFinite(scopeID) || scopeID <= 0) return '-'
  const productName = resolveProductNameByID(scopeID)
  if (productName) return `#${Math.floor(scopeID)} ${productName}`
  return `#${Math.floor(scopeID)}`
}

const fetchPromotions = async (page = 1) => {
  loading.value = true
  try {
    const normalizedIsActive = normalizeFilterValue(filters.isActive)
    const normalizedScope = normalizeScopeFilterValue(filters.scopeRefId)
    const isActiveValue = normalizedIsActive === '' ? undefined : normalizedIsActive === 'true'
    const response = await adminAPI.getPromotions({
      page,
      page_size: pagination.value.page_size,
      id: filters.id || undefined,
      scope_ref_id: normalizedScope || undefined,
      is_active: isActiveValue,
    })
    promotions.value = (response.data.data as any[]) || []
    pagination.value = response.data.pagination || pagination.value
    if (autoOpenId.value) {
      const target = promotions.value.find((item) => item.id === autoOpenId.value)
      if (target) {
        openEditModal(target)
      }
      autoOpenId.value = null
    }
  } catch {
    promotions.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchPromotions(1)
}

const refresh = () => {
  fetchPromotions(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchPromotions(page)
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
  isEditing.value = false
  editingId.value = null
  resetForm()
  showModal.value = true
  void loadProductOptions()
}

const openEditModal = (promo: any) => {
  error.value = ''
  isEditing.value = true
  editingId.value = promo.id
  form.name = promo.name || ''
  form.type = promo.type || 'percent'
  form.scope_ref_id = promo.scope_ref_id || 0
  modalScopeValue.value = form.scope_ref_id > 0 ? String(form.scope_ref_id) : '__none__'
  form.value = promo.value || 0
  form.min_amount = promo.min_amount || 0
  form.starts_at = toLocalInput(promo.starts_at)
  form.ends_at = toLocalInput(promo.ends_at)
  form.is_active = Boolean(promo.is_active)
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
  const scopeRefID = Number(modalScopeValue.value)
  if (!Number.isFinite(scopeRefID) || scopeRefID <= 0) {
    error.value = t('admin.promotions.errors.scopeRequired')
    return
  }
  form.scope_ref_id = Math.floor(scopeRefID)
  try {
    const payload = {
      name: form.name.trim(),
      type: form.type,
      scope_ref_id: Number(form.scope_ref_id),
      value: Number(form.value),
      min_amount: Number(form.min_amount || 0),
      starts_at: form.starts_at ? toISO(form.starts_at) : '',
      ends_at: form.ends_at ? toISO(form.ends_at) : '',
      is_active: form.is_active,
    }
    if (isEditing.value && editingId.value) {
      await adminAPI.updatePromotion(editingId.value, payload)
    } else {
      await adminAPI.createPromotion(payload)
    }
    closeModal()
    fetchPromotions(1)
  } catch (err: any) {
    error.value =
      err.message ||
      (isEditing.value ? t('admin.promotions.errors.updateFailed') : t('admin.promotions.errors.createFailed'))
  }
}

const handleDelete = async (promo: any) => {
  const confirmed = await confirmAction({ description: t('admin.promotions.confirmDelete', { name: promo.name }), confirmText: t('admin.common.delete'), variant: 'destructive' })
  if (!confirmed) return
  try {
    await adminAPI.deletePromotion(promo.id)
    fetchPromotions(pagination.value.page)
  } catch (err: any) {
    const message = err.message || t('admin.promotions.errors.deleteFailed')
    notifyError(message)
  }
}

const handleScopeFilterChange = () => {
  fetchPromotions(1)
}

const handleModalScopeChange = (value: unknown) => {
  const normalized = String(value ?? '')
  modalScopeValue.value = normalized
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    form.scope_ref_id = 0
    return
  }
  form.scope_ref_id = Math.floor(parsed)
}

onMounted(async () => {
  applyRouteFilter()
  await loadProductOptions()
  fetchPromotions()
})

watch(
  () => route.query.id,
  () => {
    applyRouteFilter()
    fetchPromotions(1)
  }
)

watch(
  () => route.query.promotion_id,
  () => {
    applyRouteFilter()
    fetchPromotions(1)
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.promotions.title') }}</h1>
      <Button size="sm" class="gap-2" @click="openCreateModal">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('admin.promotions.create') }}
      </Button>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-72 flex items-center gap-2">
          <Input
            v-model="productKeyword"
            :placeholder="t('admin.promotions.filterScopeSearchPlaceholder')"
            @keyup.enter="handleSearchProducts"
          />
          <Button
            size="sm"
            variant="outline"
            :disabled="productOptionsLoading"
            @click="handleSearchProducts"
          >
            {{ productOptionsLoading ? t('admin.common.loading') : t('admin.promotions.filterScopeSearchAction') }}
          </Button>
        </div>
        <div class="w-full md:w-60">
          <Select v-model="filters.scopeRefId" @update:modelValue="handleScopeFilterChange">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.promotions.filterScope')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.promotions.filterScopeAll') }}</SelectItem>
              <SelectItem v-for="product in productOptions" :key="`promotion-filter-product-${product.id}`" :value="String(product.id)">
                {{ buildProductLabel(product) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-full md:w-48">
          <Select v-model="filters.isActive" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
            <SelectValue :placeholder="t('admin.promotions.filterStatusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.promotions.filterStatusAll') }}</SelectItem>
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
            <TableHead class="px-6 py-3">{{ t('admin.promotions.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.promotions.table.name') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.promotions.table.type') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.promotions.table.value') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.promotions.table.scope') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.promotions.table.minAmount') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.promotions.table.period') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.promotions.table.status') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.promotions.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="9" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="promotions.length === 0">
            <TableCell colspan="9" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.promotions.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="promo in promotions" :key="promo.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="promo.id" />
            </TableCell>
            <TableCell class="px-6 py-4 text-foreground font-medium">{{ promo.name }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ discountTypeLabel(promo.type) }}</TableCell>
            <TableCell class="px-6 py-4 text-foreground font-mono">{{ promo.value }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatPromotionScope(promo.scope_ref_id) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ promo.min_amount || '-' }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div>{{ t('admin.promotions.period.startsAt') }}：{{ formatDate(promo.starts_at) || '-' }}</div>
              <div>{{ t('admin.promotions.period.endsAt') }}：{{ formatDate(promo.ends_at) || '-' }}</div>
            </TableCell>
            <TableCell class="px-6 py-4">
              <span
                class="inline-flex rounded-full border px-2.5 py-1 text-xs"
                :class="promo.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-muted-foreground border-border bg-muted/30'"
              >
                {{ promo.is_active ? t('admin.common.enabled') : t('admin.common.disabled') }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" @click="openEditModal(promo)">{{ t('admin.promotions.actions.edit') }}</Button>
                <Button size="sm" variant="destructive" @click="handleDelete(promo)">{{ t('admin.promotions.actions.delete') }}</Button>
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
          <DialogTitle>{{ isEditing ? t('admin.promotions.modal.editTitle') : t('admin.promotions.modal.title') }}</DialogTitle>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.promotions.modal.name') }} *</label>
              <Input v-model="form.name" required :placeholder="t('admin.promotions.modal.namePlaceholder')" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.promotions.modal.type') }} *</label>
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
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.promotions.modal.value') }} *</label>
              <Input v-model.number="form.value" type="number" step="0.01" required placeholder="10" />
            </div>
            <div class="md:col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.promotions.modal.scope') }} *</label>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <Input
                    v-model="productKeyword"
                    :placeholder="t('admin.promotions.modal.scopeSearchPlaceholder')"
                    @keyup.enter="handleSearchProducts"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    :disabled="productOptionsLoading"
                    @click="handleSearchProducts"
                  >
                    {{ productOptionsLoading ? t('admin.common.loading') : t('admin.promotions.modal.scopeSearchAction') }}
                  </Button>
                </div>
                <Select v-model="modalScopeValue" @update:modelValue="handleModalScopeChange">
                  <SelectTrigger class="h-9 w-full">
                    <SelectValue :placeholder="t('admin.promotions.modal.scopePlaceholder')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{{ t('admin.promotions.modal.scopePlaceholder') }}</SelectItem>
                    <SelectItem v-for="product in productOptions" :key="`promotion-modal-product-${product.id}`" :value="String(product.id)">
                      {{ buildProductLabel(product) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.promotions.modal.minAmount') }}</label>
              <Input v-model.number="form.min_amount" type="number" step="0.01" placeholder="0" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.promotions.modal.startsAt') }}</label>
              <Input v-model="form.starts_at" type="datetime-local" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.promotions.modal.endsAt') }}</label>
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
