<script setup lang="ts">
import { computed, ref, reactive, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import RichEditor from '@/components/RichEditor.vue'
import { getFirstImageUrl } from '@/utils/image'
import { formatMoney, getLocalizedText } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { notifyError } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'

const { t } = useI18n()
const loading = ref(false)
const uploading = ref(false)
const submitting = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const searchQuery = ref('')
const manualStockStatus = ref('all')
const jumpPage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const newTag = ref('')
const currentLang = ref('zh-CN')
const route = useRoute()
const router = useRouter()

const languages = computed(() => [
  { code: 'zh-CN', name: t('admin.common.lang.zhCN') },
  { code: 'zh-TW', name: t('admin.common.lang.zhTW') },
  { code: 'en-US', name: t('admin.common.lang.enUS') },
])

const products = ref<any[]>([])
const categories = ref<any[]>([])
const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0,
  total_page: 0,
})

const form = reactive({
  id: 0,
  title: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as any,
  slug: '',
  seo_meta: { keywords: '', description: '' } as any,
  description: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as any,
  content: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as any,
  price_amount: 0,
  images: [] as string[],
  tags: [] as string[],
  purchase_type: 'member',
  fulfillment_type: 'manual',
  manual_stock_total: 0,
  category_id: null as number | null,
  is_active: true,
  sort_order: 0,
  manual_form_schema: { fields: [] as any[] },
})
const siteCurrency = ref('CNY')

const getCurrentLangName = () => {
  return languages.value.find((item) => item.code === currentLang.value)?.name || t('admin.common.lang.zhCN')
}

const formatPrice = (amount: any, currency: any) => {
  return formatMoney(amount, currency)
}

const toSafeInt = (value: any) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.max(Math.floor(num), 0)
}

const isNotifiedError = (error: unknown) => {
  return Boolean((error as { __notified?: boolean } | null)?.__notified)
}

const formatManualStockSummary = (product: any) => {
  const total = toSafeInt(product?.manual_stock_total)
  if (total <= 0) {
    return t('admin.products.stock.unlimited')
  }
  const locked = toSafeInt(product?.manual_stock_locked)
  const sold = toSafeInt(product?.manual_stock_sold)
  const available = Math.max(total - locked - sold, 0)
  return t('admin.products.stock.summary', { total, locked, sold, available })
}

const purchaseTypeBadgeClass = (product: any) => {
  return product?.purchase_type === 'guest'
    ? 'border-sky-200 bg-sky-50 text-sky-700'
    : 'border-indigo-200 bg-indigo-50 text-indigo-700'
}

const fulfillmentTypeBadgeClass = (product: any) => {
  return product?.fulfillment_type === 'auto'
    ? 'border-violet-200 bg-violet-50 text-violet-700'
    : 'border-amber-200 bg-amber-50 text-amber-700'
}

