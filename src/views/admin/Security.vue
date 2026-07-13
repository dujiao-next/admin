<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI, type TwoFAStatus } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { notifyError, notifySuccess } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'
import Setup2FAModal from './components/Setup2FAModal.vue'
import RecoveryCodesModal from './components/RecoveryCodesModal.vue'
import { getAdminRouteUrl } from '@/utils/adminPath'
import { formatDate } from '@/utils/format'

const { t } = useI18n()
const loading = ref(false)

const passwordForm = reactive({
  old: '',
  new: '',
  confirm: '',
})

const totpStatus = ref<TwoFAStatus | null>(null)
const totpLoading = ref(false)
const setupOpen = ref(false)
const recoveryOpen = ref(false)
const recoveryCodes = ref<string[]>([])

const disableForm = reactive({ code: '', useRecovery: false, recoveryCode: '' })
const regenForm = reactive({ code: '' })

const refreshTOTPStatus = async () => {
  totpLoading.value = true
  try {
    const res = await adminAPI.get2FAStatus()
    totpStatus.value = res.data?.data as TwoFAStatus
  } finally {
    totpLoading.value = false
  }
}

const onEnabled = async (codes: string[]) => {
  recoveryCodes.value = codes
  recoveryOpen.value = true
  await refreshTOTPStatus()
}

const submitDisable = async () => {
  if (!disableForm.useRecovery && !disableForm.code.trim()) {
    notifyError(t('admin.twofa.disable.codeRequired'))
    return
  }
  if (disableForm.useRecovery && !disableForm.recoveryCode.trim()) {
    notifyError(t('admin.twofa.disable.codeRequired'))
    return
  }
  const ok = await confirmAction(t('admin.twofa.disable.confirm'))
  if (!ok) return
  try {
    await adminAPI.disable2FA(
      disableForm.useRecovery
        ? { recovery_code: disableForm.recoveryCode.trim() }
        : { code: disableForm.code.trim() },
    )
    notifySuccess(t('admin.twofa.disable.success'))
    disableForm.code = ''
    disableForm.recoveryCode = ''
    disableForm.useRecovery = false
    localStorage.removeItem('admin_token')
    window.location.href = getAdminRouteUrl('/login')
  } catch (err: any) {
    notifyErrorIfNeeded(err, t('admin.twofa.disable.failed'))
  }
}

const submitRegen = async () => {
  if (regenForm.code.length !== 6) {
    notifyError(t('admin.twofa.regenerate.codeFormat'))
    return
  }
  try {
    const res = await adminAPI.regenerateRecoveryCodes({ code: regenForm.code.trim() })
    const data = res.data?.data as { recovery_codes: string[] }
    recoveryCodes.value = data.recovery_codes
    recoveryOpen.value = true
    regenForm.code = ''
    await refreshTOTPStatus()
  } catch (err: any) {
    notifyErrorIfNeeded(err, t('admin.twofa.regenerate.failed'))
  }
}

onMounted(() => {
  refreshTOTPStatus()
})

const notifyErrorIfNeeded = (err: unknown, fallback: string) => {
  // client.ts 在 reject 前已 notifyError，避免重复弹
  if ((err as { __notified?: boolean })?.__notified) return
  notifyError(fallback)
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
    window.location.href = getAdminRouteUrl('/login')
  } catch (err: any) {
    notifyErrorIfNeeded(err, t('admin.settings.alerts.passwordFailed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">{{ t('admin.settings.security.title') }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ t('admin.settings.security.subtitle') }}</p>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <div class="border-b border-border bg-muted/40 px-6 py-4">
        <h2 class="text-lg font-semibold">{{ t('admin.settings.actions.changePassword') }}</h2>
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
          <Button class="w-full sm:w-auto" :disabled="loading" @click="changePassword">
            <span v-if="loading" class="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary"></span>
            {{ t('admin.settings.actions.changePassword') }}
          </Button>
        </div>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <div class="border-b border-border bg-muted/40 px-6 py-4">
        <h2 class="text-lg font-semibold">{{ t('admin.twofa.title') }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">{{ t('admin.twofa.description') }}</p>
      </div>
      <div class="space-y-6 p-6">
        <div v-if="totpLoading" class="text-sm text-muted-foreground">{{ t('admin.common.loading') }}</div>

        <div v-else-if="totpStatus && !totpStatus.enabled" class="space-y-2">
          <Button @click="setupOpen = true">{{ t('admin.twofa.enableButton') }}</Button>
        </div>

        <div v-else-if="totpStatus && totpStatus.enabled" class="space-y-6">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <div>
              <span class="text-muted-foreground">{{ t('admin.twofa.enabledSince') }}：</span>
              <span class="ml-1">{{ formatDate(totpStatus.enabled_at) }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">{{ t('admin.twofa.recoveryRemaining') }}：</span>
              <span class="ml-1">{{ totpStatus.recovery_codes_remaining }} / {{ totpStatus.recovery_codes_total }}</span>
            </div>
          </div>

          <div class="space-y-3 rounded-lg border border-border p-4">
            <h3 class="text-sm font-medium">{{ t('admin.twofa.regenerate.title') }}</h3>
            <p class="text-xs text-muted-foreground">{{ t('admin.twofa.regenerate.hint') }}</p>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div class="flex-1 space-y-1">
                <label class="text-xs text-muted-foreground">{{ t('admin.twofa.regenerate.codePlaceholder') }}</label>
                <Input
                  v-model="regenForm.code"
                  inputmode="numeric"
                  maxlength="6"
                  placeholder="123456"
                />
              </div>
              <Button variant="outline" size="sm" @click="submitRegen">
                {{ t('admin.twofa.regenerate.button') }}
              </Button>
            </div>
          </div>

          <div class="space-y-3 rounded-lg border border-destructive/30 p-4">
            <h3 class="text-sm font-medium text-destructive">{{ t('admin.twofa.disable.title') }}</h3>
            <p class="text-xs text-muted-foreground">{{ t('admin.twofa.disable.hint') }}</p>
            <label class="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                v-model="disableForm.useRecovery"
                class="h-3 w-3 rounded border-border"
              />
              <span>{{ t('admin.twofa.disable.useRecovery') }}</span>
            </label>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div class="flex-1 space-y-1">
                <Input
                  v-if="!disableForm.useRecovery"
                  v-model="disableForm.code"
                  inputmode="numeric"
                  maxlength="6"
                  :placeholder="t('admin.twofa.disable.codePlaceholder')"
                />
                <Input
                  v-else
                  v-model="disableForm.recoveryCode"
                  :placeholder="t('admin.twofa.disable.recoveryPlaceholder')"
                />
              </div>
              <Button variant="destructive" size="sm" @click="submitDisable">
                {{ t('admin.twofa.disable.button') }}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Setup2FAModal v-model:open="setupOpen" @enabled="onEnabled" />
    <RecoveryCodesModal v-model:open="recoveryOpen" :codes="recoveryCodes" />
  </div>
</template>
