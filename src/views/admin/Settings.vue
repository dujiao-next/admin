<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import RichEditor from '@/components/RichEditor.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { notifyError, notifySuccess } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'

const { t } = useI18n()
const loading = ref(false)
const smtpTesting = ref(false)
const supportedLanguages = ['zh-CN', 'zh-TW', 'en-US'] as const
type SupportedLanguage = (typeof supportedLanguages)[number]
const currentLang = ref<SupportedLanguage>('zh-CN')
const currentTab = ref('basic')

const languages = computed(() => [
  { code: 'zh-CN' as SupportedLanguage, name: t('admin.common.lang.zhCN') },
  { code: 'zh-TW' as SupportedLanguage, name: t('admin.common.lang.zhTW') },
  { code: 'en-US' as SupportedLanguage, name: t('admin.common.lang.enUS') },
])

const tabs = computed(() => [
  { label: t('admin.settings.tabs.basic'), value: 'basic' },
  { label: t('admin.settings.tabs.about'), value: 'about' },
  { label: t('admin.settings.tabs.legal'), value: 'legal' },
  { label: t('admin.settings.tabs.smtp'), value: 'smtp' },
  { label: t('admin.settings.tabs.captcha'), value: 'captcha' },
  { label: t('admin.settings.tabs.dashboard'), value: 'dashboard' },
  { label: t('admin.settings.tabs.security'), value: 'security' },
])

const createLocalizedField = () => ({ 'zh-CN': '', 'zh-TW': '', 'en-US': '' } as Record<SupportedLanguage, string>)

const normalizeLocalizedField = (raw: any): Record<SupportedLanguage, string> => {
  const normalized = createLocalizedField()
  if (!raw || typeof raw !== 'object') {
    return normalized
  }
  supportedLanguages.forEach((lang) => {
    const value = raw[lang]
    normalized[lang] = typeof value === 'string' ? value : ''
  })
  return normalized
}

const isLocalizedFieldNotEmpty = (value: Record<SupportedLanguage, string>) => {
  return Object.values(value).some((item) => item.trim() !== '')
}

const form = reactive({
  brand: {
    site_name: '',
  },
  contact: {
    telegram: '',
    whatsapp: '',
  },
  seo: {
    title: createLocalizedField(),
    keywords: createLocalizedField(),
    description: createLocalizedField(),
  },
  about: {
    hero: {
      title: createLocalizedField(),
      subtitle: createLocalizedField(),
    },
    introduction: createLocalizedField(),
    services: {
      title: createLocalizedField(),
      items: [] as Array<Record<SupportedLanguage, string>>,
    },
    contact: {
      title: createLocalizedField(),
      text: createLocalizedField(),
    },
  },
  legal: {
    terms: createLocalizedField(),
    privacy: createLocalizedField(),
  },
})

const smtpForm = reactive({
  enabled: false,
  host: '',
  port: 587,
  username: '',
  password: '',
  has_password: false,
  from: '',
  from_name: '',
  use_tls: true,
  use_ssl: false,
  verify_code: {
    expire_minutes: 10,
    send_interval_seconds: 60,
    max_attempts: 5,
    length: 6,
  },
  test_email: '',
})

const captchaForm = reactive({
  provider: 'none',
  scenes: {
    login: false,
    register_send_code: false,
    reset_send_code: false,
    guest_create_order: false,
  },
  image: {
    length: 5,
    width: 240,
    height: 80,
    noise_count: 2,
    show_line: 2,
    expire_seconds: 300,
    max_store: 10240,
  },
  turnstile: {
    site_key: '',
    secret_key: '',
    has_secret: false,
    verify_url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    timeout_ms: 2000,
  },
})

const dashboardForm = reactive({
  alert: {
    low_stock_threshold: 5,
    out_of_stock_products_threshold: 1,
    pending_payment_orders_threshold: 20,
    payments_failed_threshold: 10,
  },
  ranking: {
    top_products_limit: 5,
    top_channels_limit: 5,
  },
})

const passwordForm = reactive({
  old: '',
  new: '',
  confirm: '',
})

const getCurrentLangName = () => {
  return languages.value.find((item) => item.code === currentLang.value)?.name || t('admin.common.lang.zhCN')
}

const normalizeNumber = (value: unknown, fallback: number) => {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return parsed
}

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = normalizeNumber(value, fallback)
  if (parsed < min) return min
  if (parsed > max) return max
  return parsed
}

