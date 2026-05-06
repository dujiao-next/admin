<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminProduct } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getLocalizedText } from '@/utils/format'
import { notifyError, notifySuccess } from '@/utils/notify'

const { t } = useI18n()

const supportedLanguages = ['zh-CN', 'zh-TW', 'en-US'] as const
type SupportedLanguage = (typeof supportedLanguages)[number]

type NotificationLocalizedTemplate = { title: string; body: string }
type NotificationSceneTemplate = Record<SupportedLanguage, NotificationLocalizedTemplate>

interface NotificationData {
  default_locale: string
  dedupe_ttl_seconds: number
  inventory_alert_interval_seconds: number
  payment_order_alert_interval_seconds: number
  payment_order_alert_check_interval_seconds: number
  ignored_product_ids_text: string
  channels: {
    email: {
      enabled: boolean
      recipients_text: string
    }
    telegram: {
      enabled: boolean
      recipients_text: string
    }
  }
  scenes: {
    wallet_recharge_success: boolean
    order_paid_success: boolean
    manual_fulfillment_pending: boolean
    exception_alert: boolean
  }
  templates: {
    wallet_recharge_success: NotificationSceneTemplate
    order_paid_success: NotificationSceneTemplate
    manual_fulfillment_pending: NotificationSceneTemplate
    exception_alert: NotificationSceneTemplate
  }
}

const props = defineProps<{
  data: NotificationData
  currentLang: SupportedLanguage
}>()

const emit = defineEmits<{
  saved: []
}>()

const submitting = ref(false)
const productOptionsLoading = ref(false)
const productKeyword = ref('')
const productOptions = ref<AdminProduct[]>([])
const selectedIgnoredProductValue = ref('')
const ignoredProducts = ref<Array<{ id: number; label: string }>>([])

const createNotificationLocalizedTemplate = (): NotificationLocalizedTemplate => ({ title: '', body: '' })
const createNotificationSceneTemplate = (): NotificationSceneTemplate => ({
  'zh-CN': createNotificationLocalizedTemplate(),
  'zh-TW': createNotificationLocalizedTemplate(),
  'en-US': createNotificationLocalizedTemplate(),
})

const deepCloneTemplate = (src: NotificationSceneTemplate): NotificationSceneTemplate => {
  const result = createNotificationSceneTemplate()
  ;(['zh-CN', 'zh-TW', 'en-US'] as const).forEach((lang) => {
    result[lang].title = src[lang]?.title || ''
    result[lang].body = src[lang]?.body || ''
  })
  return result
}

const form = reactive({
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

const syncFromProps = () => {
  form.default_locale = props.data.default_locale
  form.dedupe_ttl_seconds = props.data.dedupe_ttl_seconds
  form.inventory_alert_interval_seconds = props.data.inventory_alert_interval_seconds
  form.payment_order_alert_interval_seconds = props.data.payment_order_alert_interval_seconds
  form.payment_order_alert_check_interval_seconds = props.data.payment_order_alert_check_interval_seconds
  form.ignored_product_ids_text = props.data.ignored_product_ids_text
  form.channels.email.enabled = props.data.channels.email.enabled
  form.channels.email.recipients_text = props.data.channels.email.recipients_text
  form.channels.telegram.enabled = props.data.channels.telegram.enabled
  form.channels.telegram.recipients_text = props.data.channels.telegram.recipients_text
  Object.assign(form.scenes, props.data.scenes)
  form.templates.wallet_recharge_success = deepCloneTemplate(props.data.templates.wallet_recharge_success)
  form.templates.order_paid_success = deepCloneTemplate(props.data.templates.order_paid_success)
  form.templates.manual_fulfillment_pending = deepCloneTemplate(props.data.templates.manual_fulfillment_pending)
  form.templates.exception_alert = deepCloneTemplate(props.data.templates.exception_alert)
}

syncFromProps()

const splitRecipients = (raw: string) => {
  return raw
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

const splitNumericIDs = (raw: string) => {
  const seen = new Set<number>()
  return raw
    .split(/\r?\n|,/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0)
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
}

const notifyErrorIfNeeded = (err: unknown, fallback: string) => {
  const known = err as Error & { __notified?: boolean }
  if (known?.__notified) return
  notifyError(known?.message || fallback)
}

const buildProductLabel = (product: AdminProduct) => {
  const name = getLocalizedText(product.title || {})
  return name ? `#${product.id} ${name}` : `#${product.id}`
}

const syncIgnoredProductIDsText = () => {
  form.ignored_product_ids_text = ignoredProducts.value.map((item) => String(item.id)).join('\n')
}

const syncIgnoredProductsFromText = async () => {
  const ids = splitNumericIDs(form.ignored_product_ids_text)
  if (ids.length === 0) {
    ignoredProducts.value = []
    return
  }
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await adminAPI.getProduct(id)
        const product = response.data?.data
        if (!product) return { id, label: `#${id}` }
        return { id, label: buildProductLabel(product) }
      } catch {
        return { id, label: `#${id}` }
      }
    }),
  )
  ignoredProducts.value = results
}

