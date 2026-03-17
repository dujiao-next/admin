<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminProduct, AdminCategory, AdminProductSKU, LocalizedText } from '@/api/types'
import RichEditor from '@/components/RichEditor.vue'
import { getFirstImageUrl } from '@/utils/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { notifyError } from '@/utils/notify'
import { getLocalizedText } from '@/utils/format'
import { buildAdminCategoryPath, createAdminCategoryChildCountMap, createAdminCategoryMap, flattenAdminCategories, isAdminProductCategorySelectable } from '@/utils/category'

const props = defineProps<{
  modelValue: boolean
  productId: number | null
  categories: AdminCategory[]
  siteCurrency: string
  supportedLocales: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const { t, locale } = useI18n()
const uploading = ref(false)
const submitting = ref(false)
const isEditing = ref(false)
const editingIsMapped = ref(false)
const initialCategoryID = ref<number | null>(null)
const productLoadVersion = ref(0)
const fileInput = ref<HTMLInputElement | null>(null)
const newTag = ref('')
const currentLang = ref('zh-CN')

const languages = computed(() => [
  { code: 'zh-CN', name: t('admin.common.lang.zhCN') },
  { code: 'zh-TW', name: t('admin.common.lang.zhTW') },
  { code: 'en-US', name: t('admin.common.lang.enUS') },
])

const categoryMap = computed(() => createAdminCategoryMap(props.categories))
const categoryChildCountMap = computed(() => createAdminCategoryChildCountMap(props.categories))
const categoryOptions = computed(() => flattenAdminCategories(props.categories).map((item) => ({
  ...item,
  selectable: isProductCategorySelectable(item.category.id),
})))

const getCategoryOptionLabel = (category: AdminCategory) => {
  return buildAdminCategoryPath(category, categoryMap.value, (item) => getLocalizedText(item.name))
}

const getCategoryOptionName = (category: AdminCategory) => {
  return getLocalizedText(category.name)
}

const getCategoryLeafTip = () => {
  if (locale.value === 'en-US') {
    return 'Root categories with child categories cannot receive products directly. Choose a leaf category.'
  }
  if (locale.value === 'zh-TW') {
    return '已有二級分類的一級分類不能直接掛商品，請選擇末級分類'
  }
  return '已有二级分类的一级分类不能直接挂商品，请选择末级分类'
}

const getCategoryRequiredError = () => {
  if (locale.value === 'en-US') return 'Please select a category'
  if (locale.value === 'zh-TW') return '請選擇商品分類'
  return '请选择商品分类'
}

const isProductCategorySelectable = (categoryID: number | null | undefined) => {
  const normalizedCategoryID = Number(categoryID)
  if (!Number.isFinite(normalizedCategoryID) || normalizedCategoryID <= 0) return false

  const exactCategoryID = Math.floor(normalizedCategoryID)
  const category = categoryMap.value.get(exactCategoryID)
  if (!category) return false

  return isAdminProductCategorySelectable(category, categoryChildCountMap.value) || initialCategoryID.value === exactCategoryID
}

type SKUFormItem = {
  id: number
  sku_code: string
  spec_values: Record<string, string>
  price_amount: number
  manual_stock_total: number
  is_active: boolean
  sort_order: number
}

type ManualFormField = {
  key: string
  type: string
  required: boolean
  label: LocalizedText
  placeholder: LocalizedText
  regex: string
  min: string
  max: string
  max_len: string
  options_text: string
}

const createEmptyLocaleText = () => ({
  'zh-CN': '',
  'zh-TW': '',
  'en-US': '',
})

const createSKUFormItem = (raw?: Partial<AdminProductSKU>): SKUFormItem => ({
  id: Number(raw?.id || 0),
  sku_code: String(raw?.sku_code || '').trim(),
  spec_values: {
    ...createEmptyLocaleText(),
    ...Object.keys(raw?.spec_values || {}).reduce((result: Record<string, string>, key) => {
      const text = String(raw?.spec_values?.[key] ?? '').trim()
      if (text) {
        result[key] = text
      }
      return result
    }, {}),
  },
  price_amount: Number(raw?.price_amount || 0),
  manual_stock_total: toSafeStockTotal(raw?.manual_stock_total),
  is_active: raw?.is_active ?? true,
  sort_order: Number(raw?.sort_order || 0),
})

const form = reactive({
  id: 0,
  title: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as LocalizedText,
  slug: '',
  seo_meta: { keywords: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' }, description: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } } as { keywords: LocalizedText; description: LocalizedText; [key: string]: LocalizedText },
  description: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as LocalizedText,
  content: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as LocalizedText,
  price_amount: 0,
  images: [] as string[],
  tags: [] as string[],
  purchase_type: 'member',
  max_purchase_quantity: '' as number | '',
  fulfillment_type: 'manual',
  manual_stock_total: 0,
  skus: [] as SKUFormItem[],
  category_id: null as number | null,
  is_affiliate_enabled: false,
  is_active: true,
  sort_order: 0,
  manual_form_schema: { fields: [] as ManualFormField[] },
})

const getCurrentLangName = () => {
  return languages.value.find((item) => item.code === currentLang.value)?.name || t('admin.common.lang.zhCN')
}

const emptyI18nString = () => ({ 'zh-CN': '', 'zh-TW': '', 'en-US': '' })

const normalizeSeoMeta = (raw: Record<string, LocalizedText> | null | undefined) => {
  if (!raw) return { keywords: emptyI18nString(), description: emptyI18nString() }
  const normalize = (val: string | LocalizedText | null | undefined) => {
    if (!val) return emptyI18nString()
    if (typeof val === 'string') {
      return { 'zh-CN': val, 'zh-TW': '', 'en-US': '' }
    }
    if (typeof val === 'object') {
      return { 'zh-CN': val['zh-CN'] || '', 'zh-TW': val['zh-TW'] || '', 'en-US': val['en-US'] || '' }
    }
    return emptyI18nString()
  }
  return {
    keywords: normalize(raw.keywords),
    description: normalize(raw.description),
  }
}

const toSafeInt = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.max(Math.floor(num), 0)
}

const toSafeStockTotal = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  const integer = Math.floor(num)
  if (integer === -1) return -1
  return Math.max(integer, 0)
}

