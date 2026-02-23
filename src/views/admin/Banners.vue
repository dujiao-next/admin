<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getImageUrl } from '@/utils/image'
import { notifyError } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'

const { t } = useI18n()
const route = useRoute()
const loading = ref(false)
const uploading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const currentLang = ref('zh-CN')
const fileInput = ref<HTMLInputElement | null>(null)

const languages = computed(() => [
  { code: 'zh-CN', name: t('admin.common.lang.zhCN') },
  { code: 'zh-TW', name: t('admin.common.lang.zhTW') },
  { code: 'en-US', name: t('admin.common.lang.enUS') },
])

const linkTypes = computed(() => [
  { label: t('admin.banners.linkTypes.none'), value: 'none' },
  { label: t('admin.banners.linkTypes.internal'), value: 'internal' },
  { label: t('admin.banners.linkTypes.external'), value: 'external' },
])

const activeFilterOptions = computed(() => [
  { label: t('admin.banners.filters.statusAll'), value: '__all__' },
  { label: t('admin.common.enabled'), value: 'true' },
  { label: t('admin.common.disabled'), value: 'false' },
])

const positionOptions = computed(() => [
  { label: t('admin.banners.positions.homeHero'), value: 'home_hero' },
])

const banners = ref<any[]>([])
const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0,
  total_page: 0,
})
const jumpPage = ref('')

const filters = reactive({
  search: '',
  position: 'home_hero',
  isActive: '__all__',
})

const form = reactive({
  id: 0,
  name: '',
  position: 'home_hero',
  title: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as any,
  subtitle: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as any,
  image: '',
  mobile_image: '',
  link_type: 'none',
  link_value: '',
  open_in_new_tab: false,
  is_active: true,
  start_at: '',
  end_at: '',
  sort_order: 0,
})

const getLocalizedText = (jsonData: any) => {
  if (!jsonData) return ''
  return jsonData[currentLang.value] || jsonData['zh-CN'] || jsonData['en-US'] || ''
}

const getCurrentLangName = () => {
  return languages.value.find((item) => item.code === currentLang.value)?.name || t('admin.common.lang.zhCN')
}

const getPositionLabel = (value: string) => {
  return positionOptions.value.find((item) => item.value === value)?.label || value
}

const getLinkTypeLabel = (value: string) => {
  return linkTypes.value.find((item) => item.value === value)?.label || value
}

const toISO = (raw: string) => {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
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

const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const fetchBanners = async (page = 1) => {
  loading.value = true
  try {
    const normalizedIsActive = normalizeFilterValue(filters.isActive)
    const isActiveValue = normalizedIsActive === '' ? undefined : normalizedIsActive === 'true'
    const res = await adminAPI.getBanners({
      page,
      page_size: pagination.page_size,
      search: filters.search || undefined,
      position: filters.position || undefined,
      is_active: isActiveValue,
    })
    banners.value = (res.data.data as any[]) || []
    const p = (res.data as any).pagination
    if (p) {
      pagination.page = p.page
      pagination.page_size = p.page_size
      pagination.total = p.total
      pagination.total_page = p.total_page
    }
  } catch {
    banners.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchBanners(1)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.total_page) return
  fetchBanners(page)
}

const jumpToPage = () => {
  if (!jumpPage.value) return
  const raw = Number(jumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), pagination.total_page)
  if (target === pagination.page) return
  changePage(target)
}

const resetForm = () => {
  currentLang.value = 'zh-CN'
  Object.assign(form, {
    id: 0,
    name: '',
    position: 'home_hero',
    title: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    subtitle: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    image: '',
    mobile_image: '',
    link_type: 'none',
    link_value: '',
    open_in_new_tab: false,
    is_active: true,
    start_at: '',
    end_at: '',
    sort_order: 0,
  })
}

const openCreateModal = () => {
  isEditing.value = false
  resetForm()
  showModal.value = true
}

