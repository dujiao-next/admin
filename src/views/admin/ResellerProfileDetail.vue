<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { adminAPI } from '@/api/admin'
import type { AdminResellerDomain, AdminResellerProfileDetail } from '@/api/types'
import {
  RESELLER_DOMAIN_STATUS_ACTIVE,
  RESELLER_DOMAIN_TYPE_CUSTOM,
  RESELLER_DOMAIN_TYPE_SUBDOMAIN,
  RESELLER_DOMAIN_VERIFICATION_VERIFIED,
  RESELLER_PROFILE_STATUS_ACTIVE,
  RESELLER_PROFILE_STATUS_DISABLED,
  RESELLER_PROFILE_STATUS_PENDING_REVIEW,
  RESELLER_PROFILE_STATUS_REJECTED,
  RESELLER_SETTLEMENT_STATUS_FROZEN,
  RESELLER_SETTLEMENT_STATUS_NORMAL,
} from '@/constants/reseller'
import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { confirmAction } from '@/utils/confirm'
import { formatDate, formatMoney, getLocalizedText } from '@/utils/format'
import { getAdminRouteUrl } from '@/utils/adminPath'
import { getImageUrl } from '@/utils/image'
import { notifyError, notifySuccess } from '@/utils/notify'
import { getResellerProfileStatusKey } from '@/utils/resellerManagement'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const savingSystemDomain = ref(false)
const operatingDomainId = ref<number | null>(null)
const detail = ref<AdminResellerProfileDetail | null>(null)
const currentTab = ref('overview')
const showEditDialog = ref(false)

const profileId = computed(() => Number(route.params.id || 0))
const profile = computed(() => detail.value?.profile || null)
const domains = computed(() => detail.value?.domains || [])
const isActiveVerifiedDomain = (item: AdminResellerDomain) =>
  item.status === RESELLER_DOMAIN_STATUS_ACTIVE &&
  item.verification_status === RESELLER_DOMAIN_VERIFICATION_VERIFIED
const activeVerifiedDomains = computed(() =>
  domains.value.filter(isActiveVerifiedDomain),
)
const primaryDomain = computed(() => activeVerifiedDomains.value.find((item) => item.is_primary) || null)
const systemDomain = computed(() => domains.value.find((item) => item.type === RESELLER_DOMAIN_TYPE_SUBDOMAIN) || null)

const editForm = reactive({
  defaultMarkup: '0.00',
  maxMarkup: '0.00',
  settlementStatus: RESELLER_SETTLEMENT_STATUS_NORMAL,
  reason: '',
})

const systemDomainForm = reactive({
  subdomain: '',
})

const syncSystemDomainForm = () => {
  systemDomainForm.subdomain = systemDomain.value?.domain || ''
}

const fetchDetail = async () => {
  if (!profileId.value) return
  loading.value = true
  try {
    const response = await adminAPI.getResellerProfile(profileId.value)
    detail.value = response.data.data as AdminResellerProfileDetail
    syncSystemDomainForm()
  } catch (err: any) {
    detail.value = null
    notifyError(err?.message || t('admin.resellerProfileDetail.loadFailed'))
  } finally {
    loading.value = false
  }
}

const openEditDialog = () => {
  if (!profile.value) return
  editForm.defaultMarkup = profile.value.default_markup_percent || '0.00'
  editForm.maxMarkup = profile.value.max_markup_percent || '0.00'
  editForm.settlementStatus = profile.value.settlement_status || RESELLER_SETTLEMENT_STATUS_NORMAL
  editForm.reason = ''
  showEditDialog.value = true
}

const validateMarkupRange = (defaultMarkup: string, maxMarkup: string) => {
  const defaultValue = Number(defaultMarkup.trim() || '0')
  const maxValue = Number(maxMarkup.trim() || '0')
  if (!Number.isFinite(defaultValue) || !Number.isFinite(maxValue) || defaultValue < 0 || maxValue < 0) {
    notifyError(t('admin.resellerProfiles.actions.markupInvalid'))
    return false
  }
  if (maxValue > 0 && defaultValue > maxValue) {
    notifyError(t('admin.resellerProfiles.actions.markupRangeInvalid'))
    return false
  }
  return true
}