const isNotifiedError = (error: unknown) => {
  return Boolean((error as { __notified?: boolean } | null)?.__notified)
}

const resolveManualStockMetrics = (product: AdminProduct) => {
  const skuRows = Array.isArray(product?.skus) ? product.skus : []
  const activeRows = skuRows.filter((item: AdminProductSKU) => Boolean(item?.is_active))
  if (!activeRows.length) {
    return {
      total: toSafeStockTotal(product?.manual_stock_total),
      locked: toSafeInt(product?.manual_stock_locked),
      sold: toSafeInt(product?.manual_stock_sold),
    }
  }

  const locked = activeRows.reduce((sum: number, item: AdminProductSKU) => sum + toSafeInt(item?.manual_stock_locked), 0)
  const sold = activeRows.reduce((sum: number, item: AdminProductSKU) => sum + toSafeInt(item?.manual_stock_sold), 0)
  if (activeRows.some((item: AdminProductSKU) => toSafeStockTotal(item?.manual_stock_total) === -1)) {
    return { total: -1, locked, sold }
  }
  const total = activeRows.reduce((sum: number, item: AdminProductSKU) => sum + toSafeStockTotal(item?.manual_stock_total), 0)
  return { total, locked, sold }
}

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

const normalizeLocaleText = (value: unknown) => {
  const result: Record<string, string> = {}
  const obj = (value && typeof value === 'object' ? value : {}) as Record<string, string>
  for (const code of ['zh-CN', 'zh-TW', 'en-US']) {
    const text = String(obj[code] || '').trim()
    if (text) {
      result[code] = text
    }
  }
  return result
}

const normalizeSpecValues = (value: unknown) => {
  const result: Record<string, string> = {}
  if (!value || typeof value !== 'object') {
    return result
  }
  const obj = value as Record<string, unknown>
  Object.keys(obj).forEach((key) => {
    const text = String(obj[key] ?? '').trim()
    if (text) {
      result[key] = text
    }
  })
  return result
}

