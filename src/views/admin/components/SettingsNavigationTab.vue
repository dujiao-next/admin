<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { notifyError, notifySuccess } from '@/utils/notify'

const { t } = useI18n()

const MAX_CUSTOM_ITEMS = 10
const BUILTIN_KEYS = ['blog', 'notice', 'about'] as const
const supportedLanguages = ['zh-CN', 'zh-TW', 'en-US'] as const
type SupportedLanguage = (typeof supportedLanguages)[number]

const presetIcons = [
  { key: 'link', label: 'Link', path: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
  { key: 'document', label: 'Document', path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'globe', label: 'Globe', path: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9' },
  { key: 'star', label: 'Star', path: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { key: 'heart', label: 'Heart', path: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { key: 'chat', label: 'Chat', path: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { key: 'gift', label: 'Gift', path: 'M12 8v13m0-13V6a4 4 0 00-4-4 4 4 0 00-4 4v2h8zm0 0V6a4 4 0 014-4 4 4 0 014 4v2h-8zM5 8h14a1 1 0 011 1v3H4V9a1 1 0 011-1zm0 4h14v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7z' },
  { key: 'lightning', label: 'Lightning', path: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { key: 'shield', label: 'Shield', path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { key: 'book', label: 'Book', path: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { key: 'code', label: 'Code', path: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  { key: 'phone', label: 'Phone', path: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  { key: 'map', label: 'Map', path: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
  { key: 'music', label: 'Music', path: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
  { key: 'camera', label: 'Camera', path: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z' },
]

interface CustomNavItem {
  id: number
  title: Record<SupportedLanguage, string>
  link_type: 'internal' | 'external'
  url: string
  target: '_self' | '_blank'
  sort_order: number
  enabled: boolean
  icon: string
}

interface BuiltinNavItem {
  key: (typeof BUILTIN_KEYS)[number]
  enabled: boolean
  sort_order: number
}

const props = defineProps<{
  currentLang: SupportedLanguage
}>()

const emit = defineEmits<{
  saved: []
}>()

const submitting = ref(false)
const loaded = ref(false)

const form = reactive({
  builtin: [
    { key: 'blog', enabled: true, sort_order: 0 },
    { key: 'notice', enabled: true, sort_order: 1 },
    { key: 'about', enabled: true, sort_order: 2 },
  ] as BuiltinNavItem[],
  customItems: [] as CustomNavItem[],
})

const nextSortOrder = (): number => {
  const orders = [
    ...form.builtin.map((item) => item.sort_order),
    ...form.customItems.map((item) => item.sort_order),
  ]
  return orders.length ? Math.max(...orders) + 1 : 0
}

const createEmptyItem = (): CustomNavItem => ({
  id: Date.now(),
  title: { 'zh-CN': '', 'zh-TW': '', 'en-US': '' },
  link_type: 'internal',
  url: '',
  target: '_self',
  sort_order: nextSortOrder(),
  enabled: true,
  icon: 'link',
})

const addItem = () => {
  if (form.customItems.length >= MAX_CUSTOM_ITEMS) return
  form.customItems.push(createEmptyItem())
}

const removeItem = (index: number) => {
  form.customItems.splice(index, 1)
}

const fetchNavConfig = async () => {
  try {
    const res = await adminAPI.getSettings({ key: 'nav_config' })
    const data = res.data?.data
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      if (Array.isArray(d.builtin)) {
        // 规范数组形态：按 key 取 enabled/sort_order
        const byKey = new Map<string, Record<string, unknown>>()
        for (const raw of d.builtin as Array<Record<string, unknown>>) {
          const key = String(raw.key || '')
          if (key) byKey.set(key, raw)
        }
        form.builtin = BUILTIN_KEYS.map((key, index) => {
          const raw = byKey.get(key)
          return {
            key,
            enabled: raw ? raw.enabled !== false : true,
            sort_order: raw && typeof raw.sort_order === 'number' ? (raw.sort_order as number) : index,
          }
        })
      } else if (d.builtin && typeof d.builtin === 'object') {
        // 旧布尔字典：按默认序派生 sort_order（与后端一致）
        const b = d.builtin as Record<string, boolean>
        form.builtin = BUILTIN_KEYS.map((key, index) => ({
          key,
          enabled: b[key] !== false,
          sort_order: index,
        }))
      }
      if (Array.isArray(d.custom_items)) {
        form.customItems = (d.custom_items as Array<Record<string, unknown>>).map((item) => ({
          id: (item.id as number) || Date.now(),
          title: {
            'zh-CN': ((item.title as Record<string, string>)?.['zh-CN']) || '',
            'zh-TW': ((item.title as Record<string, string>)?.['zh-TW']) || '',
            'en-US': ((item.title as Record<string, string>)?.['en-US']) || '',
          },
          link_type: item.link_type === 'external' ? 'external' : 'internal',
          url: (item.url as string) || '',
          target: item.target === '_blank' ? '_blank' : '_self',
          sort_order: (item.sort_order as number) || 0,
          enabled: item.enabled !== false,
          icon: (item.icon as string) || 'link',
        }))
      }
    }
  } catch {
    // 首次使用，无数据
  } finally {
    loaded.value = true
  }
}

const save = async () => {
  submitting.value = true
  try {
    const payload = {
      key: 'nav_config',
      value: {
        builtin: form.builtin.map((item) => ({
          key: item.key,
          enabled: item.enabled,
          sort_order: item.sort_order,
        })),
        custom_items: form.customItems.map((item) => ({
          id: item.id,
          title: { ...item.title },
          link_type: item.link_type,
          url: item.url,
          target: item.target,
          sort_order: item.sort_order,
          enabled: item.enabled,
          icon: item.icon,
        })),
      },
    }
    await adminAPI.updateSettings(payload)
    notifySuccess(t('admin.settings.alerts.saveSuccess'))
    emit('saved')
  } catch {
    notifyError(t('admin.settings.alerts.saveFailed'))
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchNavConfig()
})

defineExpose({ save, submitting })
</script>

<template>
  <div v-if="loaded" class="space-y-6">
    <!-- 内置导航项 -->
    <div class="rounded-xl border border-border bg-card">
      <div class="border-b border-border bg-muted/40 px-6 py-4">
        <h2 class="text-lg font-semibold">{{ t('admin.settings.navigation.builtin.title') }}</h2>
        <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.navigation.builtin.subtitle') }}</p>
      </div>
      <div class="divide-y divide-border px-6">
        <div v-for="item in form.builtin" :key="item.key" class="flex items-center justify-between gap-4 py-4">
          <Label class="text-sm font-medium">{{ t(`admin.settings.navigation.builtin.${item.key}`) }}</Label>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">{{ t('admin.settings.navigation.custom.fields.sortOrder') }}</span>
              <Input v-model.number="item.sort_order" type="number" class="w-20" placeholder="0" />
            </div>
            <Switch v-model="item.enabled" />
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义导航项 -->
    <div class="rounded-xl border border-border bg-card">
      <div class="border-b border-border bg-muted/40 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">{{ t('admin.settings.navigation.custom.title') }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.navigation.custom.subtitle', { max: MAX_CUSTOM_ITEMS }) }}</p>
          </div>
          <button
            class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            :disabled="form.customItems.length >= MAX_CUSTOM_ITEMS"
            @click="addItem"
          >
            {{ form.customItems.length >= MAX_CUSTOM_ITEMS ? t('admin.settings.navigation.custom.maxReached') : t('admin.settings.navigation.custom.add') }}
          </button>
        </div>
      </div>

      <div v-if="form.customItems.length === 0" class="px-6 py-8 text-center text-sm text-muted-foreground">
        {{ t('admin.settings.navigation.custom.empty') }}
      </div>

      <div v-else class="divide-y divide-border">
        <div v-for="(item, index) in form.customItems" :key="item.id" class="px-6 py-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-muted-foreground">#{{ index + 1 }}</span>
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2 text-xs">
                <Switch v-model="item.enabled" />
                <Label class="text-xs">{{ t('admin.settings.navigation.custom.fields.enabled') }}</Label>
              </div>
              <button
                class="text-xs text-destructive hover:underline"
                @click="removeItem(index)"
              >
                {{ t('admin.settings.navigation.custom.delete') }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <!-- 图标 -->
            <div class="sm:col-span-2">
              <label class="mb-1 block text-xs font-medium text-muted-foreground">
                {{ t('admin.settings.navigation.custom.fields.icon') }}
              </label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="preset in presetIcons"
                  :key="preset.key"
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
                  :class="item.icon === preset.key ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background text-muted-foreground hover:border-primary/50'"
                  :title="preset.label"
                  @click="item.icon = preset.key"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" :d="preset.path" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 标题 -->
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">
                {{ t('admin.settings.navigation.custom.fields.title') }} ({{ props.currentLang }})
              </label>
              <Input v-model="item.title[props.currentLang]" :placeholder="t('admin.settings.navigation.custom.fields.title')" />
            </div>

            <!-- 链接类型 -->
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">
                {{ t('admin.settings.navigation.custom.fields.linkType') }}
              </label>
              <Select v-model="item.link_type">
                <SelectTrigger class="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">{{ t('admin.settings.navigation.custom.fields.linkTypeInternal') }}</SelectItem>
                  <SelectItem value="external">{{ t('admin.settings.navigation.custom.fields.linkTypeExternal') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- URL -->
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">
                {{ t('admin.settings.navigation.custom.fields.url') }}
              </label>
              <Input
                v-model="item.url"
                :placeholder="item.link_type === 'internal' ? t('admin.settings.navigation.custom.fields.urlPlaceholderInternal') : t('admin.settings.navigation.custom.fields.urlPlaceholderExternal')"
              />
            </div>

            <!-- 打开方式 -->
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">
                {{ t('admin.settings.navigation.custom.fields.target') }}
              </label>
              <Select v-model="item.target">
                <SelectTrigger class="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_self">{{ t('admin.settings.navigation.custom.fields.targetSelf') }}</SelectItem>
                  <SelectItem value="_blank">{{ t('admin.settings.navigation.custom.fields.targetBlank') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- 排序 -->
            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">
                {{ t('admin.settings.navigation.custom.fields.sortOrder') }}
              </label>
              <Input v-model.number="item.sort_order" type="number" placeholder="0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
