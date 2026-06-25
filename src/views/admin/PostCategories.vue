<script setup lang="ts">
import { computed, ref, reactive, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import MediaPicker from '@/components/admin/MediaPicker.vue'
import { getLocalizedText } from '@/utils/format'
import { getImageUrl } from '@/utils/image'
import { notifyError } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'
import { flattenPostCategories, createPostCategoryMap, createPostCategoryChildCountMap, buildPostCategoryPath, type PostCategory } from '@/utils/postCategory'
import { useFormValidation, rules } from '@/composables/useFormValidation'

const { t } = useI18n()
const loading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const categories = ref<PostCategory[]>([])
const currentLang = ref('zh-CN')
const route = useRoute()
const submitting = ref(false)

const languages = computed(() => [
  { code: 'zh-CN', name: t('admin.common.lang.zhCN') },
  { code: 'zh-TW', name: t('admin.common.lang.zhTW') },
  { code: 'en-US', name: t('admin.common.lang.enUS') },
])

const defaultName = () => ({ 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as Record<string,string>)

const form = reactive({
  id: 0,
  parent_id: 0,
  name: defaultName(),
  slug: '',
  icon: '',
  sort_order: 0,
})

const { errors, validate, clearErrors } = useFormValidation({
  slug: [rules.required('Slug is required')],
  name: [rules.required('Name is required')],
})

const categoryHierarchyItems = computed(() => flattenPostCategories(categories.value))
const categoryMap = computed(() => createPostCategoryMap(categories.value))
const childCountMap = computed(() => createPostCategoryChildCountMap(categories.value))

const hasChildren = (catId: number) => (childCountMap.value.get(catId) || 0) > 0

const canChooseParent = computed(() => {
  if (!isEditing.value || form.id <= 0) return true
  const current = categoryMap.value.get(form.id)
  if (!current) return true
  if (current.parent_id) return true
  return !hasChildren(current.id)
})

const parentCategoryOptions = computed(() => {
  if (!canChooseParent.value) return []
  return categoryHierarchyItems.value
    .filter(item => item.depth === 0 && item.category.id !== form.id)
    .map(item => item.category)
})

const getLevelText = (depth: number) => depth === 0 ? t('admin.categories.level.root') : t('admin.categories.level.child')

const getCategoryPath = (cat: PostCategory): string => {
  return buildPostCategoryPath(cat, categoryMap.value, (c) => getLocalizedText(c.name))
}

const getCurrentLangName = () => languages.value.find(l => l.code === currentLang.value)?.name || 'zh-CN'

const fetchCategories = async () => {
  loading.value = true
  try {
    const res = await adminAPI.getPostCategories()
    categories.value = (res.data?.data || []) as PostCategory[]
  } catch { categories.value = [] }
  finally { loading.value = false }
}

const openCreate = () => {
  isEditing.value = false; currentLang.value = 'zh-CN'; clearErrors()
  Object.assign(form, { id: 0, parent_id: 0, name: defaultName(), slug: '', icon: '', sort_order: 0 })
  showModal.value = true
}

const openEdit = (cat: PostCategory) => {
  isEditing.value = true; currentLang.value = 'zh-CN'
  Object.assign(form, {
    id: cat.id, parent_id: cat.parent_id || 0,
    name: { ...defaultName(), ...(cat.name || {}) },
    slug: cat.slug, icon: cat.icon || '',
    sort_order: cat.sort_order || 0,
  })
  showModal.value = true
}

const closeModal = () => { showModal.value = false; clearErrors() }

const submit = async () => {
  if (!validate({ slug: form.slug, name: form.name['zh-CN'] } as Record<string,unknown>)) return
  submitting.value = true
  try {
    const payload = { ...form }
    if (isEditing.value) await adminAPI.updatePostCategory(form.id, payload)
    else await adminAPI.createPostCategory(payload)
    closeModal()
    fetchCategories()
  } catch (err: any) {
    notifyError(t('admin.postCategories.errors.operationFailed', { message: err?.message || '' }))
  } finally { submitting.value = false }
}

const toggleActive = async (cat: PostCategory) => {
  const newStatus = !cat.is_active
  try {
    cat.is_active = newStatus
    await adminAPI.patchPostCategoryStatus(cat.id, newStatus)
  } catch (err: any) {
    cat.is_active = !newStatus
    notifyError(t('admin.postCategories.errors.toggleFailed', { message: err?.message || '' }))
  }
}

const handleDelete = async (cat: PostCategory) => {
  const confirmed = await confirmAction({ description: t('admin.postCategories.confirmDelete', { name: getLocalizedText(cat.name) }), confirmText: t('admin.common.delete'), variant: 'destructive' })
  if (!confirmed) return
  try { await adminAPI.deletePostCategory(cat.id); fetchCategories() }
  catch (err: any) { notifyError(t('admin.postCategories.errors.deleteFailed', { message: err?.message || '' })) }
}

const openEditById = async (rawId: unknown) => {
  const id = Number(rawId)
  if (!Number.isFinite(id) || id <= 0) return
  if (!categories.value.length) await fetchCategories()
  const item = categoryHierarchyItems.value.find(h => h.category.id === id)
  if (item) openEdit(item.category)
}

onMounted(() => { fetchCategories(); if (route.query.category_id) openEditById(route.query.category_id) })
watch(() => route.query.category_id, (v) => { if (v) openEditById(v) })
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.postCategories.title') }}</h1>
      <Button class="w-full sm:w-auto" @click="openCreate">{{ t('admin.postCategories.create') }}</Button>
    </div>

    <div class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[760px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.categories.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.categories.table.icon') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[260px]">{{ t('admin.categories.table.name') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[220px]">{{ t('admin.categories.table.slug') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.categories.table.sort') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.categories.table.status') }}</TableHead>
            <TableHead class="px-6 py-3 min-w-[140px] text-right">{{ t('admin.categories.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading"><TableCell :colspan="7" class="p-0"><TableSkeleton :columns="7" :rows="5" /></TableCell></TableRow>
          <TableRow v-else-if="categories.length === 0"><TableCell colspan="7" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.postCategories.empty') }}</TableCell></TableRow>
          <TableRow v-for="item in categoryHierarchyItems" :key="item.category.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="item.category.id" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <img v-if="item.category.icon" :src="getImageUrl(item.category.icon)" class="h-8 w-8 shrink-0 rounded object-cover" :alt="getLocalizedText(item.category.name)" />
              <span v-else class="text-xs text-muted-foreground">-</span>
            </TableCell>
            <TableCell class="min-w-[260px] px-6 py-4">
              <div class="space-y-1" :class="item.depth > 0 ? 'pl-6' : ''">
                <div class="flex items-start gap-2">
                  <span class="inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[11px]" :class="item.depth > 0 ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-border bg-muted/30 text-muted-foreground'">{{ getLevelText(item.depth) }}</span>
                  <span class="min-w-0 break-words font-medium text-foreground">{{ getLocalizedText(item.category.name) }}</span>
                </div>
                <div v-if="item.parent" class="text-xs text-muted-foreground break-words">{{ t('admin.categories.table.parentPrefix', { name: getLocalizedText(item.parent.name) }) }}</div>
              </div>
            </TableCell>
            <TableCell class="min-w-[220px] px-6 py-4 font-mono text-muted-foreground break-all">{{ item.category.slug }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-muted-foreground">{{ item.category.sort_order }}</TableCell>
            <TableCell class="px-6 py-4">
              <span class="inline-flex cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors" :class="item.category.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100' : 'text-muted-foreground border-border bg-muted/30 hover:bg-muted/50'" @click="toggleActive(item.category)">{{ item.category.is_active ? t('admin.categories.status.active') : t('admin.categories.status.inactive') }}</span>
            </TableCell>
            <TableCell class="min-w-[140px] px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" @click="openEdit(item.category)">{{ t('admin.categories.actions.edit') }}</Button>
                <Button size="sm" variant="destructive" @click="handleDelete(item.category)">{{ t('admin.categories.actions.delete') }}</Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="showModal" @update:open="(v) => { if (!v) closeModal() }">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-lg p-4 sm:p-6" @interact-outside="(e) => e.preventDefault()">
        <DialogHeader><DialogTitle>{{ isEditing ? t('admin.postCategories.modal.editTitle') : t('admin.postCategories.modal.createTitle') }}</DialogTitle></DialogHeader>
        <form class="space-y-6" @submit.prevent="submit">
          <div class="border-b border-border">
            <div class="flex gap-2 overflow-x-auto pb-1 sm:gap-4">
              <button v-for="lang in languages" :key="lang.code" type="button" class="shrink-0 border-b-2 px-3 py-2 text-sm font-medium sm:px-4" :class="currentLang === lang.code ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'" @click="currentLang = lang.code">{{ lang.name }}</button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.categories.form.name', { lang: getCurrentLangName() }) }}</label>
            <Input v-model="form.name[currentLang]" :placeholder="t('admin.categories.form.namePlaceholder')" />
            <p v-if="errors.name" class="text-xs text-destructive mt-1">{{ errors.name }}</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.categories.form.slug') }}</label>
            <Input v-model="form.slug" :placeholder="t('admin.categories.form.slugPlaceholder')" />
            <p v-if="errors.slug" class="text-xs text-destructive mt-1">{{ errors.slug }}</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.categories.form.parent') }}</label>
            <Select :model-value="String(form.parent_id || 0)" @update:modelValue="(value) => { form.parent_id = Number(value || 0) || 0 }">
              <SelectTrigger class="h-9 w-full"><SelectValue :placeholder="t('admin.categories.form.parentPlaceholder')" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{{ t('admin.categories.form.parentRoot') }}</SelectItem>
                <SelectItem v-for="cat in parentCategoryOptions" :key="cat.id" :value="String(cat.id)">{{ getCategoryPath(cat) }}</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground mt-1">
              {{ canChooseParent ? t('admin.postCategories.form.parentTip') : t('admin.postCategories.form.parentLockedTip') }}
            </p>
          </div>

          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.categories.form.icon') }}</label>
            <MediaPicker v-model="form.icon" scene="category" />
          </div>

          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.categories.form.sortOrder') }}</label>
            <Input v-model.number="form.sort_order" type="number" placeholder="0" />
            <p class="text-xs text-muted-foreground mt-1">{{ t('admin.categories.form.sortTip') }}</p>
          </div>

          <div class="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" class="w-full sm:w-auto" @click="closeModal">{{ t('admin.common.cancel') }}</Button>
            <Button type="submit" class="w-full sm:w-auto" :disabled="submitting">{{ isEditing ? t('admin.categories.actions.saveChanges') : t('admin.categories.actions.createNow') }}</Button>
          </div>
        </form>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
