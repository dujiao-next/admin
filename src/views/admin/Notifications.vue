<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminNotificationLog } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { formatDate, toRFC3339 } from '@/utils/format'
import { notifyError, notifySuccess } from '@/utils/notify'
import SettingsNotificationTab from './components/SettingsNotificationTab.vue'

const { t } = useI18n()
const loading = ref(false)
const notificationTabRef = ref<InstanceType<typeof SettingsNotificationTab>>()
const supportedLanguages = ['zh-CN', 'zh-TW', 'en-US'] as const
type SupportedLanguage = (typeof supportedLanguages)[number]

const currentLang = ref<SupportedLanguage>('zh-CN')
const notificationTesting = ref(false)
const notificationLogsLoading = ref(false)
const notificationLogs = ref<AdminNotificationLog[]>([])
const notificationLogPagination = ref({
  page: 1,
  page_size: 10,
  total: 0,
  total_page: 1,
})

const languages = computed(() => [
  { code: 'zh-CN' as SupportedLanguage, name: t('admin.common.lang.zhCN') },
  { code: 'zh-TW' as SupportedLanguage, name: t('admin.common.lang.zhTW') },
  { code: 'en-US' as SupportedLanguage, name: t('admin.common.lang.enUS') },
])

const createNotificationLocalizedTemplate = () => ({ title: '', body: '' })
const createNotificationSceneTemplate = () => ({
  'zh-CN': createNotificationLocalizedTemplate(),
  'zh-TW': createNotificationLocalizedTemplate(),
  'en-US': createNotificationLocalizedTemplate(),
})

const notificationData = reactive({
  default_locale: 'zh-CN',
  dedupe_ttl_seconds: 300,
  inventory_alert_interval_seconds: 1800,
  payment_order_alert_interval_seconds: 1800,
  payment_order_alert_check_interval_seconds: 86400,
  ignored_product_ids_text: '',
  channels: {
    email: {
      enabled: false,
      recipients_text: '',
    },
    telegram: {
      enabled: false,
      recipients_text: '',
    },
  },
  scenes: {
    wallet_recharge_success: true,
    order_paid_success: true,
    manual_fulfillment_pending: true,
    exception_alert: true,
  },
  templates: {
    wallet_recharge_success: createNotificationSceneTemplate(),
    order_paid_success: createNotificationSceneTemplate(),
    manual_fulfillment_pending: createNotificationSceneTemplate(),
    exception_alert: createNotificationSceneTemplate(),
  },
})

const testForm = reactive({
  channel: 'email',
  target: '',
  scene: 'order_paid_success',
})

const notificationLogFilters = reactive({
  channel: '__all__',
  status: '__all__',
  eventType: '__all__',
  isTest: '__all__',
  createdFrom: '',
  createdTo: '',
})

const normalizeNumber = (value: unknown, fallback: number) => {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return parsed
}

const joinRecipients = (items: unknown) => {
  if (!Array.isArray(items)) return ''
  return items
    .map((item) => String(item || '').trim())
    .filter((item) => item !== '')
    .join('\n')
}

const joinNumericLines = (items: unknown) => {
  if (!Array.isArray(items)) return ''
  return items
    .map((item) => String(item || '').trim())
    .filter((item) => item !== '')
    .join('\n')
}

const normalizeNotificationSceneTemplate = (raw: unknown) => {
  const fallback = createNotificationSceneTemplate()
  if (!raw || typeof raw !== 'object') return fallback
  const record = raw as Record<string, unknown>
  ;(['zh-CN', 'zh-TW', 'en-US'] as const).forEach((lang) => {
    const item = record[lang] as Record<string, unknown> | undefined
    if (!item || typeof item !== 'object') return
    fallback[lang].title = typeof item.title === 'string' ? item.title : ''
    fallback[lang].body = typeof item.body === 'string' ? item.body : ''
  })
  return fallback
}

