<script setup lang="ts">
import { computed, ref, reactive, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getLocalizedText } from '@/utils/format'
import { getImageUrl } from '@/utils/image'
import { notifyError } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'

const { t } = useI18n()
const loading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const categories = ref<any[]>([])
const currentLang = ref('zh-CN')
const route = useRoute()
const uploading = ref(false)
const iconFileInput = ref<HTMLInputElement | null>(null)

const languages = computed(() => [
  { code: 'zh-CN', name: t('admin.common.lang.zhCN') },
  { code: 'zh-TW', name: t('admin.common.lang.zhTW') },
  { code: 'en-US', name: t('admin.common.lang.enUS') },
])

const form = reactive({
  id: 0,
  name: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as any,
  slug: '',
  icon: '',
  sort_order: 0,
})

const getCurrentLangName = () => {
  return languages.value.find((item) => item.code === currentLang.value)?.name || t('admin.common.lang.zhCN')
}

const fetchCategories = async () => {
  loading.value = true
  try {
    const res = await adminAPI.getCategories()
    categories.value = (res.data.data as any[]) || []
  } catch (err) {
    categories.value = []
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  isEditing.value = false
  currentLang.value = 'zh-CN'
  Object.assign(form, {
    id: 0,
    name: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    slug: '',
    icon: '',
    sort_order: 0,
  })
  showModal.value = true
}

const openEditModal = (category: any) => {
  isEditing.value = true
  currentLang.value = 'zh-CN'

  const defaultName = { 'zh-CN': '', 'zh-TW': '', 'en-US': '' }
  const name = { ...defaultName, ...(category.name || {}) }

  Object.assign(form, {
    id: category.id,
    name,
    slug: category.slug,
    icon: category.icon || '',
    sort_order: category.sort_order,
  })
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const handleSubmit = async () => {
  try {
    const payload = { ...form }
    if (isEditing.value) {
      await adminAPI.updateCategory(form.id, payload)
    } else {
      await adminAPI.createCategory(payload)
    }
    closeModal()
    fetchCategories()
  } catch (err: any) {
    notifyError(t('admin.categories.errors.operationFailed', { message: err?.message || '' }))
  }
}

const handleDelete = async (category: any) => {
  const confirmed = await confirmAction({ description: t('admin.categories.confirmDelete', { name: getLocalizedText(category.name) }), confirmText: t('admin.common.delete'), variant: 'destructive' })
  if (!confirmed) return
  try {
    await adminAPI.deleteCategory(category.id)
    fetchCategories()
  } catch (err: any) {
    notifyError(t('admin.categories.errors.deleteFailed', { message: err?.message || '' }))
  }
}

const triggerIconInput = () => iconFileInput.value?.click()

const handleIconFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) uploadIcon(file)
}

const handleIconDrop = (e: DragEvent) => {
  const file = e.dataTransfer?.files[0]
  if (file && file.type.startsWith('image/')) uploadIcon(file)
}

const uploadIcon = async (file: File) => {
  uploading.value = true
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await adminAPI.upload(formData, 'category')
    form.icon = (res.data.data as any)?.url || ''
  } catch (err: any) {
    notifyError(t('admin.categories.errors.operationFailed', { message: err?.message || '' }))
  } finally {
    uploading.value = false
  }
}

const removeIcon = () => {
  form.icon = ''
}

const openEditById = async (rawId: unknown) => {
  const id = Number(rawId)
  if (!Number.isFinite(id) || id <= 0) return
  if (!categories.value.length) {
    await fetchCategories()
  }
  const target = categories.value.find((item) => item.id === id)
  if (target) {
    openEditModal(target)
  }
}

onMounted(() => {
  fetchCategories()
  if (route.query.category_id) {
    openEditById(route.query.category_id)
  }
})

watch(
  () => route.query.category_id,
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
      <h1 class="text-2xl font-semibold">{{ t('admin.categories.title') }}</h1>
      <Button @click="openCreateModal">{{ t('admin.categories.create') }}</Button>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.categories.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.categories.table.icon') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.categories.table.name') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.categories.table.slug') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.categories.table.sort') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.categories.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="6" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="categories.length === 0">
            <TableCell colspan="6" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.categories.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="category in categories" :key="category.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="category.id" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <img v-if="category.icon" :src="getImageUrl(category.icon)" class="h-8 w-8 rounded object-cover" :alt="getLocalizedText(category.name)" />
              <span v-else class="text-xs text-muted-foreground">-</span>
            </TableCell>
            <TableCell class="px-6 py-4 font-medium text-foreground">{{ getLocalizedText(category.name) }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-muted-foreground">{{ category.slug }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-muted-foreground">{{ category.sort_order }}</TableCell>
            <TableCell class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" @click="openEditModal(category)">{{ t('admin.categories.actions.edit') }}</Button>
                <Button size="sm" variant="destructive" @click="handleDelete(category)">{{ t('admin.categories.actions.delete') }}</Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="showModal" @update:open="(value) => { if (!value) closeModal() }">
      <DialogScrollContent class="w-full max-w-lg" @interact-outside="(e) => e.preventDefault()">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? t('admin.categories.modal.editTitle') : t('admin.categories.modal.createTitle') }}</DialogTitle>
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

          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.categories.form.name', { lang: getCurrentLangName() }) }}</label>
            <Input v-model="form.name[currentLang]" :placeholder="t('admin.categories.form.namePlaceholder')" />
            <p v-if="currentLang === 'zh-CN' && !form.name['zh-CN']" class="text-xs text-destructive mt-1">{{ t('admin.categories.form.nameRequired') }}</p>
          </div>

          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.categories.form.slug') }}</label>
            <Input v-model="form.slug" required :placeholder="t('admin.categories.form.slugPlaceholder')" />
          </div>

          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.categories.form.icon') }}</label>
            <div
              class="border border-dashed border-border rounded-xl p-4 text-center cursor-pointer relative"
              @click="triggerIconInput"
              @drop.prevent="handleIconDrop"
              @dragover.prevent
            >
              <input ref="iconFileInput" type="file" class="hidden" accept="image/*" @change="handleIconFileChange" />
              <div v-if="form.icon" class="space-y-2">
                <img :src="getImageUrl(form.icon)" class="h-20 mx-auto rounded-lg object-cover" />
                <div class="text-xs text-muted-foreground">{{ t('admin.categories.form.iconReplaceTip') }}</div>
                <button type="button" class="text-xs text-destructive hover:underline" @click.stop="removeIcon">{{ t('admin.categories.form.iconRemove') }}</button>
              </div>
              <div v-else class="text-muted-foreground">
                <span class="text-sm">{{ t('admin.categories.form.iconUploadHint') }}</span>
              </div>
              <div v-if="uploading" class="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                <div class="animate-spin h-6 w-6 border-b-2 border-white rounded-full"></div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.categories.form.sortOrder') }}</label>
            <Input v-model.number="form.sort_order" type="number" placeholder="0" />
            <p class="text-xs text-muted-foreground mt-1">{{ t('admin.categories.form.sortTip') }}</p>
          </div>

          <div class="flex justify-end gap-3 border-t border-border pt-6">
            <Button type="button" variant="outline" @click="closeModal">{{ t('admin.common.cancel') }}</Button>
            <Button type="submit">{{ isEditing ? t('admin.categories.actions.saveChanges') : t('admin.categories.actions.createNow') }}</Button>
          </div>
        </form>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