const manualStockBadgeClass = (product: any) => {
  const total = toSafeInt(product?.manual_stock_total)
  if (total <= 0) {
    return 'border-zinc-200 bg-zinc-50 text-zinc-700'
  }
  const locked = toSafeInt(product?.manual_stock_locked)
  const sold = toSafeInt(product?.manual_stock_sold)
  const available = Math.max(total - locked - sold, 0)
  if (available <= 0) {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

const createEmptyLocaleText = () => ({
  'zh-CN': '',
  'zh-TW': '',
  'en-US': '',
})

const createManualFormField = () => ({
  key: '',
  type: 'text',
  required: false,
  label: createEmptyLocaleText(),
  placeholder: createEmptyLocaleText(),
  regex: '',
  min: '',
  max: '',
  max_len: '',
  options_text: '',
})

const manualFieldTypeOptions = computed(() => [
  { value: 'text', label: t('admin.products.form.manualFormFieldTypes.text') },
  { value: 'textarea', label: t('admin.products.form.manualFormFieldTypes.textarea') },
  { value: 'phone', label: t('admin.products.form.manualFormFieldTypes.phone') },
  { value: 'email', label: t('admin.products.form.manualFormFieldTypes.email') },
  { value: 'number', label: t('admin.products.form.manualFormFieldTypes.number') },
  { value: 'select', label: t('admin.products.form.manualFormFieldTypes.select') },
  { value: 'radio', label: t('admin.products.form.manualFormFieldTypes.radio') },
  { value: 'checkbox', label: t('admin.products.form.manualFormFieldTypes.checkbox') },
])

const normalizeLocaleText = (value: any) => {
  const result: Record<string, string> = {}
  for (const code of ['zh-CN', 'zh-TW', 'en-US']) {
    const text = String(value?.[code] || '').trim()
    if (text) {
      result[code] = text
    }
  }
  return result
}

const parseManualOptions = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  return []
}

const parseManualFormSchemaForEdit = (rawSchema: any) => {
  const rawFields = Array.isArray(rawSchema?.fields) ? rawSchema.fields : []
  const fields = rawFields.map((rawField: any) => {
    const type = String(rawField?.type || 'text').trim() || 'text'
    return {
      key: String(rawField?.key || '').trim(),
      type,
      required: Boolean(rawField?.required),
      label: {
        ...createEmptyLocaleText(),
        ...(rawField?.label || {}),
      },
      placeholder: {
        ...createEmptyLocaleText(),
        ...(rawField?.placeholder || {}),
      },
      regex: String(rawField?.regex || '').trim(),
      min: rawField?.min == null ? '' : String(rawField.min),
      max: rawField?.max == null ? '' : String(rawField.max),
      max_len: rawField?.max_len == null ? '' : String(rawField.max_len),
      options_text: parseManualOptions(rawField?.options).join('\n'),
    }
  })
  return { fields }
}

const normalizeManualFormSchemaForSubmit = () => {
  if (form.fulfillment_type !== 'manual') {
    return { fields: [] }
  }
  const fields = (form.manual_form_schema?.fields || [])
    .map((field: any) => {
      const key = String(field?.key || '').trim()
      const type = String(field?.type || 'text').trim() || 'text'
      if (!key) {
        return null
      }
      const normalized: Record<string, any> = {
        key,
        type,
        required: Boolean(field?.required),
      }
      const label = normalizeLocaleText(field?.label)
      if (Object.keys(label).length) {
        normalized.label = label
      }
      const placeholder = normalizeLocaleText(field?.placeholder)
      if (Object.keys(placeholder).length) {
        normalized.placeholder = placeholder
      }
      const regex = String(field?.regex || '').trim()
      if (regex) {
        normalized.regex = regex
      }
      const min = Number(field?.min)
      if (Number.isFinite(min) && field?.min !== '') {
        normalized.min = min
      }
      const max = Number(field?.max)
      if (Number.isFinite(max) && field?.max !== '') {
        normalized.max = max
      }
      const maxLen = Number(field?.max_len)
      if (Number.isInteger(maxLen) && maxLen > 0) {
        normalized.max_len = maxLen
      }
      if (type === 'select' || type === 'radio' || type === 'checkbox') {
        const options = String(field?.options_text || '')
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean)
        if (options.length) {
          normalized.options = Array.from(new Set(options))
        }
      }
      return normalized
    })
    .filter(Boolean)

  return { fields }
}

const addManualFormField = () => {
  form.manual_form_schema.fields.push(createManualFormField())
}

const removeManualFormField = (index: number) => {
  form.manual_form_schema.fields.splice(index, 1)
}

const isTextLikeField = (fieldType: string) => {
  return fieldType === 'text' || fieldType === 'textarea' || fieldType === 'phone' || fieldType === 'email'
}

const fetchProducts = async () => {
  loading.value = true
  try {
    const res = await adminAPI.getProducts({
      page: pagination.page,
      page_size: pagination.page_size,
      search: searchQuery.value,
      manual_stock_status: manualStockStatus.value,
    })
    products.value = (res.data.data as any[]) || []
    if (res.data.pagination) {
      Object.assign(pagination, res.data.pagination)
    }
  } catch (err) {
    products.value = []
  } finally {
    loading.value = false
  }
}

