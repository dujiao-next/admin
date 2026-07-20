<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminMemberLevel } from '@/api/types'
import IdCell from '@/components/IdCell.vue'
import MediaPicker from '@/components/admin/MediaPicker.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { useListRefresh, type ListFetchOptions } from '@/composables/useListRefresh'
import { formatDate, getLocalizedText } from '@/utils/format'
import { getImageUrl } from '@/utils/image'
import { notifyError, notifySuccess } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'

const isImagePath = (val: string) => !!val && val.includes('/')

const { t } = useI18n()

const loading = ref(true)
const { refreshing, refreshList } = useListRefresh()
const levels = ref<AdminMemberLevel[]>([])
const pagination = ref({
  page: 1,
  page_size: 50,
  total: 0,
  total_page: 1,
})

const showModal = ref(false)
const submitting = ref(false)
const error = ref('')
const isEditing = ref(false)
const editingId = ref<number | null>(null)

const supportedLocales = ['zh-CN', 'zh-TW', 'en-US']

const iconMode = ref<'emoji' | 'image'>('emoji')
const iconCache = reactive({ emoji: '', image: '' })

const switchIconMode = (mode: 'emoji' | 'image') => {
  if (mode === iconMode.value) return
  iconCache[iconMode.value] = form.icon
  iconMode.value = mode
  form.icon = iconCache[mode]
}

const form = reactive({
  name: {} as Record<string, string>,
  slug: '',
  icon: '',
  discount_rate: 100,
  recharge_threshold: 0,
  spend_threshold: 0,
  is_default: false,
  sort_order: 0,
  is_active: true,
})

const resetForm = () => {
  form.name = {}
  form.slug = ''
  form.icon = ''
  form.discount_rate = 100
  form.recharge_threshold = 0
  form.spend_threshold = 0
  form.is_default = false
  form.sort_order = 0
  form.is_active = true
  iconMode.value = 'emoji'
  iconCache.emoji = ''
  iconCache.image = ''
}

const fetchLevels = async (options: ListFetchOptions = {}) => {
  if (!options.preserveRows) loading.value = true
  try {
    const response = await adminAPI.getMemberLevels({
      page: pagination.value.page,
      page_size: pagination.value.page_size,
    })
    levels.value = response.data.data || []
    if (response.data.pagination) {
      pagination.value = response.data.pagination
    }
  } catch {
    if (!options.preserveRows) levels.value = []
  } finally {
    if (!options.preserveRows) loading.value = false
  }
}

const refresh = () => {
  refreshList(() => fetchLevels({ preserveRows: true }))
}

const openCreateModal = () => {
  error.value = ''
  isEditing.value = false
  editingId.value = null
  resetForm()
  showModal.value = true
}

const openEditModal = (level: AdminMemberLevel) => {
  error.value = ''
  isEditing.value = true
  editingId.value = level.id
  form.name = { ...(level.name || {}) }
  form.slug = level.slug || ''
  form.icon = level.icon || ''
  form.discount_rate = Number(level.discount_rate) || 100
  form.recharge_threshold = Number(level.recharge_threshold) || 0
  form.spend_threshold = Number(level.spend_threshold) || 0
  form.is_default = Boolean(level.is_default)
  form.sort_order = level.sort_order || 0
  form.is_active = Boolean(level.is_active)
  iconMode.value = isImagePath(form.icon) ? 'image' : 'emoji'
  iconCache.emoji = iconMode.value === 'emoji' ? form.icon : ''
  iconCache.image = iconMode.value === 'image' ? form.icon : ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  isEditing.value = false
  editingId.value = null
}