const submitEditProfile = async () => {
  if (!profile.value) return
  if (!validateMarkupRange(editForm.defaultMarkup, editForm.maxMarkup)) return
  saving.value = true
  try {
    await adminAPI.updateResellerProfile(profile.value.id, {
      default_markup_percent: editForm.defaultMarkup.trim() || '0.00',
      max_markup_percent: editForm.maxMarkup.trim() || '0.00',
      settlement_status: editForm.settlementStatus,
      reason: editForm.reason.trim() || undefined,
    })
    showEditDialog.value = false
    notifySuccess(t('admin.resellerProfileDetail.saveSuccess'))
    await fetchDetail()
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerProfiles.actions.updateFailed'))
  } finally {
    saving.value = false
  }
}

const submitSystemDomain = async () => {
  if (!profile.value) return
  const raw = systemDomainForm.subdomain.trim()
  if (!raw) {
    notifyError(t('admin.resellerProfileDetail.systemDomain.emptyPrompt'))
    return
  }
  savingSystemDomain.value = true
  try {
    await adminAPI.assignResellerSystemDomain(profile.value.id, { subdomain: raw })
    notifySuccess(t('admin.resellerProfileDetail.systemDomain.saveSuccess'))
    await fetchDetail()
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerProfileDetail.systemDomain.saveFailed'))
  } finally {
    savingSystemDomain.value = false
  }
}

const setPrimaryDomain = async (domain: AdminResellerDomain) => {
  if (domain.is_primary) return
  const confirmed = await confirmAction({ description: t('admin.resellerProfileDetail.setPrimaryConfirm', { domain: domain.domain, id: domain.reseller_id }) })
  if (!confirmed) return
  operatingDomainId.value = domain.id
  try {
    await adminAPI.setPrimaryResellerDomain(domain.id)
    notifySuccess(t('admin.resellerProfileDetail.setPrimarySuccess'))
    await fetchDetail()
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerProfileDetail.setPrimaryFailed'))
  } finally {
    operatingDomainId.value = null
  }
}

const canSetPrimary = (domain: AdminResellerDomain) =>
  !domain.is_primary &&
  isActiveVerifiedDomain(domain)

const statusLabel = (status?: string) => t(`admin.resellerProfiles.status.${getResellerProfileStatusKey(status)}`)

const statusClass = (status?: string) => {
  if (status === RESELLER_PROFILE_STATUS_PENDING_REVIEW) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (status === RESELLER_PROFILE_STATUS_ACTIVE) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === RESELLER_PROFILE_STATUS_REJECTED) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === RESELLER_PROFILE_STATUS_DISABLED) return 'border-zinc-200 bg-zinc-50 text-zinc-700'
  return 'border-border bg-muted/30 text-muted-foreground'
}

const settlementLabel = (status?: string) => {
  if (status === RESELLER_SETTLEMENT_STATUS_NORMAL) return t('admin.resellerProfiles.settlement.normal')
  if (status === RESELLER_SETTLEMENT_STATUS_FROZEN) return t('admin.resellerProfiles.settlement.frozen')
  return status || '-'
}

const settlementClass = (status?: string) => {
  if (status === RESELLER_SETTLEMENT_STATUS_NORMAL) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === RESELLER_SETTLEMENT_STATUS_FROZEN) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-border bg-muted/30 text-muted-foreground'
}

const domainStatusLabel = (status?: string) => {
  if (status === 'pending_review') return t('admin.resellerProfileDetail.domainStatus.pendingReview')
  if (status === 'active') return t('admin.resellerProfileDetail.domainStatus.active')
  if (status === 'disabled') return t('admin.resellerProfileDetail.domainStatus.disabled')
  return status || '-'
}

const domainTypeLabel = (type?: string) => {
  if (type === RESELLER_DOMAIN_TYPE_SUBDOMAIN) return t('admin.resellerProfileDetail.domainType.subdomain')
  if (type === RESELLER_DOMAIN_TYPE_CUSTOM) return t('admin.resellerProfileDetail.domainType.custom')
  return type || '-'
}

