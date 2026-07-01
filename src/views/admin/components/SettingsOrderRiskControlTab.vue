<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notifyError, notifySuccess } from '@/utils/notify'

const { t } = useI18n()

const loading = ref(false)
const submitting = ref(false)

const form = reactive({
  enabled: false,
  allow_negative_margin: false,
  max_pending_orders_per_user: 3,
  max_pending_orders_per_ip: 5,
  max_pending_orders_per_guest_email: 2,
  order_rate_limit: {
    enabled: false,
    window_seconds: 60,
    max_requests: 5,
    block_seconds: 120,
  },
  ip_blacklist_text: '',
  email_blacklist_text: '',
})

const loadConfig = async () => {
  loading.value = true
  try {
    const res = await adminAPI.getSettings({ key: 'order_risk_control_config' })
    const data = res.data?.data as Record<string, unknown> | undefined
    if (data) {
      form.enabled = !!data.enabled
      form.allow_negative_margin = !!data.allow_negative_margin
      form.max_pending_orders_per_user = data.max_pending_orders_per_user != null ? Number(data.max_pending_orders_per_user) : 3
      form.max_pending_orders_per_ip = data.max_pending_orders_per_ip != null ? Number(data.max_pending_orders_per_ip) : 5
      form.max_pending_orders_per_guest_email = data.max_pending_orders_per_guest_email != null ? Number(data.max_pending_orders_per_guest_email) : 2
      const rl = data.order_rate_limit as Record<string, unknown> | undefined
      if (rl) {
        form.order_rate_limit.enabled = !!rl.enabled
        form.order_rate_limit.window_seconds = rl.window_seconds != null ? Number(rl.window_seconds) : 60
        form.order_rate_limit.max_requests = rl.max_requests != null ? Number(rl.max_requests) : 5
        form.order_rate_limit.block_seconds = rl.block_seconds != null ? Number(rl.block_seconds) : 120
      }
      const ipList = data.ip_blacklist as string[] | undefined
      form.ip_blacklist_text = ipList?.join('\n') || ''
      const emailList = data.email_blacklist as string[] | undefined
      form.email_blacklist_text = emailList?.join('\n') || ''
    }
  } catch {
    // ignore load error, use defaults
  } finally {
    loading.value = false
  }
}