const searchProducts = async () => {
  productOptionsLoading.value = true
  try {
    const response = await adminAPI.getProducts({
      page: 1,
      page_size: 20,
      search: productKeyword.value.trim() || undefined,
    })
    productOptions.value = Array.isArray(response.data?.data) ? response.data.data : []
  } catch (err) {
    notifyErrorIfNeeded(err, t('admin.settings.notification.inventory.searchFailed'))
  } finally {
    productOptionsLoading.value = false
  }
}

const addIgnoredProduct = () => {
  const productID = Number(selectedIgnoredProductValue.value)
  if (!Number.isInteger(productID) || productID <= 0) {
    notifyError(t('admin.settings.notification.inventory.productRequired'))
    return
  }
  if (ignoredProducts.value.some((item) => item.id === productID)) {
    return
  }
  const product = productOptions.value.find((item) => item.id === productID)
  ignoredProducts.value = [
    ...ignoredProducts.value,
    {
      id: productID,
      label: product ? buildProductLabel(product) : `#${productID}`,
    },
  ]
  syncIgnoredProductIDsText()
  selectedIgnoredProductValue.value = ''
}

const removeIgnoredProduct = (productID: number) => {
  ignoredProducts.value = ignoredProducts.value.filter((item) => item.id !== productID)
  syncIgnoredProductIDsText()
}

void syncIgnoredProductsFromText()

watch(() => props.data, () => {
  syncFromProps()
  void syncIgnoredProductsFromText()
}, { deep: true })

const save = async () => {
  submitting.value = true
  try {
    syncIgnoredProductIDsText()
    const payload = {
      default_locale: form.default_locale,
      dedupe_ttl_seconds: Number(form.dedupe_ttl_seconds),
      inventory_alert_interval_seconds: Number(form.inventory_alert_interval_seconds),
      payment_order_alert_interval_seconds: Number(form.payment_order_alert_interval_seconds),
      payment_order_alert_check_interval_seconds: Number(form.payment_order_alert_check_interval_seconds),
      ignored_product_ids: splitNumericIDs(form.ignored_product_ids_text),
      channels: {
        email: {
          enabled: form.channels.email.enabled,
          recipients: splitRecipients(form.channels.email.recipients_text),
        },
        telegram: {
          enabled: form.channels.telegram.enabled,
          recipients: splitRecipients(form.channels.telegram.recipients_text),
        },
      },
      scenes: {
        wallet_recharge_success: form.scenes.wallet_recharge_success,
        order_paid_success: form.scenes.order_paid_success,
        manual_fulfillment_pending: form.scenes.manual_fulfillment_pending,
        exception_alert: form.scenes.exception_alert,
      },
      templates: form.templates,
    }
    await adminAPI.updateNotificationCenterSettings(payload)
    notifySuccess(t('admin.settings.alerts.saveSuccess'))
    emit('saved')
  } catch (err) {
    notifyErrorIfNeeded(err, t('admin.settings.alerts.saveFailed'))
  } finally {
    submitting.value = false
  }
}