const fetchCategories = async () => {
  try {
    const res = await adminAPI.getCategories({ type: 'product' })
    categories.value = (res.data.data as any[]) || []
  } catch (err) {
    categories.value = []
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

const handleSearch = () => {
  pagination.page = 1
  fetchProducts()
}

const resetFilters = () => {
  searchQuery.value = ''
  manualStockStatus.value = 'all'
  pagination.page = 1
  fetchProducts()
  nextTick(() => {
    const input = document.getElementById('admin-products-search') as HTMLInputElement | null
    input?.focus()
  })
}

const changePage = (page: number) => {
  pagination.page = page
  fetchProducts()
}

const jumpToPage = () => {
  if (!jumpPage.value) return
  const raw = Number(jumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), pagination.total_page || 1)
  if (target === pagination.page) return
  changePage(target)
}

const openCreateModal = () => {
  isEditing.value = false
  currentLang.value = 'zh-CN'
  resetForm()
  showModal.value = true
}

const openEditModal = (product: any) => {
  isEditing.value = true
  currentLang.value = 'zh-CN'

  let imagesList: string[] = []
  if (product.images) {
    if (Array.isArray(product.images)) {
      imagesList = product.images
    } else if (product.images.images && Array.isArray(product.images.images)) {
      imagesList = product.images.images
    }
  }

  let tagsList: string[] = []
  if (product.tags) {
    if (Array.isArray(product.tags)) {
      tagsList = product.tags
    } else if (product.tags.tags && Array.isArray(product.tags.tags)) {
      tagsList = product.tags.tags
    }
  }

  Object.assign(form, {
    id: product.id,
    title: product.title || { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    slug: product.slug,
    seo_meta: product.seo_meta || { keywords: '', description: '' },
    description: product.description || { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    content: product.content || { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    price_amount: Number(product.price_amount || 0),
    images: imagesList,
    tags: tagsList,
    purchase_type: product.purchase_type || 'member',
    fulfillment_type: product.fulfillment_type || 'manual',
    manual_stock_total: Number(product.manual_stock_total || 0),
    category_id: Number(product.category_id || 0) || null,
    is_active: product.is_active ?? true,
    sort_order: Number(product.sort_order || 0),
    manual_form_schema: parseManualFormSchemaForEdit(product.manual_form_schema),
  })
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const resetForm = () => {
  Object.assign(form, {
    id: 0,
    title: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    slug: '',
    seo_meta: { keywords: '', description: '' },
    description: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    content: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    price_amount: 0,
    images: [],
    tags: [],
    purchase_type: 'member',
    fulfillment_type: 'manual',
    manual_stock_total: 0,
    category_id: null,
    is_active: true,
    sort_order: 0,
    manual_form_schema: { fields: [] },
  })
}

const handleSubmit = async () => {
  submitting.value = true
  try {
    const payload = {
      slug: String(form.slug || '').trim(),
      category_id: Number(form.category_id),
      seo_meta: form.seo_meta,
      title: form.title,
      description: form.description,
      content: form.content,
      price_amount: Number(form.price_amount),
      images: form.images,
      tags: form.tags,
      purchase_type: form.purchase_type,
      fulfillment_type: form.fulfillment_type,
      manual_stock_total: toSafeInt(form.manual_stock_total),
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
      manual_form_schema: normalizeManualFormSchemaForSubmit(),
    }

    if (isEditing.value) {
      await adminAPI.updateProduct(form.id, payload)
    } else {
      await adminAPI.createProduct(payload)
    }
    closeModal()
    fetchProducts()
  } catch (err: any) {
    if (isNotifiedError(err)) return
    notifyError(t('admin.products.errors.operationFailed', { message: err?.message || '' }))
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (product: any) => {
  const confirmed = await confirmAction({ description: t('admin.products.confirmDelete', { name: getLocalizedText(product.title) }), confirmText: t('admin.common.delete'), variant: 'destructive' })
  if (!confirmed) return
  try {
    await adminAPI.deleteProduct(product.id)
    fetchProducts()
  } catch (err: any) {
    if (isNotifiedError(err)) return
    notifyError(t('admin.products.errors.deleteFailed', { message: err?.message || '' }))
  }
}

const openEditById = async (rawId: unknown) => {
  const id = Number(rawId)
  if (!Number.isFinite(id) || id <= 0) return
  try {
    const res = await adminAPI.getProduct(id)
    openEditModal(res.data.data)
  } catch (err: any) {
    if (isNotifiedError(err)) return
    notifyError(t('admin.products.errors.operationFailed', { message: err?.message || '' }))
  }
}

const addTag = () => {
  if (newTag.value.trim() && !form.tags.includes(newTag.value.trim())) {
    form.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = (index: number) => {
  form.tags.splice(index, 1)
}

const triggerFileInput = () => fileInput.value?.click()

const handleFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) uploadImage(file)
}

const handleDrop = (e: DragEvent) => {
  const file = e.dataTransfer?.files[0]
  if (file && file.type.startsWith('image/')) uploadImage(file)
}

const uploadImage = async (file: File) => {
  uploading.value = true
  const formData = new FormData()
  formData.append('file', file)

	try {
		const res = await adminAPI.upload(formData, 'product')
		const imageUrl = (res.data.data as any)?.url
    if (form.images.length > 0) {
      form.images[0] = imageUrl
    } else {
      form.images.push(imageUrl)
    }
  } catch (err) {
    if (isNotifiedError(err)) return
    notifyError(t('admin.products.errors.uploadFailed'))
  } finally {
    uploading.value = false
  }
}

onMounted(() => {
  fetchProducts()
  fetchCategories()
  fetchSiteCurrency()
  if (route.query.action === 'create') {
    openCreateModal()
    router.replace({ query: { ...route.query, action: undefined } })
  }
  if (route.query.product_id) {
    openEditById(route.query.product_id)
  }
})

watch(
  () => route.query.product_id,
  (value) => {
    if (value) {
      openEditById(value)
    }
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.products.title') }}</h1>
      <Button @click="openCreateModal">{{ t('admin.products.create') }}</Button>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative w-full md:w-80">
          <div class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <Input
            id="admin-products-search"
            v-model="searchQuery"
            class="pl-9"
            :placeholder="t('admin.products.searchPlaceholder')"
            @update:modelValue="handleSearch"
            @keydown.enter="handleSearch"
          />
        </div>
        <div class="w-full md:w-56">
          <Select v-model="manualStockStatus" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.products.filters.stockStatusPlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ t('admin.products.filters.stockStatusAll') }}</SelectItem>
              <SelectItem value="low">{{ t('admin.products.stockStatus.low') }}</SelectItem>
              <SelectItem value="normal">{{ t('admin.products.stockStatus.normal') }}</SelectItem>
              <SelectItem value="unlimited">{{ t('admin.products.stockStatus.unlimited') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" class="h-9" @click="resetFilters">
          {{ t('admin.common.reset') }}
        </Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.products.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.products.table.name') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.products.table.price') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.products.table.category') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.products.table.sort') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.products.table.status') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.products.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="7" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="products.length === 0">
            <TableCell colspan="7" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.products.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="product in products" :key="product.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="product.id" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <div class="flex items-center gap-4">
                <div class="h-12 w-12 overflow-hidden rounded-lg border border-border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                  <img v-if="getFirstImageUrl(product.images)" :src="getFirstImageUrl(product.images)" class="h-full w-full object-cover" />
                  <span v-else>{{ t('admin.common.noImage') }}</span>
                </div>
                <div>
                  <div class="font-medium text-foreground">{{ getLocalizedText(product.title) }}</div>
                  <div class="text-xs text-muted-foreground font-mono">{{ product.slug }}</div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span class="rounded-full border px-2 py-0.5 text-[11px]" :class="purchaseTypeBadgeClass(product)">
                      {{ product.purchase_type === 'guest' ? t('admin.products.purchaseType.guest') : t('admin.products.purchaseType.member') }}
                    </span>
                    <span class="rounded-full border px-2 py-0.5 text-[11px]" :class="fulfillmentTypeBadgeClass(product)">
                      {{ product.fulfillment_type === 'auto' ? t('admin.products.fulfillmentType.auto') : t('admin.products.fulfillmentType.manual') }}
                    </span>
                    <span
                      v-if="product.fulfillment_type === 'manual'"
                      class="rounded-full border px-2 py-0.5 text-[11px]"
                      :class="manualStockBadgeClass(product)"
                    >
                      {{ formatManualStockSummary(product) }}
                    </span>
                    <span
                      v-for="(tag, index) in (product.tags || []).slice(0, 3)"
                      :key="index"
                      class="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      # {{ tag }}
                    </span>
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell class="px-6 py-4 font-mono text-foreground">{{ formatPrice(product.price_amount, siteCurrency) }}</TableCell>
            <TableCell class="px-6 py-4">
              <span v-if="product.category" class="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
                {{ getLocalizedText(product.category.name) }}
              </span>
              <span v-else class="text-xs text-muted-foreground">{{ t('admin.products.uncategorized') }}</span>
            </TableCell>
            <TableCell class="px-6 py-4">
              <span class="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">{{ product.sort_order || 0 }}</span>
            </TableCell>
            <TableCell class="px-6 py-4">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="product.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-muted-foreground border-border bg-muted/30'">
                {{ product.is_active ? t('admin.products.status.active') : t('admin.products.status.inactive') }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" @click="openEditModal(product)">{{ t('admin.products.actions.edit') }}</Button>
                <Button size="sm" variant="destructive" @click="handleDelete(product)">{{ t('admin.products.actions.delete') }}</Button>
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
      <DialogScrollContent class="w-full max-w-5xl" @interact-outside="(e) => e.preventDefault()">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? t('admin.products.modal.editTitle') : t('admin.products.modal.createTitle') }}</DialogTitle>
        </DialogHeader>
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <div class="border-b border-border">
            <div class="flex gap-4">
              <button
                v-for="lang in languages"
                :key="lang.code"
                type="button"
                class="border-b-2 px-4 py-2 text-sm font-medium"
                :class="currentLang === lang.code ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
                @click="currentLang = lang.code"
              >
                {{ lang.name }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div class="col-span-2">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.title', { lang: getCurrentLangName() }) }}</label>
              <Input v-model="form.title[currentLang]" required :placeholder="t('admin.products.form.titlePlaceholder')" />
            </div>

            <div class="col-span-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.slug') }}</label>
              <Input v-model="form.slug" required :placeholder="t('admin.products.form.slugPlaceholder')" />
              <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.slugTip') }}</p>
            </div>

            <div class="col-span-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.seoMetaKeywords') }}</label>
              <Input v-model="form.seo_meta.keywords" :placeholder="t('admin.products.form.seoMetaKeywordsPlaceholder')" />
              <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.seoMetaKeywordsTip') }}</p>
            </div>

            <div class="col-span-2">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.seoMetaDescription') }}</label>
              <Textarea v-model="form.seo_meta.description" :placeholder="t('admin.products.form.seoMetaDescriptionPlaceholder')" class="min-h-[80px]" />
              <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.seoMetaDescriptionTip') }}</p>
            </div>

            <div class="col-span-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.category') }}</label>
              <Select
                :model-value="form.category_id ? String(form.category_id) : '__none__'"
                @update:modelValue="(value) => { form.category_id = value && value !== '__none__' ? Number(value) : null }"
              >
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.products.form.categoryPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{{ t('admin.products.form.categoryPlaceholder') }}</SelectItem>
                  <SelectItem v-for="cat in categories" :key="cat.id" :value="String(cat.id)">
                    {{ getLocalizedText(cat.name) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="col-span-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.purchaseType') }}</label>
              <Select v-model="form.purchase_type">
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.products.purchaseType.member')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{{ t('admin.products.purchaseType.member') }}</SelectItem>
                  <SelectItem value="guest">{{ t('admin.products.purchaseType.guest') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="col-span-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.fulfillmentType') }}</label>
              <Select v-model="form.fulfillment_type">
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.products.fulfillmentType.manual')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">{{ t('admin.products.fulfillmentType.manual') }}</SelectItem>
                  <SelectItem value="auto">{{ t('admin.products.fulfillmentType.auto') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="col-span-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualStockTotal') }}</label>
              <Input v-model.number="form.manual_stock_total" type="number" min="0" :placeholder="t('admin.products.form.manualStockTotalPlaceholder')" />
              <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.manualStockTotalTip') }}</p>
            </div>

            <div v-if="form.fulfillment_type === 'manual'" class="col-span-2 rounded-xl border border-border bg-muted/20 p-4 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold text-foreground">{{ t('admin.products.form.manualFormSchemaTitle') }}</h3>
                  <p class="text-xs text-muted-foreground mt-1">{{ t('admin.products.form.manualFormSchemaTip') }}</p>
                </div>
                <Button type="button" size="sm" variant="outline" @click="addManualFormField">
                  {{ t('admin.products.form.manualFormAddField') }}
                </Button>
              </div>

              <div v-if="!form.manual_form_schema.fields.length" class="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                {{ t('admin.products.form.manualFormEmpty') }}
              </div>

              <div v-for="(field, index) in form.manual_form_schema.fields" :key="index" class="rounded-lg border border-border bg-background p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-xs font-medium text-muted-foreground">{{ t('admin.products.form.manualFormFieldTitle', { index: index + 1 }) }}</div>
                  <Button type="button" variant="destructive" size="sm" @click="removeManualFormField(index)">
                    {{ t('admin.products.form.manualFormRemoveField') }}
                  </Button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldKey') }}</label>
                    <Input v-model="field.key" :placeholder="t('admin.products.form.manualFormFieldKeyPlaceholder')" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldType') }}</label>
                    <select v-model="field.type" class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm">
                      <option v-for="typeItem in manualFieldTypeOptions" :key="typeItem.value" :value="typeItem.value">{{ typeItem.label }}</option>
                    </select>
                  </div>
                  <div class="flex items-end">
                    <label class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <input v-model="field.required" type="checkbox" class="h-4 w-4 accent-primary" />
                      {{ t('admin.products.form.manualFormFieldRequired') }}
                    </label>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldLabel', { lang: getCurrentLangName() }) }}</label>
                    <Input v-model="field.label[currentLang]" :placeholder="t('admin.products.form.manualFormFieldLabelPlaceholder')" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldPlaceholder', { lang: getCurrentLangName() }) }}</label>
                    <Input v-model="field.placeholder[currentLang]" :placeholder="t('admin.products.form.manualFormFieldPlaceholderPlaceholder')" />
                  </div>
                </div>

                <div v-if="isTextLikeField(field.type)" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldRegex') }}</label>
                    <Input v-model="field.regex" :placeholder="t('admin.products.form.manualFormFieldRegexPlaceholder')" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldMaxLength') }}</label>
                    <Input v-model="field.max_len" type="number" min="1" :placeholder="t('admin.products.form.manualFormFieldMaxLengthPlaceholder')" />
                  </div>
                </div>

                <div v-if="field.type === 'number'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldMin') }}</label>
                    <Input v-model="field.min" type="number" :placeholder="t('admin.products.form.manualFormFieldMinPlaceholder')" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldMax') }}</label>
                    <Input v-model="field.max" type="number" :placeholder="t('admin.products.form.manualFormFieldMaxPlaceholder')" />
                  </div>
                </div>

                <div v-if="field.type === 'select' || field.type === 'radio' || field.type === 'checkbox'">
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldOptions') }}</label>
                  <Textarea v-model="field.options_text" rows="4" :placeholder="t('admin.products.form.manualFormFieldOptionsPlaceholder')" />
                  <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.manualFormFieldOptionsTip') }}</p>
                </div>
              </div>
            </div>

            <div class="col-span-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.priceAmount') }}</label>
              <Input v-model.number="form.price_amount" type="number" step="0.01" min="0" required :placeholder="t('admin.products.form.priceAmountPlaceholder')" />
              <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.priceAmountTip') }}</p>
            </div>

            <div class="col-span-1">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.sortOrder') }}</label>
              <Input v-model.number="form.sort_order" type="number" placeholder="0" />
              <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.sortTip') }}</p>
            </div>

            <div class="col-span-2">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.images') }}</label>
              <div
                class="border border-dashed border-border rounded-xl p-6 text-center cursor-pointer relative"
                @click="triggerFileInput"
                @drop.prevent="handleDrop"
                @dragover.prevent
              >
                <input ref="fileInput" type="file" class="hidden" accept="image/*" @change="handleFileChange" />
                <div v-if="form.images.length > 0" class="space-y-2">
                  <img :src="getFirstImageUrl(form.images)" class="h-32 mx-auto rounded-lg object-cover" :alt="form.title[currentLang]" />
                  <div class="text-xs text-muted-foreground">{{ t('admin.products.form.imageReplaceTip') }}</div>
                  <div class="text-xs text-muted-foreground font-mono">{{ getFirstImageUrl(form.images) }}</div>
                </div>
                <div v-else class="text-muted-foreground">
                  <span class="text-sm">{{ t('admin.products.form.imageUploadHint') }}</span>
                </div>
                <div v-if="uploading" class="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                  <div class="animate-spin h-8 w-8 border-b-2 border-white rounded-full"></div>
                </div>
              </div>
            </div>

            <div class="col-span-2">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.description', { lang: getCurrentLangName() }) }}</label>
              <Textarea v-model="form.description[currentLang]" rows="3" :placeholder="t('admin.products.form.descriptionPlaceholder')" />
            </div>

            <div class="col-span-2">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.content', { lang: getCurrentLangName() }) }}</label>
              <RichEditor v-model="form.content[currentLang]" :placeholder="t('admin.products.form.contentPlaceholder')" />
              <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.contentTip') }}</p>
            </div>

            <div class="col-span-2">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.tags') }}</label>
              <div class="flex flex-wrap gap-2 mb-2">
                <span v-for="(tag, index) in form.tags" :key="index" class="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground flex items-center gap-1">
                  {{ tag }}
                  <button type="button" class="hover:text-foreground" @click="removeTag(index)">×</button>
                </span>
              </div>
              <div class="flex gap-2">
                <Input v-model="newTag" :placeholder="t('admin.products.form.tagsPlaceholder')" @keydown.enter.prevent="addTag" />
                <Button type="button" variant="outline" @click="addTag">{{ t('admin.products.actions.addTag') }}</Button>
              </div>
            </div>

            <div class="col-span-2 flex items-center gap-2 pt-4 border-t border-border">
              <input id="is_active" v-model="form.is_active" type="checkbox" class="h-4 w-4 accent-primary" />
              <label for="is_active" class="text-sm text-muted-foreground select-none">{{ t('admin.products.form.activeNow') }}</label>
            </div>
          </div>

          <div class="flex justify-end gap-3 border-t border-border pt-6">
            <Button type="button" variant="outline" @click="closeModal">{{ t('admin.common.cancel') }}</Button>
            <Button type="submit" :disabled="submitting">
              {{ submitting ? t('admin.products.actions.submitting') : isEditing ? t('admin.products.actions.saveChanges') : t('admin.products.actions.createNow') }}
            </Button>
          </div>
        </form>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