const openEditModal = (banner: any) => {
  isEditing.value = true
  currentLang.value = 'zh-CN'
  Object.assign(form, {
    id: banner.id,
    name: banner.name || '',
    position: banner.position || 'home_hero',
    title: {
      'zh-CN': banner.title?.['zh-CN'] || '',
      'zh-TW': banner.title?.['zh-TW'] || '',
      'en-US': banner.title?.['en-US'] || '',
    },
    subtitle: {
      'zh-CN': banner.subtitle?.['zh-CN'] || '',
      'zh-TW': banner.subtitle?.['zh-TW'] || '',
      'en-US': banner.subtitle?.['en-US'] || '',
    },
    image: banner.image || '',
    mobile_image: banner.mobile_image || '',
    link_type: banner.link_type || 'none',
    link_value: banner.link_value || '',
    open_in_new_tab: Boolean(banner.open_in_new_tab),
    is_active: Boolean(banner.is_active),
    start_at: toLocalInput(banner.start_at),
    end_at: toLocalInput(banner.end_at),
    sort_order: banner.sort_order || 0,
  })
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const buildPayload = () => ({
  name: form.name,
  position: form.position,
  title: form.title,
  subtitle: form.subtitle,
  image: form.image,
  mobile_image: form.mobile_image,
  link_type: form.link_type,
  link_value: form.link_type === 'none' ? '' : form.link_value,
  open_in_new_tab: form.open_in_new_tab,
  is_active: form.is_active,
  start_at: form.start_at ? toISO(form.start_at) : '',
  end_at: form.end_at ? toISO(form.end_at) : '',
  sort_order: Number(form.sort_order || 0),
})

const handleSubmit = async () => {
  try {
    const payload = buildPayload()
    if (isEditing.value && form.id) {
      await adminAPI.updateBanner(form.id, payload)
    } else {
      await adminAPI.createBanner(payload)
    }
    closeModal()
    fetchBanners(1)
  } catch (err: any) {
    notifyError(t('admin.banners.errors.operationFailed', { message: err?.message || '' }))
  }
}

const handleDelete = async (banner: any) => {
  const confirmed = await confirmAction({
    description: t('admin.banners.confirmDelete', { name: banner.name || '#' + banner.id }),
    confirmText: t('admin.common.delete'),
    variant: 'destructive',
  })
  if (!confirmed) return
  try {
    await adminAPI.deleteBanner(banner.id)
    fetchBanners(pagination.page)
  } catch (err: any) {
    notifyError(t('admin.banners.errors.deleteFailed', { message: err?.message || '' }))
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await adminAPI.upload(formData, 'banner')
    form.image = (res.data.data as any)?.url || ''
  } catch {
    notifyError(t('admin.banners.errors.uploadFailed'))
  } finally {
    uploading.value = false
  }
}

const openEditById = async (rawId: unknown) => {
  const id = Number(rawId)
  if (!Number.isFinite(id) || id <= 0) return
  try {
    const res = await adminAPI.getBanner(id)
    openEditModal(res.data.data)
  } catch (err: any) {
    notifyError(t('admin.banners.errors.operationFailed', { message: err?.message || '' }))
  }
}

onMounted(() => {
  fetchBanners()
  if (route.query.banner_id) {
    openEditById(route.query.banner_id)
  }
})

watch(
  () => route.query.banner_id,
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
      <h1 class="text-2xl font-semibold">{{ t('admin.banners.title') }}</h1>
      <Button @click="openCreateModal">{{ t('admin.banners.create') }}</Button>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-72">
          <Input v-model="filters.search" :placeholder="t('admin.banners.searchPlaceholder')" @update:modelValue="handleSearch" />
        </div>
        <Select v-model="filters.position" @update:modelValue="handleSearch">
          <SelectTrigger class="h-9 w-[220px]">
            <SelectValue :placeholder="t('admin.banners.filters.positionPlaceholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="item in positionOptions" :key="item.value" :value="item.value">{{ item.label }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="filters.isActive" @update:modelValue="handleSearch">
          <SelectTrigger class="h-9 w-[180px]">
            <SelectValue :placeholder="t('admin.banners.filters.statusPlaceholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="item in activeFilterOptions" :key="item.value" :value="item.value">{{ item.label }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.banners.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.banners.table.image') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.banners.table.name') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.banners.table.position') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.banners.table.linkType') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.banners.table.sort') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.banners.table.status') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.banners.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="8" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="banners.length === 0">
            <TableCell colspan="8" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.banners.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="banner in banners" :key="banner.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="banner.id" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <img v-if="banner.image" :src="getImageUrl(banner.image)" class="h-14 w-28 rounded object-cover" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <div class="font-medium text-foreground">{{ banner.name }}</div>
              <div class="text-xs text-muted-foreground">{{ getLocalizedText(banner.title) }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ getPositionLabel(banner.position) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ getLinkTypeLabel(banner.link_type) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ banner.sort_order || 0 }}</TableCell>
            <TableCell class="px-6 py-4">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="banner.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-muted-foreground border-border bg-muted/30'">
                {{ banner.is_active ? t('admin.common.enabled') : t('admin.common.disabled') }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" @click="openEditModal(banner)">{{ t('admin.banners.actions.edit') }}</Button>
                <Button size="sm" variant="destructive" @click="handleDelete(banner)">{{ t('admin.banners.actions.delete') }}</Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div v-if="pagination.total_page > 1" class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
        <span class="text-xs text-muted-foreground">
          {{ t('admin.common.pageInfo', { total: pagination.total, page: pagination.page, totalPage: pagination.total_page }) }}
        </span>
        <div class="flex flex-wrap items-center gap-2">
          <Input v-model="jumpPage" type="number" min="1" :max="pagination.total_page" class="h-8 w-20" :placeholder="t('admin.common.jumpPlaceholder')" />
          <Button variant="outline" size="sm" class="h-8" @click="jumpToPage">{{ t('admin.common.jumpTo') }}</Button>
          <Button variant="outline" size="sm" class="h-8" :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">
            {{ t('admin.common.prevPage') }}
          </Button>
          <Button variant="outline" size="sm" class="h-8" :disabled="pagination.page >= pagination.total_page" @click="changePage(pagination.page + 1)">
            {{ t('admin.common.nextPage') }}
          </Button>
        </div>
      </div>
    </div>

    <Dialog v-model:open="showModal" @update:open="(value) => { if (!value) closeModal() }">
      <DialogScrollContent class="w-full max-w-4xl" @interact-outside="(e) => e.preventDefault()">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? t('admin.banners.modal.editTitle') : t('admin.banners.modal.createTitle') }}</DialogTitle>
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

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.name') }}</label>
              <Input v-model="form.name" required :placeholder="t('admin.banners.form.namePlaceholder')" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.position') }}</label>
              <Select v-model="form.position">
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.banners.form.positionPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="item in positionOptions" :key="item.value" :value="item.value">{{ item.label }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="md:col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.title', { lang: getCurrentLangName() }) }}</label>
              <Input v-model="form.title[currentLang]" :placeholder="t('admin.banners.form.titlePlaceholder')" />
            </div>

            <div class="md:col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.subtitle', { lang: getCurrentLangName() }) }}</label>
              <Input v-model="form.subtitle[currentLang]" :placeholder="t('admin.banners.form.subtitlePlaceholder')" />
            </div>

            <div class="md:col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.image') }}</label>
              <div
                class="cursor-pointer rounded-lg border border-dashed border-border p-4 text-center hover:border-primary"
                @click="triggerFileInput"
              >
                <input ref="fileInput" type="file" class="hidden" accept="image/*" @change="handleFileChange" />
                <div v-if="form.image" class="space-y-2">
                  <img :src="getImageUrl(form.image)" class="mx-auto h-36 rounded-lg object-cover" />
                  <div class="text-xs text-muted-foreground">{{ uploading ? t('admin.common.loading') : t('admin.banners.form.imageReplaceTip') }}</div>
                </div>
                <div v-else class="text-sm text-muted-foreground">{{ t('admin.banners.form.imageUploadHint') }}</div>
              </div>
            </div>

            <div class="md:col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.mobileImage') }}</label>
              <Input v-model="form.mobile_image" :placeholder="t('admin.banners.form.mobileImagePlaceholder')" />
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.linkType') }}</label>
              <Select v-model="form.link_type">
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.banners.form.linkTypePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="item in linkTypes" :key="item.value" :value="item.value">{{ item.label }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.linkValue') }}</label>
              <Input v-model="form.link_value" :disabled="form.link_type === 'none'" :placeholder="t('admin.banners.form.linkValuePlaceholder')" />
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.startAt') }}</label>
              <Input v-model="form.start_at" type="datetime-local" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.endAt') }}</label>
              <Input v-model="form.end_at" type="datetime-local" />
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.banners.form.sortOrder') }}</label>
              <Input v-model.number="form.sort_order" type="number" placeholder="0" />
            </div>

            <div class="flex items-center gap-6">
              <label class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input v-model="form.is_active" type="checkbox" class="h-4 w-4 accent-primary" />
                {{ t('admin.banners.form.activeNow') }}
              </label>
              <label class="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <input v-model="form.open_in_new_tab" type="checkbox" class="h-4 w-4 accent-primary" />
                {{ t('admin.banners.form.openInNewTab') }}
              </label>
            </div>
          </div>

          <div class="flex justify-end gap-3 border-t border-border pt-6">
            <Button type="button" variant="outline" @click="closeModal">{{ t('admin.common.cancel') }}</Button>
            <Button type="submit">{{ isEditing ? t('admin.banners.actions.saveChanges') : t('admin.banners.actions.createNow') }}</Button>
          </div>
        </form>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>