defineExpose({ save, submitting })
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-xl border border-border bg-card">
      <div class="border-b border-border bg-muted/40 px-6 py-4">
        <h2 class="text-lg font-semibold">{{ t('admin.settings.notification.title') }}</h2>
        <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.notification.subtitle') }}</p>
      </div>

      <div class="space-y-6 p-6">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.defaultLocale') }}</label>
            <Select v-model="form.default_locale">
              <SelectTrigger class="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">{{ t('admin.common.lang.zhCN') }}</SelectItem>
                <SelectItem value="zh-TW">{{ t('admin.common.lang.zhTW') }}</SelectItem>
                <SelectItem value="en-US">{{ t('admin.common.lang.enUS') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.dedupeTTLSeconds') }}</label>
            <Input v-model.number="form.dedupe_ttl_seconds" type="number" min="30" max="86400" />
          </div>
        </div>

        <div class="rounded-xl border border-border bg-muted/20 p-4">
          <h3 class="text-sm font-semibold">{{ t('admin.settings.notification.inventory.title') }}</h3>
          <div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.inventory.intervalSeconds') }}</label>
              <Input v-model.number="form.inventory_alert_interval_seconds" type="number" min="60" max="604800" />
              <p class="text-xs text-muted-foreground">{{ t('admin.settings.notification.inventory.intervalHint') }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.inventory.ignoredProducts') }}</label>
              <div class="rounded-lg border border-border bg-background/80 p-3">
                <div class="flex flex-col gap-2 sm:flex-row">
                  <Input
                    v-model="productKeyword"
                    :placeholder="t('admin.settings.notification.inventory.searchPlaceholder')"
                    @keyup.enter="searchProducts"
                  />
                  <Button variant="outline" class="sm:w-auto" :disabled="productOptionsLoading" @click="searchProducts">
                    {{ productOptionsLoading ? t('admin.common.loading') : t('admin.settings.notification.inventory.searchAction') }}
                  </Button>
                </div>
                <div class="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Select v-model="selectedIgnoredProductValue">
                    <SelectTrigger class="h-10">
                      <SelectValue :placeholder="t('admin.settings.notification.inventory.selectPlaceholder')" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="product in productOptions" :key="product.id" :value="String(product.id)">
                        {{ buildProductLabel(product) }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" class="sm:w-auto" @click="addIgnoredProduct">
                    {{ t('admin.settings.notification.inventory.addAction') }}
                  </Button>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    v-for="product in ignoredProducts"
                    :key="product.id"
                    type="button"
                    class="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground"
                    @click="removeIgnoredProduct(product.id)"
                  >
                    <span>{{ product.label }}</span>
                    <span class="text-muted-foreground">×</span>
                  </button>
                  <span v-if="ignoredProducts.length === 0" class="text-xs text-muted-foreground">
                    {{ t('admin.settings.notification.inventory.emptyIgnoredProducts') }}
                  </span>
                </div>
              </div>
              <p class="text-xs text-muted-foreground">{{ t('admin.settings.notification.inventory.ignoredProductIDsHint') }}</p>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-border bg-muted/20 p-4">
          <h3 class="text-sm font-semibold">{{ t('admin.settings.notification.paymentOrder.title') }}</h3>
          <div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.paymentOrder.checkIntervalSeconds') }}</label>
              <Input v-model.number="form.payment_order_alert_check_interval_seconds" type="number" min="60" max="604800" />
              <p class="text-xs text-muted-foreground">{{ t('admin.settings.notification.paymentOrder.checkIntervalHint') }}</p>
            </div>
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.paymentOrder.intervalSeconds') }}</label>
              <Input v-model.number="form.payment_order_alert_interval_seconds" type="number" min="60" max="604800" />
              <p class="text-xs text-muted-foreground">{{ t('admin.settings.notification.paymentOrder.intervalHint') }}</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div class="rounded-xl border border-border">
            <div class="border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.notification.channels.email.title') }}</h3>
            </div>
            <div class="space-y-3 p-4">
              <div class="flex items-center gap-2">
                <Switch v-model="form.channels.email.enabled" />
                <Label class="text-sm">{{ t('admin.settings.notification.channels.email.enabled') }}</Label>
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.channels.email.recipients') }}</label>
                <Textarea
                  v-model="form.channels.email.recipients_text"
                  rows="5"
                  :placeholder="t('admin.settings.notification.channels.email.recipientsPlaceholder')"
                />
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-border">
            <div class="border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.notification.channels.telegram.title') }}</h3>
            </div>
            <div class="space-y-3 p-4">
              <div class="flex items-center gap-2">
                <Switch v-model="form.channels.telegram.enabled" />
                <Label class="text-sm">{{ t('admin.settings.notification.channels.telegram.enabled') }}</Label>
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.notification.channels.telegram.recipients') }}</label>
                <Textarea
                  v-model="form.channels.telegram.recipients_text"
                  rows="5"
                  :placeholder="t('admin.settings.notification.channels.telegram.recipientsPlaceholder')"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-xl border border-border bg-muted/20 p-4">
          <h3 class="text-sm font-semibold">{{ t('admin.settings.notification.scenes.title') }}</h3>
          <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div class="flex items-center gap-2 text-sm">
              <Switch v-model="form.scenes.wallet_recharge_success" />
              <Label class="text-sm">{{ t('admin.settings.notification.scenes.walletRechargeSuccess') }}</Label>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <Switch v-model="form.scenes.order_paid_success" />
              <Label class="text-sm">{{ t('admin.settings.notification.scenes.orderPaidSuccess') }}</Label>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <Switch v-model="form.scenes.manual_fulfillment_pending" />
              <Label class="text-sm">{{ t('admin.settings.notification.scenes.manualFulfillmentPending') }}</Label>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <Switch v-model="form.scenes.exception_alert" />
              <Label class="text-sm">{{ t('admin.settings.notification.scenes.exceptionAlert') }}</Label>
            </div>
          </div>
          <p class="mt-3 text-xs text-muted-foreground">{{ t('admin.settings.notification.scenes.exceptionThresholdHint') }}</p>
        </div>

        <div class="rounded-xl border border-border">
          <div class="flex flex-col gap-2 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 class="text-sm font-semibold">{{ t('admin.settings.notification.templates.title') }}</h3>
            <span class="w-fit rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{{ currentLang }}</span>
          </div>
          <div class="space-y-4 p-4">
            <div class="rounded-lg border border-border bg-muted/10 p-4">
              <h4 class="text-sm font-medium">{{ t('admin.settings.notification.scenes.walletRechargeSuccess') }}</h4>
              <div class="mt-3 space-y-2">
                <Input v-model="form.templates.wallet_recharge_success[currentLang].title" :placeholder="t('admin.settings.notification.templates.titlePlaceholder')" />
                <Textarea v-model="form.templates.wallet_recharge_success[currentLang].body" rows="4" :placeholder="t('admin.settings.notification.templates.bodyPlaceholder')" />
              </div>
            </div>

            <div class="rounded-lg border border-border bg-muted/10 p-4">
              <h4 class="text-sm font-medium">{{ t('admin.settings.notification.scenes.orderPaidSuccess') }}</h4>
              <div class="mt-3 space-y-2">
                <Input v-model="form.templates.order_paid_success[currentLang].title" :placeholder="t('admin.settings.notification.templates.titlePlaceholder')" />
                <Textarea v-model="form.templates.order_paid_success[currentLang].body" rows="4" :placeholder="t('admin.settings.notification.templates.bodyPlaceholder')" />
              </div>
            </div>

            <div class="rounded-lg border border-border bg-muted/10 p-4">
              <h4 class="text-sm font-medium">{{ t('admin.settings.notification.scenes.manualFulfillmentPending') }}</h4>
              <div class="mt-3 space-y-2">
                <Input v-model="form.templates.manual_fulfillment_pending[currentLang].title" :placeholder="t('admin.settings.notification.templates.titlePlaceholder')" />
                <Textarea v-model="form.templates.manual_fulfillment_pending[currentLang].body" rows="4" :placeholder="t('admin.settings.notification.templates.bodyPlaceholder')" />
              </div>
            </div>

            <div class="rounded-lg border border-border bg-muted/10 p-4">
              <h4 class="text-sm font-medium">{{ t('admin.settings.notification.scenes.exceptionAlert') }}</h4>
              <div class="mt-3 space-y-2">
                <Input v-model="form.templates.exception_alert[currentLang].title" :placeholder="t('admin.settings.notification.templates.titlePlaceholder')" />
                <Textarea v-model="form.templates.exception_alert[currentLang].body" rows="4" :placeholder="t('admin.settings.notification.templates.bodyPlaceholder')" />
              </div>
              <p class="mt-2 text-xs text-muted-foreground">{{ t('admin.settings.notification.templates.variableHint') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