const parseManualOptions = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  return []
}

const parseManualFormSchemaForEdit = (rawSchema: Record<string, unknown> | null | undefined) => {
  const rawFields = Array.isArray(rawSchema?.fields) ? (rawSchema!.fields as Record<string, unknown>[]) : []
  const fields = rawFields.map((rawField: Record<string, unknown>) => {
    const type = String(rawField?.type || 'text').trim() || 'text'
    return {
      key: String(rawField?.key || '').trim(),
      type,
      required: Boolean(rawField?.required),
      label: {
        ...createEmptyLocaleText(),
        ...((rawField?.label || {}) as Record<string, string>),
      },
      placeholder: {
        ...createEmptyLocaleText(),
        ...((rawField?.placeholder || {}) as Record<string, string>),
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
    .map((field: ManualFormField) => {
      const key = String(field?.key || '').trim()
      const type = String(field?.type || 'text').trim() || 'text'
      if (!key) {
        return null
      }
      const normalized: Record<string, unknown> = {
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

const addSKU = () => {
  form.skus.push(
    createSKUFormItem({
      sku_code: `SKU-${form.skus.length + 1}`,
      price_amount: Number(form.price_amount || 0),
      manual_stock_total: toSafeStockTotal(form.manual_stock_total),
      is_active: true,
      sort_order: form.skus.length,
    })
  )
}

const removeSKU = (index: number) => {
  form.skus.splice(index, 1)
}

const normalizeSKUsForSubmit = () => {
  if (!form.skus.length) {
    return [] as Array<Record<string, unknown>>
  }

  const seenCode = new Set<string>()
  const normalized = form.skus.map((item, index) => {
    const skuCode = String(item.sku_code || '').trim()
    if (!skuCode) {
      throw new Error(t('admin.products.errors.skuCodeRequired', { index: index + 1 }))
    }
    const codeKey = skuCode.toLowerCase()
    if (seenCode.has(codeKey)) {
      throw new Error(t('admin.products.errors.skuCodeDuplicate', { code: skuCode }))
    }
    seenCode.add(codeKey)

    const priceAmount = Number(item.price_amount)
    if (!Number.isFinite(priceAmount) || priceAmount <= 0) {
      throw new Error(t('admin.products.errors.skuPriceInvalid', { index: index + 1 }))
    }

    const isActive = Boolean(item.is_active)
    const manualStockTotal = form.fulfillment_type === 'manual' ? toSafeStockTotal(item.manual_stock_total) : 0
    const specValues = normalizeSpecValues(item.spec_values)

    return {
      id: item.id > 0 ? item.id : undefined,
      sku_code: skuCode,
      spec_values: specValues,
      price_amount: priceAmount,
      manual_stock_total: manualStockTotal,
      is_active: isActive,
      sort_order: Number(item.sort_order) || 0,
    }
  })

  if (!normalized.some((item) => item.is_active)) {
    throw new Error(t('admin.products.errors.skuNeedActive'))
  }
  return normalized
}

const isTextLikeField = (fieldType: string) => {
  return fieldType === 'text' || fieldType === 'textarea' || fieldType === 'phone' || fieldType === 'email'
}

const resetForm = () => {
  initialCategoryID.value = null
  Object.assign(form, {
    id: 0,
    title: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    slug: '',
    seo_meta: { keywords: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' }, description: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } },
    description: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    content: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    price_amount: 0,
    images: [],
    tags: [],
    purchase_type: 'member',
    max_purchase_quantity: '',
    fulfillment_type: 'manual',
    manual_stock_total: 0,
    skus: [],
    category_id: null,
    is_affiliate_enabled: false,
    is_active: true,
    sort_order: 0,
    manual_form_schema: { fields: [] },
  })
}

const populateForm = (product: AdminProduct) => {
  initialCategoryID.value = Number(product.category_id || 0) || null
  let imagesList: string[] = []
  if (product.images) {
    if (Array.isArray(product.images)) {
      imagesList = product.images
    } else if ((product.images as any).images && Array.isArray((product.images as any).images)) {
      imagesList = (product.images as any).images
    }
  }

  let tagsList: string[] = []
  if (product.tags) {
    if (Array.isArray(product.tags)) {
      tagsList = product.tags
    } else if ((product.tags as any).tags && Array.isArray((product.tags as any).tags)) {
      tagsList = (product.tags as any).tags
    }
  }

  Object.assign(form, {
    id: product.id,
    title: product.title || { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    slug: product.slug,
    seo_meta: normalizeSeoMeta(product.seo_meta),
    description: product.description || { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    content: product.content || { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    price_amount: Number(product.price_amount || 0),
    images: imagesList,
    tags: tagsList,
    purchase_type: product.purchase_type || 'member',
    max_purchase_quantity: Number(product.max_purchase_quantity || 0) > 0 ? Math.floor(Number(product.max_purchase_quantity || 0)) : '',
    fulfillment_type: product.fulfillment_type || 'manual',
    manual_stock_total: resolveManualStockMetrics(product).total,
    skus: Array.isArray(product.skus) ? product.skus.map((item: AdminProductSKU) => createSKUFormItem(item)) : [],
    category_id: Number(product.category_id || 0) || null,
    is_affiliate_enabled: Boolean(product.is_affiliate_enabled),
    is_active: product.is_active ?? true,
    sort_order: Number(product.sort_order || 0),
    manual_form_schema: parseManualFormSchemaForEdit(product.manual_form_schema),
  })
}

const closeModal = () => {
  emit('update:modelValue', false)
}

const loadProductForEdit = async (productID: number) => {
  const currentLoadVersion = ++productLoadVersion.value
  try {
    const res = await adminAPI.getProduct(productID)
    if (
      currentLoadVersion !== productLoadVersion.value
      || !props.modelValue
      || props.productId !== productID
    ) {
      return
    }

    const product = res.data.data
    editingIsMapped.value = Boolean(product.is_mapped)
    populateForm(product)
  } catch (err: any) {
    if (currentLoadVersion !== productLoadVersion.value) return
    if (isNotifiedError(err)) return
    notifyError(t('admin.products.errors.operationFailed', { message: err?.message || '' }))
    closeModal()
  }
}

const handleSubmit = async () => {
  submitting.value = true
  try {
    const normalizedCategoryID = Number(form.category_id)
    if (!Number.isFinite(normalizedCategoryID) || normalizedCategoryID <= 0) {
      throw new Error(getCategoryRequiredError())
    }
    if (!isProductCategorySelectable(normalizedCategoryID)) {
      throw new Error(getCategoryLeafTip())
    }

    const normalizedSKUs = normalizeSKUsForSubmit()
    const activeSKU = normalizedSKUs.find((item) => item.is_active)
    let effectivePrice = Number(form.price_amount)
    if (normalizedSKUs.length > 0) {
      const priceSource = activeSKU || normalizedSKUs[0]!
      effectivePrice = Number(priceSource.price_amount)
    }
    const normalizedMaxPurchaseQuantity = Number(form.max_purchase_quantity)
    const effectiveManualStockTotal = normalizedSKUs.length
      ? (() => {
          const activeRows = normalizedSKUs.filter((item) => item.is_active)
          if (activeRows.some((item) => toSafeStockTotal(item.manual_stock_total) === -1)) {
            return -1
          }
          return activeRows.reduce((sum, item) => sum + toSafeStockTotal(item.manual_stock_total), 0)
        })()
      : toSafeStockTotal(form.manual_stock_total)

    const payload = {
      slug: String(form.slug || '').trim(),
      category_id: Math.floor(normalizedCategoryID),
      seo_meta: form.seo_meta,
      title: form.title,
      description: form.description,
      content: form.content,
      price_amount: effectivePrice,
      images: form.images,
      tags: form.tags,
      purchase_type: form.purchase_type,
      max_purchase_quantity: Number.isFinite(normalizedMaxPurchaseQuantity) && normalizedMaxPurchaseQuantity > 0
        ? Math.floor(normalizedMaxPurchaseQuantity)
        : 0,
      fulfillment_type: form.fulfillment_type,
      manual_stock_total: effectiveManualStockTotal,
      skus: normalizedSKUs,
      is_affiliate_enabled: form.is_affiliate_enabled,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
      manual_form_schema: normalizeManualFormSchemaForSubmit(),
    }

    if (isEditing.value) {
      await adminAPI.updateProduct(form.id, payload as unknown as Partial<AdminProduct>)
    } else {
      await adminAPI.createProduct(payload as unknown as Partial<AdminProduct>)
    }
    closeModal()
    emit('success')
  } catch (err: any) {
    if (isNotifiedError(err)) return
    notifyError(t('admin.products.errors.operationFailed', { message: err?.message || '' }))
  } finally {
    submitting.value = false
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
    const imageUrl = (res.data.data as Record<string, unknown>)?.url as string
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

watch(
  [() => props.modelValue, () => props.productId],
  ([isOpen, productID]) => {
    productLoadVersion.value += 1
    if (!isOpen) return

    currentLang.value = 'zh-CN'
    if (productID != null && productID > 0) {
      isEditing.value = true
      void loadProductForEdit(productID)
      return
    }

    isEditing.value = false
    editingIsMapped.value = false
    resetForm()
  },
)
</script>

<template>
  <Dialog :open="modelValue" @update:open="(value) => { if (!value) closeModal() }">
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
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.seoMetaKeywords', { lang: getCurrentLangName() }) }}</label>
            <Input v-model="form.seo_meta.keywords[currentLang]" :placeholder="t('admin.products.form.seoMetaKeywordsPlaceholder')" />
            <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.seoMetaKeywordsTip') }}</p>
          </div>

          <div class="col-span-2">
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.seoMetaDescription', { lang: getCurrentLangName() }) }}</label>
            <Textarea v-model="form.seo_meta.description[currentLang]" :placeholder="t('admin.products.form.seoMetaDescriptionPlaceholder')" class="min-h-[80px]" />
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
                <SelectItem
                  v-for="item in categoryOptions"
                  :key="item.category.id"
                  :value="String(item.category.id)"
                  :disabled="!item.selectable"
                  :class="item.depth > 0 ? 'pl-6' : ''"
                >
                  {{ item.depth > 0 ? getCategoryOptionName(item.category) : getCategoryOptionLabel(item.category) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="mt-1 text-xs text-muted-foreground">{{ getCategoryLeafTip() }}</p>
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
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.maxPurchaseQuantity') }}</label>
            <Input
              v-model.number="form.max_purchase_quantity"
              type="number"
              min="1"
              :placeholder="t('admin.products.form.maxPurchaseQuantityPlaceholder')"
            />
            <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.maxPurchaseQuantityTip') }}</p>
          </div>

          <div class="col-span-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.fulfillmentType') }}</label>
            <Select v-model="form.fulfillment_type" :disabled="editingIsMapped">
              <SelectTrigger class="h-9 w-full">
                <SelectValue :placeholder="t('admin.products.fulfillmentType.manual')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{{ t('admin.products.fulfillmentType.manual') }}</SelectItem>
                <SelectItem value="auto">{{ t('admin.products.fulfillmentType.auto') }}</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="editingIsMapped" class="mt-1 text-xs text-indigo-600">{{ t('admin.products.mappedFulfillmentLocked') }}</p>
          </div>

          <div class="col-span-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualStockTotal') }}</label>
            <Input
              v-model.number="form.manual_stock_total"
              type="number"
              min="-1"
              :placeholder="t('admin.products.form.manualStockTotalPlaceholder')"
              :disabled="form.skus.length > 0"
            />
            <p v-if="form.skus.length > 0" class="mt-1 text-xs text-muted-foreground">
              {{ t('admin.products.form.manualStockTotalSkuTip') }}
            </p>
            <p v-else class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.manualStockTotalTip') }}</p>
          </div>

          <div v-if="form.fulfillment_type === 'manual' || editingIsMapped" class="col-span-2 rounded-xl border border-border bg-muted/20 p-4 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-foreground">{{ t('admin.products.form.manualFormSchemaTitle') }}</h3>
                <p class="text-xs text-muted-foreground mt-1">{{ t('admin.products.form.manualFormSchemaTip') }}</p>
                <p v-if="editingIsMapped" class="mt-1 text-xs text-indigo-600">{{ t('admin.products.mappedFormSchemaLocked') }}</p>
              </div>
              <Button v-if="!editingIsMapped" type="button" size="sm" variant="outline" @click="addManualFormField">
                {{ t('admin.products.form.manualFormAddField') }}
              </Button>
            </div>

            <div v-if="!form.manual_form_schema.fields.length" class="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              {{ t('admin.products.form.manualFormEmpty') }}
            </div>

            <div v-for="(field, index) in form.manual_form_schema.fields" :key="index" class="rounded-lg border border-border bg-background p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-xs font-medium text-muted-foreground">{{ t('admin.products.form.manualFormFieldTitle', { index: index + 1 }) }}</div>
                <Button v-if="!editingIsMapped" type="button" variant="destructive" size="sm" @click="removeManualFormField(index)">
                  {{ t('admin.products.form.manualFormRemoveField') }}
                </Button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldKey') }}</label>
                  <Input v-model="field.key" :placeholder="t('admin.products.form.manualFormFieldKeyPlaceholder')" :disabled="editingIsMapped" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldType') }}</label>
                  <select v-model="field.type" :disabled="editingIsMapped" class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    <option v-for="typeItem in manualFieldTypeOptions" :key="typeItem.value" :value="typeItem.value">{{ typeItem.label }}</option>
                  </select>
                </div>
                <div class="flex items-end">
                  <label class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input v-model="field.required" type="checkbox" class="h-4 w-4 accent-primary" :disabled="editingIsMapped" />
                    {{ t('admin.products.form.manualFormFieldRequired') }}
                  </label>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldLabel', { lang: getCurrentLangName() }) }}</label>
                  <Input v-model="field.label[currentLang]" :placeholder="t('admin.products.form.manualFormFieldLabelPlaceholder')" :disabled="editingIsMapped" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldPlaceholder', { lang: getCurrentLangName() }) }}</label>
                  <Input v-model="field.placeholder[currentLang]" :placeholder="t('admin.products.form.manualFormFieldPlaceholderPlaceholder')" :disabled="editingIsMapped" />
                </div>
              </div>

              <div v-if="isTextLikeField(field.type)" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldRegex') }}</label>
                  <Input v-model="field.regex" :placeholder="t('admin.products.form.manualFormFieldRegexPlaceholder')" :disabled="editingIsMapped" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldMaxLength') }}</label>
                  <Input v-model="field.max_len" type="number" min="1" :placeholder="t('admin.products.form.manualFormFieldMaxLengthPlaceholder')" :disabled="editingIsMapped" />
                </div>
              </div>

              <div v-if="field.type === 'number'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldMin') }}</label>
                  <Input v-model="field.min" type="number" :placeholder="t('admin.products.form.manualFormFieldMinPlaceholder')" :disabled="editingIsMapped" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldMax') }}</label>
                  <Input v-model="field.max" type="number" :placeholder="t('admin.products.form.manualFormFieldMaxPlaceholder')" :disabled="editingIsMapped" />
                </div>
              </div>

              <div v-if="field.type === 'select' || field.type === 'radio' || field.type === 'checkbox'">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.manualFormFieldOptions') }}</label>
                <Textarea v-model="field.options_text" rows="4" :placeholder="t('admin.products.form.manualFormFieldOptionsPlaceholder')" :disabled="editingIsMapped" />
                <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.manualFormFieldOptionsTip') }}</p>
              </div>
            </div>
          </div>

          <div class="col-span-2 rounded-xl border border-border bg-muted/20 p-4 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-foreground">{{ t('admin.products.form.skuTitle') }}</h3>
                <p class="text-xs text-muted-foreground mt-1">{{ t('admin.products.form.skuTip') }}</p>
                <p v-if="editingIsMapped" class="mt-1 text-xs text-indigo-600">{{ t('admin.products.mappedSkuLocked') }}</p>
              </div>
              <Button v-if="!editingIsMapped" type="button" size="sm" variant="outline" @click="addSKU">
                {{ t('admin.products.form.skuAdd') }}
              </Button>
            </div>

            <div v-if="!form.skus.length" class="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              {{ t('admin.products.form.skuEmpty') }}
            </div>

            <div v-for="(sku, index) in form.skus" :key="`sku-${index}-${sku.id || 0}`" class="rounded-lg border border-border bg-background p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div class="text-xs font-medium text-muted-foreground">{{ t('admin.products.form.skuItemTitle', { index: index + 1 }) }}</div>
                <Button v-if="!editingIsMapped" type="button" size="sm" variant="destructive" @click="removeSKU(index)">
                  {{ t('admin.products.form.skuRemove') }}
                </Button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div class="md:col-span-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.skuCode') }}</label>
                  <Input v-model="sku.sku_code" :placeholder="t('admin.products.form.skuCodePlaceholder')" :disabled="editingIsMapped" />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.skuSpec', { lang: getCurrentLangName() }) }}</label>
                  <Input v-model="sku.spec_values[currentLang]" :placeholder="t('admin.products.form.skuSpecPlaceholder')" :disabled="editingIsMapped" />
                </div>
                <div class="md:col-span-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.skuPrice') }}</label>
                  <Input v-model.number="sku.price_amount" type="number" step="0.01" min="0" :placeholder="t('admin.products.form.skuPricePlaceholder')" />
                </div>
                <div v-if="form.fulfillment_type === 'manual'" class="md:col-span-1">
                  <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.skuManualStock') }}</label>
                  <Input v-model.number="sku.manual_stock_total" type="number" min="-1" :placeholder="t('admin.products.form.skuManualStockPlaceholder')" />
                </div>
                <div :class="form.fulfillment_type === 'manual' ? 'md:col-span-1' : 'md:col-span-2'" class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.skuSort') }}</label>
                    <Input v-model.number="sku.sort_order" type="number" :placeholder="t('admin.products.form.skuSortPlaceholder')" />
                  </div>
                  <div class="flex items-end">
                    <label class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <input v-model="sku.is_active" type="checkbox" class="h-4 w-4 accent-primary" />
                      {{ t('admin.products.form.skuActive') }}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-span-1">
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.priceAmount') }}</label>
            <Input
              v-model.number="form.price_amount"
              type="number"
              step="0.01"
              min="0"
              required
              :placeholder="t('admin.products.form.priceAmountPlaceholder')"
              :disabled="form.skus.length > 0"
            />
            <p v-if="form.skus.length > 0" class="mt-1 text-xs text-muted-foreground">
              {{ t('admin.products.form.priceAmountSkuTip') }}
            </p>
            <p v-else class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.priceAmountTip') }}</p>
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
            <RichEditor :model-value="form.content[currentLang] || ''" @update:model-value="(v: string) => form.content[currentLang] = v" :placeholder="t('admin.products.form.contentPlaceholder')" />
            <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.products.form.contentTip') }}</p>
          </div>

          <div class="col-span-2">
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.products.form.tags') }}</label>
            <div class="flex flex-wrap gap-2 mb-2">
              <span v-for="(tag, index) in form.tags" :key="index" class="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground flex items-center gap-1">
                {{ tag }}
                <button type="button" class="hover:text-foreground" @click="removeTag(index)">x</button>
              </span>
            </div>
            <div class="flex gap-2">
              <Input v-model="newTag" :placeholder="t('admin.products.form.tagsPlaceholder')" @keydown.enter.prevent="addTag" />
              <Button type="button" variant="outline" @click="addTag">{{ t('admin.products.actions.addTag') }}</Button>
            </div>
          </div>

          <div class="col-span-2 flex flex-wrap items-center gap-6 pt-4 border-t border-border">
            <label class="inline-flex items-center gap-2">
              <input id="is_affiliate_enabled" v-model="form.is_affiliate_enabled" type="checkbox" class="h-4 w-4 accent-primary" />
              <span class="text-sm text-muted-foreground select-none">{{ t('admin.products.form.affiliateEnabled') }}</span>
            </label>
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
</template>