const verificationLabel = (status?: string) => {
  if (status === 'pending') return t('admin.resellerProfileDetail.verification.pending')
  if (status === 'verified') return t('admin.resellerProfileDetail.verification.verified')
  if (status === 'failed') return t('admin.resellerProfileDetail.verification.failed')
  return status || '-'
}

const userDetailLink = computed(() => (profile.value?.user_id ? getAdminRouteUrl(`/users/${profile.value.user_id}`) : ''))
const siteConfigLink = computed(() => getAdminRouteUrl(`/resellers/site-configs?reseller_id=${profileId.value}`))
const productSettingsLink = computed(() => getAdminRouteUrl(`/resellers/product-settings?reseller_id=${profileId.value}`))
const ledgerLink = computed(() => getAdminRouteUrl(`/resellers/ledger-entries?reseller_id=${profileId.value}`))
const withdrawLink = computed(() => getAdminRouteUrl(`/resellers/withdraws?reseller_id=${profileId.value}`))

onMounted(fetchDetail)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" @click="router.back()">{{ t('admin.resellerProfileDetail.back') }}</Button>
          <span class="font-mono text-xs text-muted-foreground">R#{{ profileId }}</span>
        </div>
        <h1 class="text-2xl font-semibold">{{ t('admin.resellerProfileDetail.title') }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ profile?.user?.display_name || profile?.user?.email || t('admin.common.loading') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" :disabled="loading" @click="fetchDetail">{{ t('admin.common.refresh') }}</Button>
        <Button :disabled="!profile" @click="openEditDialog">{{ t('admin.resellerProfileDetail.editOperations') }}</Button>
      </div>
    </div>

    <div v-if="loading" class="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">{{ t('admin.common.loading') }}</div>
    <div v-else-if="!detail || !profile" class="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">{{ t('admin.resellerProfileDetail.notFound') }}</div>
    <template v-else>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-border bg-card p-4">
          <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.cards.profileStatus') }}</div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(profile.status)">
              {{ statusLabel(profile.status) }}
            </span>
            <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="settlementClass(profile.settlement_status)">
              {{ settlementLabel(profile.settlement_status) }}
            </span>
          </div>
        </div>
        <div class="rounded-xl border border-border bg-card p-4">
          <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.cards.markup') }}</div>
          <div class="mt-3 font-mono text-xl font-semibold">{{ profile.default_markup_percent || '0.00' }}% / {{ profile.max_markup_percent || '0.00' }}%</div>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.cards.markupHint') }}</p>
        </div>
        <div class="rounded-xl border border-border bg-card p-4">
          <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.cards.primaryDomain') }}</div>
          <div class="mt-3 truncate font-mono text-sm font-medium">{{ primaryDomain?.domain || t('admin.resellerProfileDetail.unset') }}</div>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.cards.domainCount', { count: domains.length }) }}</p>
        </div>
        <div class="rounded-xl border border-border bg-card p-4">
          <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.cards.productRules') }}</div>
          <div class="mt-3 text-xl font-semibold">{{ detail.product_summary.configured_products }}</div>
          <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.cards.productRulesHint', { hidden: detail.product_summary.hidden_products, sku: detail.product_summary.sku_overrides }) }}</p>
        </div>
      </div>

      <Tabs v-model="currentTab" class="space-y-4">
        <TabsList class="h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">{{ t('admin.resellerProfileDetail.tabs.overview') }}</TabsTrigger>
          <TabsTrigger value="profile">{{ t('admin.resellerProfileDetail.tabs.profile') }}</TabsTrigger>
          <TabsTrigger value="domains">{{ t('admin.resellerProfileDetail.tabs.domains') }}</TabsTrigger>
          <TabsTrigger value="site">{{ t('admin.resellerProfileDetail.tabs.site') }}</TabsTrigger>
          <TabsTrigger value="products">{{ t('admin.resellerProfileDetail.tabs.products') }}</TabsTrigger>
          <TabsTrigger value="finance">{{ t('admin.resellerProfileDetail.tabs.finance') }}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" class="mt-0 space-y-4">
          <div class="grid gap-4 lg:grid-cols-3">
            <div class="rounded-xl border border-border bg-card p-4">
              <div class="text-sm font-medium">{{ t('admin.resellerProfileDetail.overview.account') }}</div>
              <div class="mt-3 space-y-2 text-sm">
                <div class="flex justify-between gap-4"><span class="text-muted-foreground">{{ t('admin.resellerProfileDetail.overview.userId') }}</span><a class="font-mono text-primary hover:underline" :href="userDetailLink" target="_blank">#{{ profile.user_id }}</a></div>
                <div class="flex justify-between gap-4"><span class="text-muted-foreground">{{ t('admin.resellerProfileDetail.overview.email') }}</span><span class="break-all text-right">{{ profile.user?.email || '-' }}</span></div>
                <div class="flex justify-between gap-4"><span class="text-muted-foreground">{{ t('admin.resellerProfileDetail.overview.displayName') }}</span><span>{{ profile.user?.display_name || '-' }}</span></div>
              </div>
            </div>
            <div class="rounded-xl border border-border bg-card p-4">
              <div class="text-sm font-medium">{{ t('admin.resellerProfileDetail.overview.balanceSummary') }}</div>
              <div class="mt-3 space-y-2 text-sm">
                <div v-for="balance in detail.finance_summary.balances" :key="balance.id" class="flex justify-between gap-4">
                  <span class="font-mono">{{ balance.currency }}</span>
                  <span class="font-mono">{{ balance.available_amount }} / {{ balance.locked_amount }}</span>
                </div>
                <div v-if="detail.finance_summary.balances.length === 0" class="text-muted-foreground">{{ t('admin.resellerProfileDetail.overview.noBalance') }}</div>
              </div>
            </div>
            <div class="rounded-xl border border-border bg-card p-4">
              <div class="text-sm font-medium">{{ t('admin.resellerProfileDetail.overview.recentOps') }}</div>
              <div class="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
                <div><div class="text-lg font-semibold">{{ detail.recent_orders.length }}</div><div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.overview.orders') }}</div></div>
                <div><div class="text-lg font-semibold">{{ detail.recent_ledger_entries.length }}</div><div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.overview.ledger') }}</div></div>
                <div><div class="text-lg font-semibold">{{ detail.recent_withdraws.length }}</div><div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.overview.withdraws') }}</div></div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="profile" class="mt-0">
          <div class="rounded-xl border border-border bg-card p-4">
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.profile.applyReason') }}</div>
                <p class="mt-2 whitespace-pre-wrap text-sm">{{ profile.apply_reason || '-' }}</p>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.profile.rejectReason') }}</div>
                <p class="mt-2 whitespace-pre-wrap text-sm">{{ profile.reject_reason || '-' }}</p>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.profile.reviewer') }}</div>
                <p class="mt-2 text-sm"><span class="font-mono">{{ profile.reviewed_by || '-' }}</span> · {{ formatDate(profile.reviewed_at) || '-' }}</p>
              </div>
              <div>
                <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.profile.createdUpdated') }}</div>
                <p class="mt-2 text-sm">{{ formatDate(profile.created_at) }} · {{ formatDate(profile.updated_at) }}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="domains" class="mt-0 space-y-4">
          <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div class="rounded-xl border border-border bg-card p-4">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div class="text-sm font-medium">{{ t('admin.resellerProfileDetail.systemDomain.title') }}</div>
                  <p class="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {{ t('admin.resellerProfileDetail.systemDomain.description') }}
                  </p>
                </div>
                <span
                  class="inline-flex w-fit rounded-full border px-2.5 py-1 text-xs"
                  :class="systemDomain ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'"
                >
                  {{ systemDomain ? t('admin.resellerProfileDetail.systemDomain.assigned') : t('admin.resellerProfileDetail.systemDomain.unassigned') }}
                </span>
              </div>
              <form class="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]" @submit.prevent="submitSystemDomain">
                <div class="grid gap-2">
                  <Label for="system-domain">{{ t('admin.resellerProfileDetail.systemDomain.inputLabel') }}</Label>
                  <Input
                    id="system-domain"
                    v-model.trim="systemDomainForm.subdomain"
                    :placeholder="t('admin.resellerProfileDetail.systemDomain.inputPlaceholder')"
                    :disabled="savingSystemDomain"
                  />
                </div>
                <div class="flex items-end">
                  <Button type="submit" class="w-full md:w-auto" :disabled="savingSystemDomain || !systemDomainForm.subdomain.trim()">
                    {{ savingSystemDomain ? t('admin.resellerProfileDetail.systemDomain.saving') : t('admin.resellerProfileDetail.systemDomain.save') }}
                  </Button>
                </div>
              </form>
              <p class="mt-3 text-xs text-muted-foreground">
                {{ t('admin.resellerProfileDetail.systemDomain.note') }}
              </p>
            </div>

            <div class="rounded-xl border border-border bg-card p-4">
              <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.systemDomain.current') }}</div>
              <div class="mt-2 break-all font-mono text-sm font-medium text-foreground">{{ systemDomain?.domain || t('admin.resellerProfileDetail.systemDomain.unassigned') }}</div>
              <div class="mt-4 text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.systemDomain.currentPrimary') }}</div>
              <div class="mt-2 break-all font-mono text-sm font-medium text-foreground">{{ primaryDomain?.domain || t('admin.resellerProfileDetail.unset') }}</div>
              <p class="mt-3 text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.systemDomain.aside', { count: domains.length }) }}</p>
            </div>
          </div>

          <div class="overflow-x-auto rounded-xl border border-border bg-card">
            <Table class="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.domainTable.domain') }}</TableHead>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.domainTable.type') }}</TableHead>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.domainTable.verification') }}</TableHead>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.domainTable.status') }}</TableHead>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.domainTable.primary') }}</TableHead>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.domainTable.verifiedAt') }}</TableHead>
                  <TableHead class="px-4 py-3 text-right">{{ t('admin.resellerProfileDetail.domainTable.action') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="domain in domains" :key="domain.id">
                  <TableCell class="px-4 py-3 font-mono text-xs">{{ domain.domain }}</TableCell>
                  <TableCell class="px-4 py-3 text-xs">{{ domainTypeLabel(domain.type) }}</TableCell>
                  <TableCell class="px-4 py-3 text-xs">{{ verificationLabel(domain.verification_status) }}</TableCell>
                  <TableCell class="px-4 py-3 text-xs">{{ domainStatusLabel(domain.status) }}</TableCell>
                  <TableCell class="px-4 py-3 text-xs">{{ domain.is_primary && isActiveVerifiedDomain(domain) ? t('admin.common.yes') : t('admin.common.no') }}</TableCell>
                  <TableCell class="px-4 py-3 text-xs text-muted-foreground">{{ formatDate(domain.verified_at) || '-' }}</TableCell>
                  <TableCell class="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" :disabled="operatingDomainId === domain.id || !canSetPrimary(domain)" @click="setPrimaryDomain(domain)">
                      {{ t('admin.resellerProfileDetail.domainTable.setPrimary') }}
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow v-if="domains.length === 0">
                  <TableCell colspan="7" class="px-4 py-8 text-center text-muted-foreground">{{ t('admin.resellerProfileDetail.domainTable.empty') }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="site" class="mt-0">
          <div class="rounded-xl border border-border bg-card p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3">
                <img
                  v-if="detail.site_config?.logo"
                  :src="getImageUrl(detail.site_config.logo)"
                  class="h-12 w-12 shrink-0 rounded-lg border border-border bg-muted/30 object-contain"
                  alt="Logo"
                />
                <div
                  v-else
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-[10px] text-muted-foreground"
                >
                  {{ t('admin.resellerProfileDetail.site.noLogo') }}
                </div>
                <div>
                  <div class="text-sm font-medium">{{ detail.site_config?.site_name || t('admin.resellerProfileDetail.site.noSiteName') }}</div>
                  <p class="mt-1 text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.site.brandInfo') }}</p>
                </div>
              </div>
              <Button as="a" variant="outline" :href="siteConfigLink">{{ t('admin.resellerProfileDetail.site.openConfig') }}</Button>
            </div>
            <div class="mt-4 grid gap-3 md:grid-cols-3">
              <div class="rounded-lg border border-border p-3">
                <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.site.announcement') }}</div>
                <p class="mt-2 text-sm">{{ getLocalizedText(detail.site_config?.announcement?.title) || '-' }}</p>
              </div>
              <div class="rounded-lg border border-border p-3">
                <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.site.seoTitle') }}</div>
                <p class="mt-2 text-sm">{{ getLocalizedText(detail.site_config?.seo?.title) || '-' }}</p>
              </div>
              <div class="rounded-lg border border-border p-3">
                <div class="text-xs text-muted-foreground">{{ t('admin.resellerProfileDetail.site.supportEmail') }}</div>
                <p class="mt-2 text-sm">{{ detail.site_config?.support?.email || '-' }}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="products" class="mt-0">
          <div class="rounded-xl border border-border bg-card p-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div class="text-sm font-medium">{{ t('admin.resellerProfileDetail.products.summaryTitle') }}</div>
                <p class="mt-1 text-sm text-muted-foreground">{{ t('admin.resellerProfileDetail.products.summary', { configured: detail.product_summary.configured_products, hidden: detail.product_summary.hidden_products, sku: detail.product_summary.sku_overrides, pricing: detail.product_summary.pricing_overrides }) }}</p>
              </div>
              <Button as="a" variant="outline" :href="productSettingsLink">{{ t('admin.resellerProfileDetail.products.openRules') }}</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="finance" class="mt-0 space-y-4">
          <div class="overflow-x-auto rounded-xl border border-border bg-card">
            <div class="flex items-center justify-between border-b border-border px-4 py-3">
              <div class="text-sm font-medium">{{ t('admin.resellerProfileDetail.finance.recentOrders') }}</div>
            </div>
            <Table class="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.orderTable.orderNo') }}</TableHead>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.orderTable.status') }}</TableHead>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.orderTable.domain') }}</TableHead>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.orderTable.amount') }}</TableHead>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.orderTable.profit') }}</TableHead>
                  <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.orderTable.createdAt') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="order in detail.recent_orders" :key="order.order_no">
                  <TableCell class="px-4 py-3 font-mono text-xs">{{ order.order_no }}</TableCell>
                  <TableCell class="px-4 py-3 text-xs">{{ order.status }}</TableCell>
                  <TableCell class="px-4 py-3 font-mono text-xs">{{ order.domain || '-' }}</TableCell>
                  <TableCell class="px-4 py-3 font-mono text-xs">{{ formatMoney(order.total_amount, order.currency) }}</TableCell>
                  <TableCell class="px-4 py-3 font-mono text-xs">{{ formatMoney(order.profit_amount, order.currency) }}</TableCell>
                  <TableCell class="px-4 py-3 text-xs text-muted-foreground">{{ formatDate(order.created_at) }}</TableCell>
                </TableRow>
                <TableRow v-if="detail.recent_orders.length === 0">
                  <TableCell colspan="6" class="px-4 py-8 text-center text-muted-foreground">{{ t('admin.resellerProfileDetail.finance.noOrders') }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div class="grid gap-4 xl:grid-cols-2">
            <div class="overflow-x-auto rounded-xl border border-border bg-card">
              <div class="flex items-center justify-between border-b border-border px-4 py-3">
                <div class="text-sm font-medium">{{ t('admin.resellerProfileDetail.finance.recentLedger') }}</div>
                <Button as="a" size="sm" variant="outline" :href="ledgerLink">{{ t('admin.resellerProfileDetail.finance.viewAll') }}</Button>
              </div>
              <Table class="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.ledgerTable.type') }}</TableHead>
                    <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.ledgerTable.amount') }}</TableHead>
                    <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.ledgerTable.status') }}</TableHead>
                    <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.ledgerTable.time') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="entry in detail.recent_ledger_entries" :key="entry.id">
                    <TableCell class="px-4 py-3 text-xs">{{ entry.type }}</TableCell>
                    <TableCell class="px-4 py-3 font-mono text-xs">{{ formatMoney(entry.amount, entry.currency) }}</TableCell>
                    <TableCell class="px-4 py-3 text-xs">{{ entry.status }}</TableCell>
                    <TableCell class="px-4 py-3 text-xs text-muted-foreground">{{ formatDate(entry.created_at) }}</TableCell>
                  </TableRow>
                  <TableRow v-if="detail.recent_ledger_entries.length === 0">
                    <TableCell colspan="4" class="px-4 py-8 text-center text-muted-foreground">{{ t('admin.resellerProfileDetail.finance.noLedger') }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div class="overflow-x-auto rounded-xl border border-border bg-card">
              <div class="flex items-center justify-between border-b border-border px-4 py-3">
                <div class="text-sm font-medium">{{ t('admin.resellerProfileDetail.finance.recentWithdraws') }}</div>
                <Button as="a" size="sm" variant="outline" :href="withdrawLink">{{ t('admin.resellerProfileDetail.finance.viewAll') }}</Button>
              </div>
              <Table class="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.withdrawTable.channel') }}</TableHead>
                    <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.withdrawTable.amount') }}</TableHead>
                    <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.withdrawTable.status') }}</TableHead>
                    <TableHead class="px-4 py-3">{{ t('admin.resellerProfileDetail.finance.withdrawTable.time') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="withdraw in detail.recent_withdraws" :key="withdraw.id">
                    <TableCell class="px-4 py-3 text-xs">{{ withdraw.channel }}</TableCell>
                    <TableCell class="px-4 py-3 font-mono text-xs">{{ formatMoney(withdraw.amount, withdraw.currency) }}</TableCell>
                    <TableCell class="px-4 py-3 text-xs">{{ withdraw.status }}</TableCell>
                    <TableCell class="px-4 py-3 text-xs text-muted-foreground">{{ formatDate(withdraw.created_at) }}</TableCell>
                  </TableRow>
                  <TableRow v-if="detail.recent_withdraws.length === 0">
                    <TableCell colspan="4" class="px-4 py-8 text-center text-muted-foreground">{{ t('admin.resellerProfileDetail.finance.noWithdraws') }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </template>

    <Dialog v-model:open="showEditDialog">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{{ t('admin.resellerProfiles.actions.editDialogTitle', { id: profile?.id || '-' }) }}</DialogTitle>
        </DialogHeader>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label>{{ t('admin.resellerProfileDetail.editDialog.defaultMarkup') }}</Label>
            <Input v-model="editForm.defaultMarkup" inputmode="decimal" placeholder="0.00" />
          </div>
          <div class="grid gap-2">
            <Label>{{ t('admin.resellerProfileDetail.editDialog.maxMarkup') }}</Label>
            <Input v-model="editForm.maxMarkup" inputmode="decimal" placeholder="0.00" />
          </div>
          <div class="grid gap-2 sm:col-span-2">
            <Label>{{ t('admin.resellerProfileDetail.editDialog.settlement') }}</Label>
            <Select v-model="editForm.settlementStatus">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="RESELLER_SETTLEMENT_STATUS_NORMAL">{{ t('admin.resellerProfiles.settlement.normal') }}</SelectItem>
                <SelectItem :value="RESELLER_SETTLEMENT_STATUS_FROZEN">{{ t('admin.resellerProfileDetail.editDialog.settlementFrozen') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2 sm:col-span-2">
            <Label>{{ t('admin.resellerProfiles.actions.operationReason') }}</Label>
            <Textarea v-model="editForm.reason" rows="3" />
          </div>
          <p class="text-xs text-muted-foreground sm:col-span-2">{{ t('admin.resellerProfileDetail.editDialog.hint') }}</p>
          <div class="flex justify-end gap-2 sm:col-span-2">
            <Button variant="outline" @click="showEditDialog = false">{{ t('admin.common.cancel') }}</Button>
            <Button :disabled="saving" @click="submitEditProfile">{{ t('admin.resellerProfiles.actions.saveConfig') }}</Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
