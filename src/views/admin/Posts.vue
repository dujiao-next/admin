<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { adminAPI } from '@/api/admin'
import RichEditor from '@/components/RichEditor.vue'
import IdCell from '@/components/IdCell.vue'
import { getImageUrl } from '@/utils/image'
import { formatDate, getLocalizedText } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { notifyError } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'

const { t } = useI18n()
const loading = ref(false)
const uploading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const currentTab = ref('blog')
const fileInput = ref<HTMLInputElement | null>(null)
const currentLang = ref('zh-CN')
const route = useRoute()

const languages = computed(() => [
  { code: 'zh-CN', name: t('admin.common.lang.zhCN') },
  { code: 'zh-TW', name: t('admin.common.lang.zhTW') },
  { code: 'en-US', name: t('admin.common.lang.enUS') },
])

const posts = ref<any[]>([])
const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0,
  total_page: 0,
})
const jumpPage = ref('')

const form = reactive({
  id: 0,
  title: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as any,
  slug: '',
  summary: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as any,
  content: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as any,
  type: 'blog',
  thumbnail: '',
  is_published: true,
})

const getCurrentLangName = () => {
  return languages.value.find((item) => item.code === currentLang.value)?.name || t('admin.common.lang.zhCN')
}

const fetchPosts = async () => {
  loading.value = true
  try {
    const res = await adminAPI.getPosts({
      page: pagination.page,
      page_size: pagination.page_size,
      type: currentTab.value,
    })
    posts.value = (res.data.data as any[]) || []
    if (res.data.pagination) {
      Object.assign(pagination, res.data.pagination)
    }
  } catch {
    posts.value = []
  } finally {
    loading.value = false
  }
}

const changePage = (page: number) => {
  pagination.page = page
  fetchPosts()
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
  Object.assign(form, {
    id: 0,
    title: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    slug: '',
    summary: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    content: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    type: currentTab.value,
    thumbnail: '',
    is_published: true,
  })
  showModal.value = true
}