const splitRecipients = (raw: string) => {
  return raw
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const currentChannelTargets = computed(() => {
  if (testForm.channel === 'telegram') {
    return splitRecipients(notificationData.channels.telegram.recipients_text)
  }
  return splitRecipients(notificationData.channels.email.recipients_text)
})

const testScenes = computed(() => [
  { value: 'wallet_recharge_success', label: t('admin.settings.notification.scenes.walletRechargeSuccess') },
  { value: 'order_paid_success', label: t('admin.settings.notification.scenes.orderPaidSuccess') },
  { value: 'manual_fulfillment_pending', label: t('admin.settings.notification.scenes.manualFulfillmentPending') },
  { value: 'exception_alert', label: t('admin.settings.notification.scenes.exceptionAlert') },
])

const syncTestTarget = (force = false) => {
  if (!force && testForm.target.trim() !== '') {
    return
  }
  testForm.target = currentChannelTargets.value[0] || ''
}

const fetchSettings = async () => {
  loading.value = true
  try {
    const response = await adminAPI.getNotificationCenterSettings()
    if (!response.data?.data) {
      return
    }

    const notification = response.data.data as Record<string, unknown>
    notificationData.default_locale = String(notification.default_locale || 'zh-CN')
    notificationData.dedupe_ttl_seconds = normalizeNumber(notification.dedupe_ttl_seconds, 300)
    notificationData.inventory_alert_interval_seconds = normalizeNumber(notification.inventory_alert_interval_seconds, 1800)
    notificationData.payment_order_alert_interval_seconds = normalizeNumber(notification.payment_order_alert_interval_seconds ?? notification.payment_failed_alert_interval_seconds, 1800)
    notificationData.payment_order_alert_check_interval_seconds = normalizeNumber(notification.payment_order_alert_check_interval_seconds, 86400)
    notificationData.ignored_product_ids_text = joinNumericLines(notification.ignored_product_ids)

    const notifChannels = notification.channels as Record<string, Record<string, unknown>> | undefined
    const notifEmail = notifChannels?.email
    const notifTelegram = notifChannels?.telegram
    notificationData.channels.email.enabled = !!notifEmail?.enabled
    notificationData.channels.email.recipients_text = joinRecipients(notifEmail?.recipients)
    notificationData.channels.telegram.enabled = !!notifTelegram?.enabled
    notificationData.channels.telegram.recipients_text = joinRecipients(notifTelegram?.recipients)

    const notifScenes = notification.scenes as Record<string, unknown> | undefined
    notificationData.scenes.wallet_recharge_success = !!notifScenes?.wallet_recharge_success
    notificationData.scenes.order_paid_success = !!notifScenes?.order_paid_success
    notificationData.scenes.manual_fulfillment_pending = !!notifScenes?.manual_fulfillment_pending
    notificationData.scenes.exception_alert = !!notifScenes?.exception_alert

    const notifTemplates = notification.templates as Record<string, unknown> | undefined
    notificationData.templates.wallet_recharge_success = normalizeNotificationSceneTemplate(notifTemplates?.wallet_recharge_success)
    notificationData.templates.order_paid_success = normalizeNotificationSceneTemplate(notifTemplates?.order_paid_success)
    notificationData.templates.manual_fulfillment_pending = normalizeNotificationSceneTemplate(notifTemplates?.manual_fulfillment_pending)
    notificationData.templates.exception_alert = normalizeNotificationSceneTemplate(notifTemplates?.exception_alert)
    syncTestTarget(true)
  } catch (err: any) {
    notifyError(err?.response?.data?.message || t('admin.settings.alerts.loadFailed'))
  } finally {
    loading.value = false
  }
}

const saveSettings = async () => {
  await notificationTabRef.value?.save()
}

const fetchNotificationLogs = async (page = 1) => {
  notificationLogsLoading.value = true
  try {
    const isTest = normalizeFilterValue(notificationLogFilters.isTest)
    const response = await adminAPI.listNotificationLogs({
      page,
      page_size: notificationLogPagination.value.page_size,
      channel: normalizeFilterValue(notificationLogFilters.channel) || undefined,
      status: normalizeFilterValue(notificationLogFilters.status) || undefined,
      event_type: normalizeFilterValue(notificationLogFilters.eventType) || undefined,
      is_test: isTest === '' ? undefined : isTest === 'true',
      created_from: toRFC3339(notificationLogFilters.createdFrom),
      created_to: toRFC3339(notificationLogFilters.createdTo),
    })
    notificationLogs.value = Array.isArray(response.data.data) ? response.data.data : []
    notificationLogPagination.value = response.data.pagination || notificationLogPagination.value
  } catch (err: any) {
    notificationLogs.value = []
    notifyError(err?.response?.data?.message || t('admin.settings.notification.logs.failed'))
  } finally {
    notificationLogsLoading.value = false
  }
}

const handleNotificationLogSearch = () => {
  fetchNotificationLogs(1)
}

const debouncedNotificationLogSearch = useDebounceFn(handleNotificationLogSearch, 300)

const resetNotificationLogFilters = () => {
  notificationLogFilters.channel = '__all__'
  notificationLogFilters.status = '__all__'
  notificationLogFilters.eventType = '__all__'
  notificationLogFilters.isTest = '__all__'
  notificationLogFilters.createdFrom = ''
  notificationLogFilters.createdTo = ''
  fetchNotificationLogs(1)
}

const changeNotificationLogPage = (page: number) => {
  if (page < 1 || page > notificationLogPagination.value.total_page) return
  fetchNotificationLogs(page)
}

const notificationChannelLabel = (value: string) => {
  if (value === 'telegram') return t('admin.settings.notification.channels.telegram.title')
  return t('admin.settings.notification.channels.email.title')
}

const notificationSceneLabel = (value: string) => {
  const keyMap: Record<string, string> = {
    wallet_recharge_success: 'admin.settings.notification.scenes.walletRechargeSuccess',
    order_paid_success: 'admin.settings.notification.scenes.orderPaidSuccess',
    manual_fulfillment_pending: 'admin.settings.notification.scenes.manualFulfillmentPending',
    exception_alert: 'admin.settings.notification.scenes.exceptionAlert',
  }
  const key = keyMap[value]
  if (!key) return value || '-'
  return t(key)
}

const notificationLogStatusLabel = (value: string) => {
  if (value === 'success') return t('admin.settings.notification.logs.status.success')
  return t('admin.settings.notification.logs.status.failed')
}

const notificationLogStatusClass = (value: string) => {
  if (value === 'success') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
  return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300'
}

const notificationLogTypeLabel = (value: boolean) => {
  return value ? t('admin.settings.notification.logs.type.test') : t('admin.settings.notification.logs.type.live')
}

const sendNotificationTest = async () => {
  if (testForm.target.trim() === '') {
    notifyError(t('admin.settings.notification.test.targetRequired'))
    return
  }
  notificationTesting.value = true
  try {
    await adminAPI.testNotificationCenterSettings({
      channel: testForm.channel,
      target: testForm.target.trim(),
      scene: testForm.scene,
      locale: currentLang.value,
    })
    notifySuccess(t('admin.settings.notification.test.success'))
    await fetchNotificationLogs(1)
  } catch (err: any) {
    notifyError(err?.response?.data?.message || t('admin.settings.notification.test.failed'))
  } finally {
    notificationTesting.value = false
  }
}

onMounted(async () => {
  await fetchSettings()
  await fetchNotificationLogs()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ t('admin.settings.notification.title') }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('admin.settings.notification.subtitle') }}</p>
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex max-w-full overflow-x-auto rounded-lg border border-border bg-card p-1">
          <button
            v-for="lang in languages"
            :key="lang.code"
            class="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            :class="currentLang === lang.code ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="currentLang = lang.code"
          >
            {{ lang.name }}
          </button>
        </div>
        <Button size="sm" class="w-full sm:w-auto" :disabled="loading || notificationTabRef?.submitting" @click="saveSettings">
          <span v-if="loading" class="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></span>
          {{ loading ? t('admin.settings.actions.saving') : t('admin.settings.actions.save') }}
        </Button>
      </div>
    </div>

    <SettingsNotificationTab ref="notificationTabRef" :data="notificationData" :current-lang="currentLang" @saved="fetchSettings" />

    <div class="rounded-xl border border-border bg-card p-6">
      <div class="flex flex-col gap-2 border-b border-border pb-4">
        <h2 class="text-lg font-semibold">{{ t('admin.settings.notification.test.title') }}</h2>
        <p class="text-xs text-muted-foreground">{{ t('admin.settings.notification.test.subtitle') }}</p>
      </div>
      <div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div class="space-y-2">
          <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.test.channel') }}</label>
          <Select v-model="testForm.channel" @update:modelValue="syncTestTarget(true)">
            <SelectTrigger class="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">{{ t('admin.settings.notification.channels.email.title') }}</SelectItem>
              <SelectItem value="telegram">{{ t('admin.settings.notification.channels.telegram.title') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2">
          <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.test.scene') }}</label>
          <Select v-model="testForm.scene">
            <SelectTrigger class="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="scene in testScenes" :key="scene.value" :value="scene.value">{{ scene.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2 lg:col-span-2">
          <div class="flex min-h-6 items-center justify-between gap-3">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.test.target') }}</label>
            <button
              v-if="currentChannelTargets.length > 0"
              type="button"
              class="text-xs text-primary hover:underline"
              @click="syncTestTarget(true)"
            >
              {{ t('admin.settings.notification.test.useFirstRecipient') }}
            </button>
          </div>
          <Input v-model="testForm.target" class="h-10" :placeholder="t('admin.settings.notification.test.targetPlaceholder')" />
        </div>
      </div>
      <div v-if="currentChannelTargets.length > 0" class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="target in currentChannelTargets.slice(0, 3)"
          :key="target"
          type="button"
          class="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          @click="testForm.target = target"
        >
          {{ target }}
        </button>
      </div>
      <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-muted-foreground">{{ t('admin.settings.notification.test.hint') }}</p>
        <Button variant="secondary" :disabled="notificationTesting" @click="sendNotificationTest">
          {{ notificationTesting ? t('admin.settings.notification.test.sending') : t('admin.settings.notification.test.sendAction') }}
        </Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card p-6">
      <div class="flex flex-col gap-2 border-b border-border pb-4">
        <h2 class="text-lg font-semibold">{{ t('admin.settings.notification.logs.title') }}</h2>
        <p class="text-xs text-muted-foreground">{{ t('admin.settings.notification.logs.subtitle') }}</p>
      </div>

      <div class="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select v-model="notificationLogFilters.channel" @update:modelValue="handleNotificationLogSearch">
          <SelectTrigger class="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{{ t('admin.settings.notification.logs.filters.allChannels') }}</SelectItem>
            <SelectItem value="email">{{ t('admin.settings.notification.channels.email.title') }}</SelectItem>
            <SelectItem value="telegram">{{ t('admin.settings.notification.channels.telegram.title') }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="notificationLogFilters.status" @update:modelValue="handleNotificationLogSearch">
          <SelectTrigger class="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{{ t('admin.settings.notification.logs.filters.allStatuses') }}</SelectItem>
            <SelectItem value="success">{{ t('admin.settings.notification.logs.status.success') }}</SelectItem>
            <SelectItem value="failed">{{ t('admin.settings.notification.logs.status.failed') }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="notificationLogFilters.eventType" @update:modelValue="handleNotificationLogSearch">
          <SelectTrigger class="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{{ t('admin.settings.notification.logs.filters.allScenes') }}</SelectItem>
            <SelectItem v-for="scene in testScenes" :key="scene.value" :value="scene.value">{{ scene.label }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="notificationLogFilters.isTest" @update:modelValue="handleNotificationLogSearch">
          <SelectTrigger class="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{{ t('admin.settings.notification.logs.filters.allTypes') }}</SelectItem>
            <SelectItem value="false">{{ t('admin.settings.notification.logs.type.live') }}</SelectItem>
            <SelectItem value="true">{{ t('admin.settings.notification.logs.type.test') }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          v-model="notificationLogFilters.createdFrom"
          type="datetime-local"
          class="h-10"
          :placeholder="t('admin.settings.notification.logs.filters.createdFrom')"
          @update:modelValue="debouncedNotificationLogSearch"
        />
        <Input
          v-model="notificationLogFilters.createdTo"
          type="datetime-local"
          class="h-10"
          :placeholder="t('admin.settings.notification.logs.filters.createdTo')"
          @update:modelValue="debouncedNotificationLogSearch"
        />
      </div>

      <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button size="sm" variant="outline" class="w-full sm:w-auto" @click="resetNotificationLogFilters">
          {{ t('admin.settings.notification.logs.actions.reset') }}
        </Button>
        <Button size="sm" variant="outline" class="w-full sm:w-auto" @click="fetchNotificationLogs(notificationLogPagination.page)">
          {{ t('admin.settings.notification.logs.actions.refresh') }}
        </Button>
        <Button size="sm" class="w-full sm:w-auto" @click="handleNotificationLogSearch">
          {{ t('admin.settings.notification.logs.actions.search') }}
        </Button>
      </div>

      <div class="mt-6 overflow-x-auto rounded-xl border border-border">
        <Table class="min-w-[940px]">
          <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <TableRow>
              <TableHead class="min-w-[100px] px-4 py-3">{{ t('admin.settings.notification.logs.table.createdAt') }}</TableHead>
              <TableHead class="min-w-[90px] px-4 py-3">{{ t('admin.settings.notification.logs.table.scene') }}</TableHead>
              <TableHead class="min-w-[100px] px-4 py-3">{{ t('admin.settings.notification.logs.table.channel') }}</TableHead>
              <TableHead class="min-w-[90px] px-4 py-3">{{ t('admin.settings.notification.logs.table.recipient') }}</TableHead>
              <TableHead class="min-w-[90px] px-4 py-3">{{ t('admin.settings.notification.logs.table.type') }}</TableHead>
              <TableHead class="min-w-[90px] px-4 py-3">{{ t('admin.settings.notification.logs.table.status') }}</TableHead>
              <TableHead class="min-w-[90px] px-4 py-3">{{ t('admin.settings.notification.logs.table.content') }}</TableHead>
              <TableHead class="min-w-[90px] px-4 py-3">{{ t('admin.settings.notification.logs.table.error') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody class="divide-y divide-border">
            <TableRow v-if="notificationLogsLoading">
              <TableCell :colspan="8" class="p-0">
                <TableSkeleton :columns="8" :rows="5" />
              </TableCell>
            </TableRow>
            <TableRow v-else-if="notificationLogs.length === 0">
              <TableCell colspan="8" class="px-6 py-8 text-center text-muted-foreground">
                {{ t('admin.settings.notification.logs.empty') }}
              </TableCell>
            </TableRow>
            <TableRow v-for="item in notificationLogs" :key="item.id" class="hover:bg-muted/30">
              <TableCell class="px-4 py-4 text-xs text-muted-foreground">{{ formatDate(item.created_at) }}</TableCell>
              <TableCell class="px-4 py-4 text-xs text-foreground">
                <div>{{ notificationSceneLabel(item.event_type) }}</div>
                <div class="mt-1 text-muted-foreground">{{ item.locale || '-' }}</div>
              </TableCell>
              <TableCell class="px-4 py-4 text-xs text-foreground">{{ notificationChannelLabel(item.channel) }}</TableCell>
              <TableCell class="px-4 py-4 font-mono text-xs text-foreground break-all">{{ item.recipient || '-' }}</TableCell>
              <TableCell class="px-4 py-4 text-xs text-muted-foreground">{{ notificationLogTypeLabel(item.is_test) }}</TableCell>
              <TableCell class="px-4 py-4">
                <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="notificationLogStatusClass(item.status)">
                  {{ notificationLogStatusLabel(item.status) }}
                </span>
              </TableCell>
              <TableCell class="px-4 py-4 text-xs text-foreground">
                <div class="font-medium break-words">{{ item.title || '-' }}</div>
                <div class="mt-1 whitespace-pre-line break-words text-muted-foreground">{{ item.body || '-' }}</div>
              </TableCell>
              <TableCell class="px-4 py-4 whitespace-pre-line break-words text-xs text-muted-foreground">
                {{ item.error_message || '-' }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button
          size="sm"
          variant="outline"
          :disabled="notificationLogPagination.page <= 1"
          @click="changeNotificationLogPage(notificationLogPagination.page - 1)"
        >
          {{ t('admin.settings.notification.logs.actions.prev') }}
        </Button>
        <span class="text-xs text-muted-foreground">
          {{ notificationLogPagination.page }} / {{ notificationLogPagination.total_page }}
        </span>
        <Button
          size="sm"
          variant="outline"
          :disabled="notificationLogPagination.page >= notificationLogPagination.total_page"
          @click="changeNotificationLogPage(notificationLogPagination.page + 1)"
        >
          {{ t('admin.settings.notification.logs.actions.next') }}
        </Button>
      </div>
    </div>
  </div>
</template>