const handleSubmit = async () => {
  error.value = ''
  if (!form.slug.trim()) {
    error.value = t('admin.memberLevels.form.slug') + ' is required'
    return
  }
  submitting.value = true
  try {
    const payload = {
      name: form.name,
      slug: form.slug.trim(),
      icon: form.icon.trim(),
      discount_rate: Number(form.discount_rate),
      recharge_threshold: Number(form.recharge_threshold),
      spend_threshold: Number(form.spend_threshold),
      is_default: form.is_default,
      sort_order: Number(form.sort_order),
      is_active: form.is_active,
    }
    if (isEditing.value && editingId.value) {
      await adminAPI.updateMemberLevel(editingId.value, payload)
    } else {
      await adminAPI.createMemberLevel(payload)
    }
    closeModal()
    fetchLevels()
  } catch (err: any) {
    error.value = err.message || t('admin.memberLevels.saveFailed')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (level: AdminMemberLevel) => {
  const name = getLocalizedText(level.name)
  const confirmed = await confirmAction({
    description: t('admin.memberLevels.deleteConfirm', { name }),
    confirmText: t('admin.common.delete'),
    variant: 'destructive',
  })
  if (!confirmed) return
  try {
    await adminAPI.deleteMemberLevel(level.id)
    fetchLevels()
  } catch (err: any) {
    notifyError(err.message || t('admin.memberLevels.deleteFailed'))
  }
}

const backfilling = ref(false)
const handleBackfill = async () => {
  const confirmed = await confirmAction({
    description: t('admin.memberLevels.backfillConfirm'),
    confirmText: t('admin.common.confirm'),
  })
  if (!confirmed) return
  backfilling.value = true
  try {
    const response = await adminAPI.backfillMemberLevels()
    const affected = response.data.data?.affected ?? 0
    notifySuccess(t('admin.memberLevels.backfillSuccess', { count: affected }))
  } catch (err: any) {
    notifyError(err.message || t('admin.memberLevels.backfillFailed'))
  } finally {
    backfilling.value = false
  }
}

const getLocaleLabel = (loc: string) => {
  const labels: Record<string, string> = { 'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'en-US': 'English' }
  return labels[loc] || loc
}

onMounted(() => {
  fetchLevels()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ t('admin.memberLevels.title') }}</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ t('admin.memberLevels.subtitle') }}</p>
      </div>
      <Button size="sm" class="w-full gap-2 sm:w-auto" @click="openCreateModal">
        <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('admin.memberLevels.create') }}
      </Button>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button size="sm" variant="outline" class="w-full sm:w-auto" :disabled="backfilling" @click="handleBackfill">
          {{ backfilling ? t('admin.memberLevels.backfilling') : t('admin.memberLevels.backfill') }}
        </Button>
        <Button size="sm" class="w-full sm:w-auto" :disabled="refreshing" @click="refresh">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[1028px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="min-w-[80px] px-6 py-3">{{ t('admin.memberLevels.table.id') }}</TableHead>
            <TableHead class="min-w-[88px] px-6 py-3">{{ t('admin.memberLevels.table.icon') }}</TableHead>
            <TableHead class="min-w-[90px] px-6 py-3">{{ t('admin.memberLevels.table.name') }}</TableHead>
            <TableHead class="min-w-[80px] px-6 py-3">{{ t('admin.memberLevels.table.slug') }}</TableHead>
            <TableHead class="min-w-[80px] px-6 py-3">{{ t('admin.memberLevels.table.discountRate') }}</TableHead>
            <TableHead class="min-w-[90px] px-6 py-3">{{ t('admin.memberLevels.table.rechargeThreshold') }}</TableHead>
            <TableHead class="min-w-[90px] px-6 py-3">{{ t('admin.memberLevels.table.spendThreshold') }}</TableHead>
            <TableHead class="min-w-[90px] px-6 py-3">{{ t('admin.memberLevels.table.sortOrder') }}</TableHead>
            <TableHead class="min-w-[88px] px-6 py-3">{{ t('admin.memberLevels.table.memberCount') }}</TableHead>
            <TableHead class="min-w-[90px] px-6 py-3">{{ t('admin.memberLevels.table.isActive') }}</TableHead>
            <TableHead class="min-w-[80px] px-6 py-3">{{ t('admin.memberLevels.table.createdAt') }}</TableHead>
            <TableHead class="min-w-[80px] px-6 py-3 text-right">{{ t('admin.memberLevels.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell :colspan="12" class="p-0">
              <TableSkeleton :columns="12" :rows="5" />
            </TableCell>
          </TableRow>
          <TableRow v-else-if="levels.length === 0">
            <TableCell colspan="12" class="px-6 py-8 text-center text-muted-foreground">
              {{ t('admin.memberLevels.empty') }}
            </TableCell>
          </TableRow>
          <TableRow v-for="level in levels" :key="level.id" class="hover:bg-muted/30">
            <TableCell class="min-w-[80px] px-6 py-4">
              <IdCell :value="level.id" />
            </TableCell>
            <TableCell class="min-w-[88px] px-6 py-4">
              <img v-if="level.icon && isImagePath(level.icon)" :src="getImageUrl(level.icon)" class="h-8 w-8 shrink-0 rounded object-cover" :alt="getLocalizedText(level.name)" @error="($event.target as HTMLImageElement).style.display = 'none'" />
              <span v-else-if="level.icon" class="text-lg">{{ level.icon }}</span>
              <span v-else class="text-xs text-muted-foreground">-</span>
            </TableCell>
            <TableCell class="min-w-[90px] px-6 py-4 text-foreground font-medium">
              <div class="flex items-center gap-2">
                <span class="break-words">{{ getLocalizedText(level.name) }}</span>
                <span
                  v-if="level.is_default"
                  class="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700"
                >
                  {{ t('admin.memberLevels.default') }}
                </span>
              </div>
            </TableCell>
            <TableCell class="min-w-[80px] px-6 py-4 text-xs text-muted-foreground font-mono break-all">
              {{ level.slug }}
            </TableCell>
            <TableCell class="min-w-[80px] px-6 py-4 text-foreground font-mono">
              {{ level.discount_rate }}%
            </TableCell>
            <TableCell class="min-w-[90px] px-6 py-4 text-xs text-muted-foreground font-mono">
              {{ Number(level.recharge_threshold) || '-' }}
            </TableCell>
            <TableCell class="min-w-[90px] px-6 py-4 text-xs text-muted-foreground font-mono">
              {{ Number(level.spend_threshold) || '-' }}
            </TableCell>
            <TableCell class="min-w-[90px] px-6 py-4 text-xs text-muted-foreground">
              {{ level.sort_order }}
            </TableCell>
            <TableCell class="min-w-[88px] px-6 py-4 text-xs font-mono text-muted-foreground">
              {{ level.member_count ?? 0 }}
            </TableCell>
            <TableCell class="min-w-[90px] px-6 py-4">
              <span
                class="inline-flex rounded-full border px-2.5 py-1 text-xs"
                :class="level.is_active
                  ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
                  : 'text-muted-foreground border-border bg-muted/30'"
              >
                {{ level.is_active ? t('admin.memberLevels.status.active') : t('admin.memberLevels.status.inactive') }}
              </span>
            </TableCell>
            <TableCell class="min-w-[80px] px-6 py-4 text-xs text-muted-foreground">
              {{ formatDate(level.created_at) }}
            </TableCell>
            <TableCell class="min-w-[80px] px-6 py-4 text-right">
              <div class="flex flex-wrap items-center justify-end gap-2">
                <Button size="sm" variant="outline" @click="openEditModal(level)">{{ t('admin.common.edit') }}</Button>
                <Button size="sm" variant="destructive" @click="handleDelete(level)">{{ t('admin.common.delete') }}</Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="showModal" @update:open="(value: boolean) => { if (!value) closeModal() }">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-3xl p-4 sm:p-6" @interact-outside="(e: Event) => e.preventDefault()">
        <DialogHeader>
          <DialogTitle>
            {{ isEditing ? t('admin.memberLevels.form.editTitle') : t('admin.memberLevels.form.createTitle') }}
          </DialogTitle>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <!-- Multi-locale name -->
            <div class="md:col-span-2">
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                {{ t('admin.memberLevels.form.name') }} *
              </label>
              <div class="space-y-2">
                <div v-for="loc in supportedLocales" :key="loc" class="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span class="w-full text-xs text-muted-foreground sm:w-20">{{ getLocaleLabel(loc) }}</span>
                  <Input
                    :model-value="form.name[loc] || ''"
                    @update:model-value="(v: string | number) => { form.name[loc] = String(v) }"
                    :placeholder="t('admin.memberLevels.form.namePlaceholder')"
                  />
                </div>
              </div>
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                {{ t('admin.memberLevels.form.slug') }} *
              </label>
              <Input v-model="form.slug" required :placeholder="t('admin.memberLevels.form.slugPlaceholder')" />
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                {{ t('admin.memberLevels.form.icon') }}
              </label>
              <div class="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                  :class="iconMode === 'emoji' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'"
                  @click="switchIconMode('emoji')"
                >
                  Emoji
                </button>
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                  :class="iconMode === 'image' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'"
                  @click="switchIconMode('image')"
                >
                  {{ t('admin.memberLevels.form.iconImage') }}
                </button>
              </div>
              <Input v-if="iconMode === 'emoji'" v-model="form.icon" :placeholder="t('admin.memberLevels.form.iconPlaceholder')" />
              <MediaPicker v-else v-model="form.icon" scene="common" />
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                {{ t('admin.memberLevels.form.discountRate') }}
              </label>
              <Input v-model.number="form.discount_rate" type="number" step="0.01" min="0" max="100" placeholder="100" />
              <p class="mt-1 text-[11px] leading-5 text-muted-foreground">
                {{ t('admin.memberLevels.form.discountRateHint') }}
              </p>
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                {{ t('admin.memberLevels.form.rechargeThreshold') }}
              </label>
              <Input v-model.number="form.recharge_threshold" type="number" step="0.01" min="0" placeholder="0" />
              <p class="mt-1 text-[11px] leading-5 text-muted-foreground">
                {{ t('admin.memberLevels.form.rechargeThresholdHint') }}
              </p>
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                {{ t('admin.memberLevels.form.spendThreshold') }}
              </label>
              <Input v-model.number="form.spend_threshold" type="number" step="0.01" min="0" placeholder="0" />
              <p class="mt-1 text-[11px] leading-5 text-muted-foreground">
                {{ t('admin.memberLevels.form.spendThresholdHint') }}
              </p>
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                {{ t('admin.memberLevels.form.sortOrder') }}
              </label>
              <Input v-model.number="form.sort_order" type="number" min="0" placeholder="0" />
              <p class="mt-1 text-[11px] leading-5 text-muted-foreground">
                {{ t('admin.memberLevels.form.sortOrderHint') }}
              </p>
            </div>

            <div class="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:items-center sm:gap-4">
              <div class="flex items-center gap-2">
                <Switch v-model="form.is_default" />
                <span class="text-xs text-muted-foreground">{{ t('admin.memberLevels.form.isDefault') }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Switch v-model="form.is_active" />
                <span class="text-xs text-muted-foreground">{{ t('admin.memberLevels.form.isActive') }}</span>
              </div>
            </div>
          </div>

          <div v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {{ error }}
          </div>

          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" class="w-full sm:w-auto" @click="closeModal">{{ t('admin.common.cancel') }}</Button>
            <Button type="submit" class="w-full sm:w-auto" :disabled="submitting">{{ t('admin.common.save') }}</Button>
          </div>
        </form>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