const openEditModal = (post: any) => {
  isEditing.value = true
  currentLang.value = 'zh-CN'
  Object.assign(form, {
    id: post.id,
    title: post.title || { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    slug: post.slug,
    summary: post.summary || { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    content: post.content || { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
    type: post.type,
    thumbnail: post.thumbnail,
    is_published: post.is_published,
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
      await adminAPI.updatePost(form.id, payload)
    } else {
      await adminAPI.createPost(payload)
    }
    closeModal()
    fetchPosts()
  } catch (err) {
    notifyError(t('admin.posts.errors.operationFailed', { message: (err as any).message || '' }))
  }
}

const handleDelete = async (post: any) => {
  const confirmed = await confirmAction({ description: t('admin.posts.confirmDelete', { name: getLocalizedText(post.title) }), confirmText: t('admin.common.delete'), variant: 'destructive' })
  if (!confirmed) return
  try {
    await adminAPI.deletePost(post.id)
    fetchPosts()
  } catch (err) {
    notifyError(t('admin.posts.errors.deleteFailed', { message: (err as any).message || '' }))
  }
}

const openEditById = async (rawId: unknown) => {
  const id = Number(rawId)
  if (!Number.isFinite(id) || id <= 0) return
  try {
    const res = await adminAPI.getPost(id)
    openEditModal(res.data.data as any)
  } catch (err) {
    notifyError(t('admin.posts.errors.operationFailed', { message: (err as any).message || '' }))
  }
}

const triggerFileInput = () => fileInput.value?.click()

const handleFileChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    uploading.value = true
    const formData = new FormData()
    formData.append('file', file)
		try {
			const res = await adminAPI.upload(formData, 'post')
			form.thumbnail = (res.data.data as any)?.url || ''
    } catch {
      notifyError(t('admin.posts.errors.uploadFailed'))
    } finally {
      uploading.value = false
    }
  }
}

onMounted(() => {
  fetchPosts()
  if (route.query.post_id) {
    openEditById(route.query.post_id)
  }
})

watch(
  () => route.query.post_id,
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
      <h1 class="text-2xl font-semibold">{{ t('admin.posts.title') }}</h1>
      <Button size="sm" class="gap-2" @click="openCreateModal">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('admin.posts.create') }}
      </Button>
    </div>

    <div class="flex w-fit gap-2 rounded-xl border border-border bg-card p-1">
      <button
        v-for="tab in ['blog', 'notice']"
        :key="tab"
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        :class="currentTab === tab ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'"
        @click="currentTab = tab; pagination.page = 1; fetchPosts()"
      >
        {{ tab === 'blog' ? t('admin.posts.tabs.blog') : t('admin.posts.tabs.notice') }}
      </button>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.posts.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.posts.table.title') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.posts.table.slug') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.posts.table.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.posts.table.createdAt') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.posts.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="6" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="posts.length === 0">
            <TableCell colspan="6" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.posts.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="post in posts" :key="post.id" class="hover:bg-muted/30 group">
            <TableCell class="px-6 py-4">
              <IdCell :value="post.id" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <div class="flex items-center gap-4">
                <div
                  v-if="post.thumbnail"
                  class="h-12 w-12 overflow-hidden rounded-lg border border-border bg-muted/40"
                >
                  <img :src="getImageUrl(post.thumbnail)" class="h-full w-full object-cover" />
                </div>
                <div class="font-medium text-foreground line-clamp-1">{{ getLocalizedText(post.title) }}</div>
              </div>
            </TableCell>
            <TableCell class="px-6 py-4 font-mono text-muted-foreground">{{ post.slug }}</TableCell>
            <TableCell class="px-6 py-4">
              <span
                class="inline-flex rounded-full border px-2.5 py-1 text-xs"
                :class="post.is_published ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-amber-700 border-amber-200 bg-amber-50'"
              >
                {{ post.is_published ? t('admin.posts.status.published') : t('admin.posts.status.draft') }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(post.created_at) }}</TableCell>
            <TableCell class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon-sm" variant="outline" @click="openEditModal(post)">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </Button>
                <Button size="icon-sm" variant="destructive" @click="handleDelete(post)">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </Button>
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
          <DialogTitle>{{ isEditing ? t('admin.posts.modal.editTitle') : t('admin.posts.modal.createTitle') }}</DialogTitle>
        </DialogHeader>
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <div class="border-b border-border">
            <div class="flex gap-4">
              <button
                v-for="lang in languages"
                :key="lang.code"
                type="button"
                class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
                :class="currentLang === lang.code ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
                @click="currentLang = lang.code"
              >
                {{ lang.name }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div class="col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                {{ t('admin.posts.form.title', { lang: getCurrentLangName() }) }}
              </label>
              <Input v-model="form.title[currentLang]" required />
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.posts.form.slug') }}</label>
              <Input v-model="form.slug" required :placeholder="t('admin.posts.form.slugPlaceholder')" />
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.posts.form.type') }}</label>
              <Select v-model="form.type">
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.posts.form.typeBlog')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blog">{{ t('admin.posts.form.typeBlog') }}</SelectItem>
                  <SelectItem value="notice">{{ t('admin.posts.form.typeNotice') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                {{ t('admin.posts.form.summary', { lang: getCurrentLangName() }) }}
              </label>
              <Textarea v-model="form.summary[currentLang]" rows="2" :placeholder="t('admin.posts.form.summaryPlaceholder')" />
            </div>

            <div class="col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.posts.form.thumbnail') }}</label>
              <div
                class="relative cursor-pointer rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/40"
                @click="triggerFileInput"
              >
                <input ref="fileInput" type="file" class="hidden" accept="image/*" @change="handleFileChange" />
                <div v-if="form.thumbnail" class="relative z-10">
                  <img :src="getImageUrl(form.thumbnail)" class="mx-auto h-48 rounded-lg object-cover shadow-sm" />
                  <div class="mt-2 text-xs text-muted-foreground">{{ t('admin.posts.form.thumbnailReplaceTip') }}</div>
                </div>
                <div v-else class="text-sm text-muted-foreground">{{ t('admin.posts.form.thumbnailUploadHint') }}</div>
                <div v-if="uploading" class="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80">
                  <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></div>
                </div>
              </div>
            </div>

            <div class="col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                {{ t('admin.posts.form.content', { lang: getCurrentLangName() }) }}
              </label>
              <RichEditor v-model="form.content[currentLang]" :placeholder="t('admin.posts.form.contentPlaceholder')" />
            </div>

            <div class="col-span-2 flex items-center gap-2 border-t border-border pt-4">
              <input v-model="form.is_published" type="checkbox" class="h-4 w-4 accent-primary" />
              <span class="text-sm text-muted-foreground">{{ t('admin.posts.form.publishNow') }}</span>
            </div>
          </div>

          <div class="flex justify-end gap-3 border-t border-border pt-6">
            <Button type="button" variant="outline" @click="closeModal">{{ t('admin.common.cancel') }}</Button>
            <Button type="submit">
              {{ isEditing ? t('admin.posts.actions.saveChanges') : t('admin.posts.actions.publishNow') }}
            </Button>
          </div>
        </form>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