const save = async () => {
  submitting.value = true
  try {
    const ipBlacklist = form.ip_blacklist_text
      .split('\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
    const emailBlacklist = form.email_blacklist_text
      .split('\n')
      .map((s: string) => s.trim().toLowerCase())
      .filter((s: string) => s.length > 0)

    await adminAPI.updateSettings({
      key: 'order_risk_control_config',
      value: {
        enabled: form.enabled,
        allow_negative_margin: form.allow_negative_margin,
        max_pending_orders_per_user: Number(form.max_pending_orders_per_user),
        max_pending_orders_per_ip: Number(form.max_pending_orders_per_ip),
        max_pending_orders_per_guest_email: Number(form.max_pending_orders_per_guest_email),
        order_rate_limit: {
          enabled: form.order_rate_limit.enabled,
          window_seconds: Number(form.order_rate_limit.window_seconds),
          max_requests: Number(form.order_rate_limit.max_requests),
          block_seconds: Number(form.order_rate_limit.block_seconds),
        },
        ip_blacklist: ipBlacklist,
        email_blacklist: emailBlacklist,
      },
    })
    notifySuccess(t('admin.settings.alerts.saveSuccess'))
  } catch (err) {
    const known = err as Error & { __notified?: boolean }
    if (!known?.__notified) {
      notifyError(known?.message || t('admin.settings.alerts.saveFailed'))
    }
  } finally {
    submitting.value = false
  }
}

defineExpose({ save })

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-lg border p-6">
      <h2 class="text-lg font-semibold">{{ t('admin.settings.orderRiskControl.title') }}</h2>
      <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.orderRiskControl.subtitle') }}</p>
    </div>

    <!-- 总开关 -->
    <div class="rounded-lg border p-6">
      <div class="flex items-center gap-3">
        <Switch v-model="form.enabled" />
        <div>
          <Label class="text-sm font-medium">{{ t('admin.settings.orderRiskControl.enabled') }}</Label>
          <p class="text-xs text-muted-foreground">{{ t('admin.settings.orderRiskControl.enabledHint') }}</p>
        </div>
      </div>
    </div>

    <!-- 允许负利润 -->
    <div class="rounded-lg border p-6">
      <div class="flex items-center gap-3">
        <Switch v-model="form.allow_negative_margin" />
        <div>
          <Label class="text-sm font-medium">{{ t('admin.settings.orderRiskControl.allowNegativeMargin') }}</Label>
          <p class="text-xs text-muted-foreground">{{ t('admin.settings.orderRiskControl.allowNegativeMarginHint') }}</p>
        </div>
      </div>
    </div>

    <!-- 并发待支付订单限制 -->
    <div v-show="form.enabled" class="rounded-lg border p-6 space-y-4">
      <div>
        <h3 class="text-sm font-semibold">{{ t('admin.settings.orderRiskControl.pendingLimits.title') }}</h3>
        <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.orderRiskControl.pendingLimits.subtitle') }}</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="space-y-1">
          <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.orderRiskControl.pendingLimits.perUser') }}</label>
          <Input v-model.number="form.max_pending_orders_per_user" type="number" min="0" max="100" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.orderRiskControl.pendingLimits.perIP') }}</label>
          <Input v-model.number="form.max_pending_orders_per_ip" type="number" min="0" max="100" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.orderRiskControl.pendingLimits.perGuestEmail') }}</label>
          <Input v-model.number="form.max_pending_orders_per_guest_email" type="number" min="0" max="100" />
        </div>
      </div>
    </div>

    <!-- 下单频率限制 -->
    <div v-show="form.enabled" class="rounded-lg border p-6 space-y-4">
      <div>
        <h3 class="text-sm font-semibold">{{ t('admin.settings.orderRiskControl.rateLimit.title') }}</h3>
        <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.orderRiskControl.rateLimit.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <Switch v-model="form.order_rate_limit.enabled" />
        <Label class="text-sm font-medium">{{ t('admin.settings.orderRiskControl.rateLimit.enabled') }}</Label>
      </div>
      <div v-show="form.order_rate_limit.enabled" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="space-y-1">
          <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.orderRiskControl.rateLimit.windowSeconds') }}</label>
          <Input v-model.number="form.order_rate_limit.window_seconds" type="number" min="10" max="3600" />
          <p class="text-xs text-muted-foreground">{{ t('admin.settings.orderRiskControl.rateLimit.windowSecondsHint') }}</p>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.orderRiskControl.rateLimit.maxRequests') }}</label>
          <Input v-model.number="form.order_rate_limit.max_requests" type="number" min="1" max="100" />
          <p class="text-xs text-muted-foreground">{{ t('admin.settings.orderRiskControl.rateLimit.maxRequestsHint') }}</p>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-muted-foreground">{{ t('admin.settings.orderRiskControl.rateLimit.blockSeconds') }}</label>
          <Input v-model.number="form.order_rate_limit.block_seconds" type="number" min="0" max="86400" />
          <p class="text-xs text-muted-foreground">{{ t('admin.settings.orderRiskControl.rateLimit.blockSecondsHint') }}</p>
        </div>
      </div>
    </div>

    <!-- IP 黑名单 -->
    <div v-show="form.enabled" class="rounded-lg border p-6 space-y-4">
      <div>
        <h3 class="text-sm font-semibold">{{ t('admin.settings.orderRiskControl.ipBlacklist.title') }}</h3>
        <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.orderRiskControl.ipBlacklist.subtitle') }}</p>
      </div>
      <Textarea
        v-model="form.ip_blacklist_text"
        :placeholder="t('admin.settings.orderRiskControl.ipBlacklist.placeholder')"
        rows="5"
        class="font-mono text-sm"
      />
    </div>

    <!-- 邮箱黑名单 -->
    <div v-show="form.enabled" class="rounded-lg border p-6 space-y-4">
      <div>
        <h3 class="text-sm font-semibold">{{ t('admin.settings.orderRiskControl.emailBlacklist.title') }}</h3>
        <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.settings.orderRiskControl.emailBlacklist.subtitle') }}</p>
      </div>
      <Textarea
        v-model="form.email_blacklist_text"
        :placeholder="t('admin.settings.orderRiskControl.emailBlacklist.placeholder')"
        rows="5"
        class="font-mono text-sm"
      />
    </div>
  </div>
</template>