const notifyErrorIfNeeded = (err: unknown, fallback: string) => {
  const known = err as Error & { __notified?: boolean }
  if (known?.__notified) {
    return
  }
  notifyError(known?.message || fallback)
}

const fetchSettings = async () => {
  loading.value = true
  try {
    const [siteRes, smtpRes, captchaRes, dashboardRes] = await Promise.all([
      adminAPI.getSettings({ key: 'site_config' }),
      adminAPI.getSMTPSettings(),
      adminAPI.getCaptchaSettings(),
      adminAPI.getSettings({ key: 'dashboard_config' }),
    ])

    if (siteRes.data && siteRes.data.data) {
      const data = siteRes.data.data as any
      if (data.brand) {
        form.brand.site_name = String(data.brand.site_name || '')
      }
      if (data.contact) {
        Object.assign(form.contact, data.contact)
      }
      if (data.seo) {
        ;['title', 'keywords', 'description'].forEach((field) => {
          if (data.seo[field]) {
            Object.assign(form.seo[field as keyof typeof form.seo], data.seo[field])
          }
        })
      }
      if (data.about) {
        if (data.about.hero) {
          form.about.hero.title = normalizeLocalizedField(data.about.hero.title)
          form.about.hero.subtitle = normalizeLocalizedField(data.about.hero.subtitle)
        }
        form.about.introduction = normalizeLocalizedField(data.about.introduction)

        if (data.about.services) {
          form.about.services.title = normalizeLocalizedField(data.about.services.title)
          const serviceItems = Array.isArray(data.about.services.items)
            ? data.about.services.items
                .map((item: any) => normalizeLocalizedField(item))
                .filter((item: Record<SupportedLanguage, string>) => isLocalizedFieldNotEmpty(item))
                .slice(0, 12)
            : []
          form.about.services.items.splice(0, form.about.services.items.length, ...serviceItems)
        } else {
          form.about.services.items.splice(0, form.about.services.items.length)
        }

        if (data.about.contact) {
          form.about.contact.title = normalizeLocalizedField(data.about.contact.title)
          form.about.contact.text = normalizeLocalizedField(data.about.contact.text)
        }
      }

      if (data.legal) {
        ;['terms', 'privacy'].forEach((field) => {
          if (data.legal[field]) {
            Object.assign(form.legal[field as keyof typeof form.legal], data.legal[field])
          }
        })
      }
    }

    if (smtpRes.data && smtpRes.data.data) {
      const smtp = smtpRes.data.data as any
      smtpForm.enabled = !!smtp.enabled
      smtpForm.host = String(smtp.host || '')
      smtpForm.port = normalizeNumber(smtp.port, 587)
      smtpForm.username = String(smtp.username || '')
      smtpForm.password = ''
      smtpForm.has_password = !!smtp.has_password
      smtpForm.from = String(smtp.from || '')
      smtpForm.from_name = String(smtp.from_name || '')
      smtpForm.use_tls = !!smtp.use_tls
      smtpForm.use_ssl = !!smtp.use_ssl
      smtpForm.verify_code.expire_minutes = normalizeNumber(smtp.verify_code?.expire_minutes, 10)
      smtpForm.verify_code.send_interval_seconds = normalizeNumber(smtp.verify_code?.send_interval_seconds, 60)
      smtpForm.verify_code.max_attempts = normalizeNumber(smtp.verify_code?.max_attempts, 5)
      smtpForm.verify_code.length = normalizeNumber(smtp.verify_code?.length, 6)
    }


    if (captchaRes.data && captchaRes.data.data) {
      const captcha = captchaRes.data.data as any
      captchaForm.provider = String(captcha.provider || 'none')
      captchaForm.scenes.login = !!captcha.scenes?.login
      captchaForm.scenes.register_send_code = !!captcha.scenes?.register_send_code
      captchaForm.scenes.reset_send_code = !!captcha.scenes?.reset_send_code
      captchaForm.scenes.guest_create_order = !!captcha.scenes?.guest_create_order

      captchaForm.image.length = normalizeNumber(captcha.image?.length, 5)
      captchaForm.image.width = normalizeNumber(captcha.image?.width, 240)
      captchaForm.image.height = normalizeNumber(captcha.image?.height, 80)
      captchaForm.image.noise_count = normalizeNumber(captcha.image?.noise_count, 2)
      captchaForm.image.show_line = normalizeNumber(captcha.image?.show_line, 2)
      captchaForm.image.expire_seconds = normalizeNumber(captcha.image?.expire_seconds, 300)
      captchaForm.image.max_store = normalizeNumber(captcha.image?.max_store, 10240)

      captchaForm.turnstile.site_key = String(captcha.turnstile?.site_key || '')
      captchaForm.turnstile.secret_key = ''
      captchaForm.turnstile.has_secret = !!captcha.turnstile?.has_secret
      captchaForm.turnstile.verify_url = String(captcha.turnstile?.verify_url || 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
      captchaForm.turnstile.timeout_ms = normalizeNumber(captcha.turnstile?.timeout_ms, 2000)
    }

    if (dashboardRes.data && dashboardRes.data.data) {
      const dashboard = dashboardRes.data.data as any
      dashboardForm.alert.low_stock_threshold = clampNumber(dashboard.alert?.low_stock_threshold, 1, 500, 5)
      dashboardForm.alert.out_of_stock_products_threshold = clampNumber(dashboard.alert?.out_of_stock_products_threshold, 1, 10000, 1)
      dashboardForm.alert.pending_payment_orders_threshold = clampNumber(dashboard.alert?.pending_payment_orders_threshold, 1, 100000, 20)
      dashboardForm.alert.payments_failed_threshold = clampNumber(dashboard.alert?.payments_failed_threshold, 1, 100000, 10)
      dashboardForm.ranking.top_products_limit = clampNumber(dashboard.ranking?.top_products_limit, 1, 20, 5)
      dashboardForm.ranking.top_channels_limit = clampNumber(dashboard.ranking?.top_channels_limit, 1, 20, 5)
    }
  } catch (err) {
    notifyErrorIfNeeded(err, t('admin.settings.alerts.saveFailed'))
  } finally {
    loading.value = false
  }
}

const saveSiteSettings = async () => {
  const payload = {
    key: 'site_config',
    value: {
      brand: form.brand,
      contact: form.contact,
      seo: form.seo,
      about: form.about,
      legal: form.legal,
    },
  }
  await adminAPI.updateSettings(payload)
}

const addAboutServiceItem = () => {
  if (form.about.services.items.length >= 12) {
    notifyError(t('admin.settings.about.maxServicesHint'))
    return
  }
  form.about.services.items.push(createLocalizedField())
}

const removeAboutServiceItem = (index: number) => {
  form.about.services.items.splice(index, 1)
}

const saveSMTPSettings = async () => {
  const payload = {
    enabled: smtpForm.enabled,
    host: smtpForm.host,
    port: Number(smtpForm.port),
    username: smtpForm.username,
    password: smtpForm.password,
    from: smtpForm.from,
    from_name: smtpForm.from_name,
    use_tls: smtpForm.use_tls,
    use_ssl: smtpForm.use_ssl,
    verify_code: {
      expire_minutes: Number(smtpForm.verify_code.expire_minutes),
      send_interval_seconds: Number(smtpForm.verify_code.send_interval_seconds),
      max_attempts: Number(smtpForm.verify_code.max_attempts),
      length: Number(smtpForm.verify_code.length),
    },
  }
  const res = await adminAPI.updateSMTPSettings(payload)
  const data = res.data?.data as any
  smtpForm.password = ''
  smtpForm.has_password = !!data?.has_password || smtpForm.has_password
}


const saveCaptchaSettings = async () => {
  const payload: Record<string, unknown> = {
    provider: captchaForm.provider,
    scenes: {
      login: captchaForm.scenes.login,
      register_send_code: captchaForm.scenes.register_send_code,
      reset_send_code: captchaForm.scenes.reset_send_code,
      guest_create_order: captchaForm.scenes.guest_create_order,
    },
    image: {
      length: Number(captchaForm.image.length),
      width: Number(captchaForm.image.width),
      height: Number(captchaForm.image.height),
      noise_count: Number(captchaForm.image.noise_count),
      show_line: Number(captchaForm.image.show_line),
      expire_seconds: Number(captchaForm.image.expire_seconds),
      max_store: Number(captchaForm.image.max_store),
    },
    turnstile: {
      site_key: captchaForm.turnstile.site_key,
      verify_url: captchaForm.turnstile.verify_url,
      timeout_ms: Number(captchaForm.turnstile.timeout_ms),
    },
  }

  if (captchaForm.turnstile.secret_key.trim() !== '') {
    payload.turnstile = {
      ...(payload.turnstile as Record<string, unknown>),
      secret_key: captchaForm.turnstile.secret_key.trim(),
    }
  }

  const res = await adminAPI.updateCaptchaSettings(payload)
  const data = res.data?.data as any
  captchaForm.turnstile.secret_key = ''
  captchaForm.turnstile.has_secret = !!data?.turnstile?.has_secret || captchaForm.turnstile.has_secret
}

const saveDashboardSettings = async () => {
  const normalized = {
    alert: {
      low_stock_threshold: clampNumber(dashboardForm.alert.low_stock_threshold, 1, 500, 5),
      out_of_stock_products_threshold: clampNumber(dashboardForm.alert.out_of_stock_products_threshold, 1, 10000, 1),
      pending_payment_orders_threshold: clampNumber(dashboardForm.alert.pending_payment_orders_threshold, 1, 100000, 20),
      payments_failed_threshold: clampNumber(dashboardForm.alert.payments_failed_threshold, 1, 100000, 10),
    },
    ranking: {
      top_products_limit: clampNumber(dashboardForm.ranking.top_products_limit, 1, 20, 5),
      top_channels_limit: clampNumber(dashboardForm.ranking.top_channels_limit, 1, 20, 5),
    },
  }

  dashboardForm.alert.low_stock_threshold = normalized.alert.low_stock_threshold
  dashboardForm.alert.out_of_stock_products_threshold = normalized.alert.out_of_stock_products_threshold
  dashboardForm.alert.pending_payment_orders_threshold = normalized.alert.pending_payment_orders_threshold
  dashboardForm.alert.payments_failed_threshold = normalized.alert.payments_failed_threshold
  dashboardForm.ranking.top_products_limit = normalized.ranking.top_products_limit
  dashboardForm.ranking.top_channels_limit = normalized.ranking.top_channels_limit

  const payload = {
    key: 'dashboard_config',
    value: normalized,
  }
  await adminAPI.updateSettings(payload)
}

const saveSettings = async () => {
  loading.value = true
  try {
    if (currentTab.value === 'smtp') {
      await saveSMTPSettings()
    } else if (currentTab.value === 'captcha') {
      await saveCaptchaSettings()
    } else if (currentTab.value === 'dashboard') {
      await saveDashboardSettings()
    } else {
      await saveSiteSettings()
    }
    notifySuccess(t('admin.settings.alerts.saveSuccess'))
  } catch (err) {
    notifyErrorIfNeeded(err, t('admin.settings.alerts.saveFailed'))
  } finally {
    loading.value = false
  }
}

const testSMTPSettings = async () => {
  if (!smtpForm.test_email || smtpForm.test_email.trim() === '') {
    notifyError(t('admin.settings.smtp.testEmailRequired'))
    return
  }
  smtpTesting.value = true
  try {
    await adminAPI.testSMTPSettings({ to_email: smtpForm.test_email.trim() })
    notifySuccess(t('admin.settings.smtp.testSuccess'))
  } catch (err) {
    notifyErrorIfNeeded(err, t('admin.settings.smtp.testFailed'))
  } finally {
    smtpTesting.value = false
  }
}

const changePassword = async () => {
  if (!passwordForm.old || !passwordForm.new || !passwordForm.confirm) {
    notifyError(t('admin.settings.alerts.passwordRequired'))
    return
  }
  if (passwordForm.new !== passwordForm.confirm) {
    notifyError(t('admin.settings.alerts.passwordMismatch'))
    return
  }

  const confirmed = await confirmAction(t('admin.settings.alerts.confirmChangePassword'))
  if (!confirmed) return

  loading.value = true
  try {
    await adminAPI.updatePassword({
      old_password: passwordForm.old,
      new_password: passwordForm.new,
    })
    notifySuccess(t('admin.settings.alerts.passwordSuccess'))
    localStorage.removeItem('admin_token')
    const adminPath = import.meta.env.VITE_ADMIN_PATH || ''
    window.location.href = `${adminPath}/login`
  } catch (err: any) {
    notifyErrorIfNeeded(err, t('admin.settings.alerts.passwordFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">{{ t('admin.settings.title') }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('admin.settings.subtitle') }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex rounded-lg border border-border bg-card p-1">
          <button
            v-for="lang in languages"
            :key="lang.code"
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            :class="currentLang === lang.code ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="currentLang = lang.code"
          >
            {{ lang.name }}
          </button>
        </div>
        <Button size="sm" :disabled="loading || smtpTesting" @click="saveSettings">
          <span v-if="loading" class="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></span>
          {{ loading ? t('admin.settings.actions.saving') : t('admin.settings.actions.save') }}
        </Button>
      </div>
    </div>

    <div class="flex gap-6 border-b border-border">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="relative top-[1px] border-b-2 pb-3 text-sm font-medium transition-colors"
        :class="currentTab === tab.value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="currentTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-show="currentTab === 'basic'" class="space-y-6">
      <div class="rounded-xl border border-border bg-card">
        <div class="border-b border-border bg-muted/40 px-6 py-4">
          <h2 class="text-lg font-semibold">{{ t('admin.settings.brand.title') }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.brand.subtitle') }}</p>
        </div>
        <div class="grid grid-cols-1 gap-6 p-6">
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.brand.siteName') }}</label>
            <Input v-model="form.brand.site_name" :placeholder="t('admin.settings.brand.siteNamePlaceholder')" />
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card">
        <div class="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold">{{ t('admin.settings.seo.title') }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.seo.subtitle', { lang: getCurrentLangName() }) }}</p>
          </div>
          <span class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{{ currentLang }}</span>
        </div>
        <div class="space-y-6 p-6">
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.seo.siteTitle') }}</label>
            <Input v-model="form.seo.title[currentLang]" :placeholder="t('admin.settings.seo.siteTitlePlaceholder')" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.seo.keywords') }}</label>
            <Input v-model="form.seo.keywords[currentLang]" :placeholder="t('admin.settings.seo.keywordsPlaceholder')" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.seo.description') }}</label>
            <Textarea v-model="form.seo.description[currentLang]" rows="3" :placeholder="t('admin.settings.seo.descriptionPlaceholder')" />
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card">
        <div class="border-b border-border bg-muted/40 px-6 py-4">
          <h2 class="text-lg font-semibold">{{ t('admin.settings.contact.title') }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.contact.subtitle') }}</p>
        </div>
        <div class="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.contact.telegram') }}</label>
            <Input v-model="form.contact.telegram" :placeholder="t('admin.settings.contact.telegramPlaceholder')" />
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.contact.whatsapp') }}</label>
            <Input v-model="form.contact.whatsapp" :placeholder="t('admin.settings.contact.whatsappPlaceholder')" />
          </div>
        </div>
      </div>
    </div>

    <div v-show="currentTab === 'about'" class="space-y-6">
      <div class="rounded-xl border border-border bg-card">
        <div class="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold">{{ t('admin.settings.about.title') }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.about.subtitle', { lang: getCurrentLangName() }) }}</p>
          </div>
          <span class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{{ currentLang }}</span>
        </div>

        <div class="space-y-6 p-6">
          <div class="rounded-xl border border-border">
            <div class="border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.about.heroTitle') }}</h3>
            </div>
            <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.about.heroMainTitle') }}</label>
                <Input v-model="form.about.hero.title[currentLang]" :placeholder="t('admin.settings.about.heroMainTitlePlaceholder')" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.about.heroSubtitle') }}</label>
                <Input v-model="form.about.hero.subtitle[currentLang]" :placeholder="t('admin.settings.about.heroSubtitlePlaceholder')" />
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-border">
            <div class="border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.about.introductionTitle') }}</h3>
              <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.about.introductionSubtitle') }}</p>
            </div>
            <div class="p-4">
              <Textarea v-model="form.about.introduction[currentLang]" rows="5" :placeholder="t('admin.settings.about.introductionPlaceholder')" />
            </div>
          </div>

          <div class="rounded-xl border border-border">
            <div class="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.about.servicesTitle') }}</h3>
              <Button type="button" size="sm" variant="outline" @click="addAboutServiceItem">
                {{ t('admin.settings.about.addServiceItem') }}
              </Button>
            </div>
            <div class="space-y-4 p-4">
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.about.servicesBlockTitle') }}</label>
                <Input v-model="form.about.services.title[currentLang]" :placeholder="t('admin.settings.about.servicesBlockTitlePlaceholder')" />
              </div>

              <div v-if="form.about.services.items.length === 0" class="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-4 text-xs text-muted-foreground">
                {{ t('admin.settings.about.servicesEmpty') }}
              </div>

              <div v-for="(item, index) in form.about.services.items" :key="`about-service-${index}`" class="rounded-lg border border-border bg-muted/10 p-3">
                <div class="mb-2 flex items-center justify-between">
                  <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.about.serviceItem', { index: index + 1 }) }}</label>
                  <Button type="button" size="sm" variant="destructive" @click="removeAboutServiceItem(index)">
                    {{ t('admin.common.delete') }}
                  </Button>
                </div>
                <Input v-model="item[currentLang]" :placeholder="t('admin.settings.about.serviceItemPlaceholder')" />
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-border">
            <div class="border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.about.contactTitle') }}</h3>
              <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.about.contactSubtitle') }}</p>
            </div>
            <div class="space-y-4 p-4">
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.about.contactBlockTitle') }}</label>
                <Input v-model="form.about.contact.title[currentLang]" :placeholder="t('admin.settings.about.contactBlockTitlePlaceholder')" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.about.contactText') }}</label>
                <Textarea v-model="form.about.contact.text[currentLang]" rows="4" :placeholder="t('admin.settings.about.contactTextPlaceholder')" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-show="currentTab === 'legal'" class="space-y-6">
      <div class="rounded-xl border border-border bg-card">
        <div class="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold">{{ t('admin.settings.legal.termsTitle') }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.legal.termsSubtitle', { lang: getCurrentLangName() }) }}</p>
          </div>
          <span class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{{ currentLang }}</span>
        </div>
        <div class="p-0">
          <RichEditor :key="`terms-${currentLang}`" v-model="form.legal.terms[currentLang]" :placeholder="t('admin.settings.legal.termsPlaceholder')" />
        </div>
      </div>

      <div class="rounded-xl border border-border bg-card">
        <div class="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold">{{ t('admin.settings.legal.privacyTitle') }}</h2>
            <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.legal.privacySubtitle', { lang: getCurrentLangName() }) }}</p>
          </div>
          <span class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{{ currentLang }}</span>
        </div>
        <div class="p-0">
          <RichEditor :key="`privacy-${currentLang}`" v-model="form.legal.privacy[currentLang]" :placeholder="t('admin.settings.legal.privacyPlaceholder')" />
        </div>
      </div>
    </div>

    <div v-show="currentTab === 'smtp'" class="space-y-6">
      <div class="rounded-xl border border-border bg-card">
        <div class="border-b border-border bg-muted/40 px-6 py-4">
          <h2 class="text-lg font-semibold">{{ t('admin.settings.smtp.title') }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.smtp.subtitle') }}</p>
        </div>

        <div class="space-y-6 p-6">
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
              <input id="smtp-enabled" v-model="smtpForm.enabled" type="checkbox" class="h-4 w-4 accent-primary" />
              <label for="smtp-enabled" class="text-sm font-medium">{{ t('admin.settings.smtp.enabled') }}</label>
            </div>
            <div class="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
              <input id="smtp-tls" v-model="smtpForm.use_tls" type="checkbox" class="h-4 w-4 accent-primary" />
              <label for="smtp-tls" class="text-sm font-medium">{{ t('admin.settings.smtp.useTLS') }}</label>
              <input id="smtp-ssl" v-model="smtpForm.use_ssl" type="checkbox" class="ml-4 h-4 w-4 accent-primary" />
              <label for="smtp-ssl" class="text-sm font-medium">{{ t('admin.settings.smtp.useSSL') }}</label>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.smtp.host') }}</label>
              <Input v-model="smtpForm.host" :placeholder="t('admin.settings.smtp.hostPlaceholder')" />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.smtp.port') }}</label>
              <Input v-model.number="smtpForm.port" type="number" :placeholder="t('admin.settings.smtp.portPlaceholder')" />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.smtp.username') }}</label>
              <Input v-model="smtpForm.username" :placeholder="t('admin.settings.smtp.usernamePlaceholder')" />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.smtp.password') }}</label>
              <Input v-model="smtpForm.password" type="password" :placeholder="t('admin.settings.smtp.passwordPlaceholder')" />
              <p class="text-xs text-muted-foreground">
                {{ smtpForm.has_password ? t('admin.settings.smtp.passwordHintKeep') : t('admin.settings.smtp.passwordHintEmpty') }}
              </p>
            </div>
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.smtp.from') }}</label>
              <Input v-model="smtpForm.from" :placeholder="t('admin.settings.smtp.fromPlaceholder')" />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.smtp.fromName') }}</label>
              <Input v-model="smtpForm.from_name" :placeholder="t('admin.settings.smtp.fromNamePlaceholder')" />
            </div>
          </div>

          <div class="rounded-xl border border-border">
            <div class="border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.smtp.verifyCode.title') }}</h3>
            </div>
            <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-4">
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.smtp.verifyCode.expireMinutes') }}</label>
                <Input v-model.number="smtpForm.verify_code.expire_minutes" type="number" min="1" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.smtp.verifyCode.sendIntervalSeconds') }}</label>
                <Input v-model.number="smtpForm.verify_code.send_interval_seconds" type="number" min="1" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.smtp.verifyCode.maxAttempts') }}</label>
                <Input v-model.number="smtpForm.verify_code.max_attempts" type="number" min="1" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.smtp.verifyCode.length') }}</label>
                <Input v-model.number="smtpForm.verify_code.length" type="number" min="4" max="10" />
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-border bg-muted/20 p-4">
            <h3 class="text-sm font-semibold">{{ t('admin.settings.smtp.testTitle') }}</h3>
            <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.smtp.testSubtitle') }}</p>
            <div class="mt-3 flex flex-col gap-3 md:flex-row">
              <Input v-model="smtpForm.test_email" :placeholder="t('admin.settings.smtp.testEmailPlaceholder')" />
              <Button variant="secondary" :disabled="smtpTesting" @click="testSMTPSettings">
                {{ smtpTesting ? t('admin.settings.smtp.testing') : t('admin.settings.smtp.testButton') }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-show="currentTab === 'captcha'" class="space-y-6">
      <div class="rounded-xl border border-border bg-card">
        <div class="border-b border-border bg-muted/40 px-6 py-4">
          <h2 class="text-lg font-semibold">{{ t('admin.settings.captcha.title') }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.captcha.subtitle') }}</p>
        </div>

        <div class="space-y-6 p-6">
          <div class="space-y-2">
            <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.provider') }}</label>
            <select
              v-model="captchaForm.provider"
              class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="none">{{ t('admin.settings.captcha.providerNone') }}</option>
              <option value="image">{{ t('admin.settings.captcha.providerImage') }}</option>
              <option value="turnstile">{{ t('admin.settings.captcha.providerTurnstile') }}</option>
            </select>
          </div>

          <div class="rounded-xl border border-border bg-muted/20 p-4">
            <h3 class="text-sm font-semibold">{{ t('admin.settings.captcha.scenesTitle') }}</h3>
            <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label class="flex items-center gap-2 text-sm">
                <input v-model="captchaForm.scenes.login" type="checkbox" class="h-4 w-4 accent-primary" />
                {{ t('admin.settings.captcha.scenes.login') }}
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input v-model="captchaForm.scenes.register_send_code" type="checkbox" class="h-4 w-4 accent-primary" />
                {{ t('admin.settings.captcha.scenes.registerSendCode') }}
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input v-model="captchaForm.scenes.reset_send_code" type="checkbox" class="h-4 w-4 accent-primary" />
                {{ t('admin.settings.captcha.scenes.resetSendCode') }}
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input v-model="captchaForm.scenes.guest_create_order" type="checkbox" class="h-4 w-4 accent-primary" />
                {{ t('admin.settings.captcha.scenes.guestCreateOrder') }}
              </label>
            </div>
          </div>

          <div v-if="captchaForm.provider === 'image'" class="rounded-xl border border-border">
            <div class="border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.captcha.image.title') }}</h3>
            </div>
            <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-4">
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.image.length') }}</label>
                <Input v-model.number="captchaForm.image.length" type="number" min="4" max="8" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.image.width') }}</label>
                <Input v-model.number="captchaForm.image.width" type="number" min="100" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.image.height') }}</label>
                <Input v-model.number="captchaForm.image.height" type="number" min="40" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.image.expireSeconds') }}</label>
                <Input v-model.number="captchaForm.image.expire_seconds" type="number" min="30" max="3600" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.image.noiseCount') }}</label>
                <Input v-model.number="captchaForm.image.noise_count" type="number" min="0" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.image.showLine') }}</label>
                <Input v-model.number="captchaForm.image.show_line" type="number" min="0" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.image.maxStore') }}</label>
                <Input v-model.number="captchaForm.image.max_store" type="number" min="100" />
              </div>
            </div>
          </div>

          <div v-if="captchaForm.provider === 'turnstile'" class="rounded-xl border border-border">
            <div class="border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.captcha.turnstile.title') }}</h3>
            </div>
            <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div class="space-y-2 md:col-span-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.turnstile.siteKey') }}</label>
                <Input v-model="captchaForm.turnstile.site_key" />
              </div>
              <div class="space-y-2 md:col-span-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.turnstile.secretKey') }}</label>
                <Input v-model="captchaForm.turnstile.secret_key" type="password" :placeholder="t('admin.settings.captcha.turnstile.secretKeyPlaceholder')" />
                <p class="text-xs text-muted-foreground">
                  {{ captchaForm.turnstile.has_secret ? t('admin.settings.captcha.turnstile.secretHintKeep') : t('admin.settings.captcha.turnstile.secretHintEmpty') }}
                </p>
              </div>
              <div class="space-y-2 md:col-span-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.turnstile.verifyURL') }}</label>
                <Input v-model="captchaForm.turnstile.verify_url" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.captcha.turnstile.timeoutMS') }}</label>
                <Input v-model.number="captchaForm.turnstile.timeout_ms" type="number" min="500" max="10000" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>


    <div v-show="currentTab === 'dashboard'" class="space-y-6">
      <div class="rounded-xl border border-border bg-card">
        <div class="border-b border-border bg-muted/40 px-6 py-4">
          <h2 class="text-lg font-semibold">{{ t('admin.settings.dashboard.title') }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.dashboard.subtitle') }}</p>
        </div>

        <div class="space-y-6 p-6">
          <div class="rounded-xl border border-border">
            <div class="border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.dashboard.alert.title') }}</h3>
            </div>
            <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.dashboard.alert.lowStockThreshold') }}</label>
                <Input v-model.number="dashboardForm.alert.low_stock_threshold" type="number" min="1" max="500" />
                <p class="text-xs text-muted-foreground">{{ t('admin.settings.dashboard.alert.lowStockThresholdHint') }}</p>
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.dashboard.alert.outOfStockThreshold') }}</label>
                <Input v-model.number="dashboardForm.alert.out_of_stock_products_threshold" type="number" min="1" max="10000" />
                <p class="text-xs text-muted-foreground">{{ t('admin.settings.dashboard.alert.outOfStockThresholdHint') }}</p>
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.dashboard.alert.pendingOrderThreshold') }}</label>
                <Input v-model.number="dashboardForm.alert.pending_payment_orders_threshold" type="number" min="1" max="100000" />
                <p class="text-xs text-muted-foreground">{{ t('admin.settings.dashboard.alert.pendingOrderThresholdHint') }}</p>
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.dashboard.alert.paymentFailedThreshold') }}</label>
                <Input v-model.number="dashboardForm.alert.payments_failed_threshold" type="number" min="1" max="100000" />
                <p class="text-xs text-muted-foreground">{{ t('admin.settings.dashboard.alert.paymentFailedThresholdHint') }}</p>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-border">
            <div class="border-b border-border bg-muted/30 px-4 py-3">
              <h3 class="text-sm font-semibold">{{ t('admin.settings.dashboard.ranking.title') }}</h3>
            </div>
            <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.dashboard.ranking.topProductsLimit') }}</label>
                <Input v-model.number="dashboardForm.ranking.top_products_limit" type="number" min="1" max="20" />
                <p class="text-xs text-muted-foreground">{{ t('admin.settings.dashboard.ranking.topProductsLimitHint') }}</p>
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.dashboard.ranking.topChannelsLimit') }}</label>
                <Input v-model.number="dashboardForm.ranking.top_channels_limit" type="number" min="1" max="20" />
                <p class="text-xs text-muted-foreground">{{ t('admin.settings.dashboard.ranking.topChannelsLimitHint') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-show="currentTab === 'security'" class="space-y-6">
      <div class="rounded-xl border border-border bg-card">
        <div class="border-b border-border bg-muted/40 px-6 py-4">
          <h2 class="text-lg font-semibold">{{ t('admin.settings.security.title') }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.security.subtitle') }}</p>
        </div>
        <div class="space-y-6 p-6">
          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div class="space-y-2">
              <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.security.currentPassword') }}</label>
              <Input v-model="passwordForm.old" type="password" :placeholder="t('admin.settings.security.currentPasswordPlaceholder')" />
            </div>
            <div class="grid grid-cols-1 gap-6 md:col-span-2 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.security.newPassword') }}</label>
                <Input v-model="passwordForm.new" type="password" :placeholder="t('admin.settings.security.newPasswordPlaceholder')" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.security.confirmPassword') }}</label>
                <Input v-model="passwordForm.confirm" type="password" :placeholder="t('admin.settings.security.confirmPasswordPlaceholder')" />
              </div>
            </div>
          </div>
          <div class="flex justify-end">
            <Button variant="secondary" @click="changePassword">{{ t('admin.settings.actions.changePassword') }}</Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
