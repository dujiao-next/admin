<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminResellerProfile } from '@/api/types'
import {
  RESELLER_PROFILE_STATUS_ACTIVE,
  RESELLER_PROFILE_STATUS_DISABLED,
  RESELLER_PROFILE_STATUS_PENDING_REVIEW,
  RESELLER_PROFILE_STATUS_REJECTED,
  RESELLER_SETTLEMENT_STATUS_FROZEN,
  RESELLER_SETTLEMENT_STATUS_NORMAL,
} from '@/constants/reseller'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import ListPagination from '@/components/ListPagination.vue'
import { useListRefresh, type ListFetchOptions } from '@/composables/useListRefresh'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { confirmAction } from '@/utils/confirm'
import { getAdminRouteUrl } from '@/utils/adminPath'
import { notifyError, notifySuccess } from '@/utils/notify'
import { formatDate, toRFC3339 } from '@/utils/format'
import { getResellerProfileActionState, getResellerProfileStatusKey } from '@/utils/resellerManagement'

const { t } = useI18n()
const loading = ref(true)
const { refreshing, refreshList } = useListRefresh()
const operatingId = ref<number | null>(null)
const selectedProfile = ref<AdminResellerProfile | null>(null)
const showApproveDialog = ref(false)
const showReasonDialog = ref(false)
const showEditDialog = ref(false)
const reasonAction = ref<'reject' | 'disable'>('reject')
const rows = ref<AdminResellerProfile[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})

const filters = reactive({
  keyword: '',
  userId: '',
  status: '__all__',
  settlementStatus: '__all__',
  createdFrom: '',
  createdTo: '',
})

const pageSizeOptions = [10, 20, 50, 100]
const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)
const userDetailLink = (userId: number) => getAdminRouteUrl(`/users/${userId}`)
const profileDetailLink = (profileId: number) => getAdminRouteUrl(`/resellers/profiles/${profileId}`)

const approveForm = reactive({
  defaultMarkup: '0.00',
  maxMarkup: '0.00',
})
const editForm = reactive({
  defaultMarkup: '0.00',
  maxMarkup: '0.00',
  settlementStatus: RESELLER_SETTLEMENT_STATUS_NORMAL,
  reason: '',
})
const reasonForm = reactive({
  reason: '',
})

const fetchRows = async (page = 1, options: ListFetchOptions = {}) => {
  if (!options.preserveRows) loading.value = true
  try {
    const response = await adminAPI.getResellerProfiles({
      page,
      page_size: pagination.value.page_size,
      keyword: filters.keyword || undefined,
      user_id: filters.userId || undefined,
      status: normalizeFilterValue(filters.status) || undefined,
      settlement_status: normalizeFilterValue(filters.settlementStatus) || undefined,
      created_from: toRFC3339(filters.createdFrom),
      created_to: toRFC3339(filters.createdTo),
    })
    rows.value = response.data.data || []
    pagination.value = response.data.pagination || pagination.value
  } catch {
    if (!options.preserveRows) rows.value = []
  } finally {
    if (!options.preserveRows) loading.value = false
  }
}

const handleSearch = () => {
  fetchRows(1, { preserveRows: true })
}
const debouncedSearch = useDebounceFn(handleSearch, 300)

const refreshCurrentPage = () => {
  refreshList(() => fetchRows(pagination.value.page, { preserveRows: true }))
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchRows(page)
}

const changePageSize = (size: number) => {
  if (size === pagination.value.page_size) return
  pagination.value.page_size = size
  fetchRows(1)
}

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

const openApproveDialog = (row: AdminResellerProfile) => {
  selectedProfile.value = row
  approveForm.defaultMarkup = row.default_markup_percent || '0.00'
  approveForm.maxMarkup = row.max_markup_percent || '0.00'
  showApproveDialog.value = true
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

const submitApproveProfile = async () => {
  const row = selectedProfile.value
  if (!row) return
  if (!validateMarkupRange(approveForm.defaultMarkup, approveForm.maxMarkup)) return
  operatingId.value = row.id
  try {
    await adminAPI.approveResellerProfile(row.id, {
      default_markup_percent: approveForm.defaultMarkup.trim() || '0.00',
      max_markup_percent: approveForm.maxMarkup.trim() || '0.00',
    })
    showApproveDialog.value = false
    notifySuccess(t('admin.resellerProfiles.actions.approveSuccess'))
    await fetchRows(pagination.value.page, { preserveRows: true })
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerProfiles.actions.approveFailed'))
  } finally {
    operatingId.value = null
  }
}

const openReasonDialog = (row: AdminResellerProfile, action: 'reject' | 'disable') => {
  selectedProfile.value = row
  reasonAction.value = action
  reasonForm.reason = ''
  showReasonDialog.value = true
}

const submitReasonAction = async () => {
  const row = selectedProfile.value
  if (!row) return
  if (reasonAction.value === 'reject' && !reasonForm.reason.trim()) {
    notifyError(t('admin.resellerProfiles.actions.rejectReasonPrompt'))
    return
  }
  operatingId.value = row.id
  try {
    if (reasonAction.value === 'reject') {
      await adminAPI.rejectResellerProfile(row.id, { reason: reasonForm.reason.trim() })
      notifySuccess(t('admin.resellerProfiles.actions.rejectSuccess'))
    } else {
      await adminAPI.disableResellerProfile(row.id, { reason: reasonForm.reason.trim() || undefined })
      notifySuccess(t('admin.resellerProfiles.actions.disableSuccess'))
    }
    showReasonDialog.value = false
    await fetchRows(pagination.value.page, { preserveRows: true })
  } catch (err: any) {
    notifyError(err?.message || (reasonAction.value === 'reject' ? t('admin.resellerProfiles.actions.rejectFailed') : t('admin.resellerProfiles.actions.disableFailed')))
  } finally {
    operatingId.value = null
  }
}

const openEditDialog = (row: AdminResellerProfile) => {
  selectedProfile.value = row
  editForm.defaultMarkup = row.default_markup_percent || '0.00'
  editForm.maxMarkup = row.max_markup_percent || '0.00'
  editForm.settlementStatus = row.settlement_status || RESELLER_SETTLEMENT_STATUS_NORMAL
  editForm.reason = ''
  showEditDialog.value = true
}

const submitEditProfile = async () => {
  const row = selectedProfile.value
  if (!row) return
  if (!validateMarkupRange(editForm.defaultMarkup, editForm.maxMarkup)) return
  operatingId.value = row.id
  try {
    await adminAPI.updateResellerProfile(row.id, {
      default_markup_percent: editForm.defaultMarkup.trim() || '0.00',
      max_markup_percent: editForm.maxMarkup.trim() || '0.00',
      settlement_status: editForm.settlementStatus,
      reason: editForm.reason.trim() || undefined,
    })
    showEditDialog.value = false
    notifySuccess(t('admin.resellerProfiles.actions.updateSuccess'))
    await fetchRows(pagination.value.page, { preserveRows: true })
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerProfiles.actions.updateFailed'))
  } finally {
    operatingId.value = null
  }
}

const restoreProfile = async (row: AdminResellerProfile) => {
  const confirmed = await confirmAction({ description: t('admin.resellerProfiles.actions.restoreConfirm', { id: row.id }) })
  if (!confirmed) return
  operatingId.value = row.id
  try {
    await adminAPI.restoreResellerProfile(row.id)
    notifySuccess(t('admin.resellerProfiles.actions.restoreSuccess'))
    await fetchRows(pagination.value.page, { preserveRows: true })
  } catch (err: any) {
    notifyError(err?.message || t('admin.resellerProfiles.actions.restoreFailed'))
  } finally {
    operatingId.value = null
  }
}

onMounted(() => {
  fetchRows()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.resellerProfiles.title') }}</h1>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="w-full md:w-56">
          <Input v-model="filters.keyword" :placeholder="t('admin.resellerProfiles.filters.keyword')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-32">
          <Input v-model="filters.userId" :placeholder="t('admin.resellerProfiles.filters.userId')" @update:modelValue="debouncedSearch" />
        </div>
        <div class="w-full md:w-44">
          <Select v-model="filters.status" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.resellerProfiles.filters.statusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.resellerProfiles.filters.statusAll') }}</SelectItem>
              <SelectItem :value="RESELLER_PROFILE_STATUS_PENDING_REVIEW">{{ t('admin.resellerProfiles.status.pendingReview') }}</SelectItem>
              <SelectItem :value="RESELLER_PROFILE_STATUS_ACTIVE">{{ t('admin.resellerProfiles.status.active') }}</SelectItem>
              <SelectItem :value="RESELLER_PROFILE_STATUS_REJECTED">{{ t('admin.resellerProfiles.status.rejected') }}</SelectItem>
              <SelectItem :value="RESELLER_PROFILE_STATUS_DISABLED">{{ t('admin.resellerProfiles.status.disabled') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-full md:w-44">
          <Select v-model="filters.settlementStatus" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.resellerProfiles.filters.settlementAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.resellerProfiles.filters.settlementAll') }}</SelectItem>
              <SelectItem :value="RESELLER_SETTLEMENT_STATUS_NORMAL">{{ t('admin.resellerProfiles.settlement.normal') }}</SelectItem>
              <SelectItem :value="RESELLER_SETTLEMENT_STATUS_FROZEN">{{ t('admin.resellerProfiles.settlement.frozen') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center">
          <span class="text-xs text-muted-foreground whitespace-nowrap">{{ t('admin.resellerProfiles.filters.createdRange') }}</span>
          <Input v-model="filters.createdFrom" type="datetime-local" class="h-9 w-full md:w-auto" @update:modelValue="handleSearch" />
          <span class="hidden text-muted-foreground md:inline">-</span>
          <Input v-model="filters.createdTo" type="datetime-local" class="h-9 w-full md:w-auto" @update:modelValue="handleSearch" />
        </div>
        <div class="hidden flex-1 sm:block"></div>
        <Button size="sm" variant="outline" class="w-full sm:w-auto" :disabled="refreshing" @click="refreshCurrentPage">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[1280px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.resellerProfiles.table.id') }}</TableHead>
            <TableHead class="min-w-[200px] px-6 py-3">{{ t('admin.resellerProfiles.table.user') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.resellerProfiles.table.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.resellerProfiles.table.settlement') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.resellerProfiles.table.defaultMarkup') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.resellerProfiles.table.maxMarkup') }}</TableHead>
            <TableHead class="min-w-[180px] px-6 py-3">{{ t('admin.resellerProfiles.table.applyReason') }}</TableHead>
            <TableHead class="min-w-[180px] px-6 py-3">{{ t('admin.resellerProfiles.table.rejectReason') }}</TableHead>
            <TableHead class="min-w-[140px] px-6 py-3">{{ t('admin.resellerProfiles.table.reviewedAt') }}</TableHead>
            <TableHead class="min-w-[140px] px-6 py-3">{{ t('admin.resellerProfiles.table.createdAt') }}</TableHead>
            <TableHead class="min-w-[220px] px-6 py-3 text-right">{{ t('admin.resellerProfiles.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell :colspan="11" class="p-0">
              <TableSkeleton :columns="11" :rows="5" />
            </TableCell>
          </TableRow>
          <TableRow v-else-if="rows.length === 0">
            <TableCell colspan="11" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.resellerProfiles.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="item in rows" :key="item.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="item.id" />
            </TableCell>
            <TableCell class="min-w-[200px] px-6 py-4 text-xs text-muted-foreground">
              <div class="text-foreground break-words">{{ item.user?.display_name || '-' }}</div>
              <div v-if="item.user?.email" class="mt-0.5 break-all">{{ item.user.email }}</div>
              <a
                v-if="item.user_id"
                :href="userDetailLink(item.user_id)"
                target="_blank"
                rel="noopener"
                class="mt-0.5 inline-block font-mono text-primary underline-offset-4 hover:underline"
              >
                #{{ item.user_id }}
              </a>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(item.status)">
                {{ statusLabel(item.status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="settlementClass(item.settlement_status)">
                {{ settlementLabel(item.settlement_status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs">{{ item.default_markup_percent || '0.00' }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs">{{ item.max_markup_percent || '0.00' }}</TableCell>
            <TableCell class="min-w-[180px] px-6 py-4 text-xs text-muted-foreground break-words">{{ item.apply_reason || '-' }}</TableCell>
            <TableCell class="min-w-[180px] px-6 py-4 text-xs text-muted-foreground break-words">{{ item.reject_reason || '-' }}</TableCell>
            <TableCell class="min-w-[140px] px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.reviewed_at) || '-' }}</TableCell>
            <TableCell class="min-w-[140px] px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.created_at) }}</TableCell>
            <TableCell class="min-w-[220px] px-6 py-4 text-right">
              <div class="flex flex-wrap items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  as="a"
                  :href="profileDetailLink(item.id)"
                >
                  {{ t('admin.resellerProfiles.actions.detail') }}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="operatingId === item.id"
                  @click="openEditDialog(item)"
                >
                  {{ t('admin.common.edit') }}
                </Button>
                <Button
                  size="sm"
                  :disabled="operatingId === item.id || !getResellerProfileActionState(item.status).canApprove"
                  @click="openApproveDialog(item)"
                >
                  {{ t('admin.resellerProfiles.actions.approve') }}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="operatingId === item.id || !getResellerProfileActionState(item.status).canReject"
                  @click="openReasonDialog(item, 'reject')"
                >
                  {{ t('admin.resellerProfiles.actions.reject') }}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="operatingId === item.id || !getResellerProfileActionState(item.status).canDisable"
                  @click="openReasonDialog(item, 'disable')"
                >
                  {{ t('admin.resellerProfiles.actions.disable') }}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="operatingId === item.id || !getResellerProfileActionState(item.status).canRestore"
                  @click="restoreProfile(item)"
                >
                  {{ t('admin.resellerProfiles.actions.restore') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <ListPagination
        :page="pagination.page"
        :total-page="pagination.total_page"
        :total="pagination.total"
        :page-size="pagination.page_size"
        :page-size-options="pageSizeOptions"
        @change-page="changePage"
        @change-page-size="changePageSize"
      />
    </div>

    <Dialog v-model:open="showApproveDialog">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{{ t('admin.resellerProfiles.actions.approveDialogTitle', { id: selectedProfile?.id || '-' }) }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="grid gap-2">
            <Label>{{ t('admin.resellerProfiles.table.defaultMarkup') }}</Label>
            <Input v-model="approveForm.defaultMarkup" inputmode="decimal" placeholder="0.00" />
          </div>
          <div class="grid gap-2">
            <Label>{{ t('admin.resellerProfiles.table.maxMarkup') }}</Label>
            <Input v-model="approveForm.maxMarkup" inputmode="decimal" placeholder="0.00" />
            <p class="text-xs text-muted-foreground">{{ t('admin.resellerProfiles.actions.maxMarkupZeroHint') }}</p>
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="showApproveDialog = false">{{ t('admin.common.cancel') }}</Button>
            <Button :disabled="operatingId === selectedProfile?.id" @click="submitApproveProfile">{{ t('admin.resellerProfiles.actions.approveConfirm') }}</Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>

    <Dialog v-model:open="showReasonDialog">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{{ reasonAction === 'reject' ? t('admin.resellerProfiles.actions.rejectDialogTitle', { id: selectedProfile?.id || '-' }) : t('admin.resellerProfiles.actions.disableDialogTitle', { id: selectedProfile?.id || '-' }) }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="grid gap-2">
            <Label>{{ reasonAction === 'reject' ? t('admin.resellerProfiles.actions.rejectReasonPrompt') : t('admin.resellerProfiles.actions.disableReasonPrompt') }}</Label>
            <Textarea v-model="reasonForm.reason" rows="4" />
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="showReasonDialog = false">{{ t('admin.common.cancel') }}</Button>
            <Button :variant="reasonAction === 'disable' ? 'destructive' : 'default'" :disabled="operatingId === selectedProfile?.id" @click="submitReasonAction">
              {{ reasonAction === 'reject' ? t('admin.resellerProfiles.actions.confirmReject') : t('admin.resellerProfiles.actions.confirmDisable') }}
            </Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>

    <Dialog v-model:open="showEditDialog">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{{ t('admin.resellerProfiles.actions.editDialogTitle', { id: selectedProfile?.id || '-' }) }}</DialogTitle>
        </DialogHeader>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label>{{ t('admin.resellerProfiles.table.defaultMarkup') }}</Label>
            <Input v-model="editForm.defaultMarkup" inputmode="decimal" placeholder="0.00" />
          </div>
          <div class="grid gap-2">
            <Label>{{ t('admin.resellerProfiles.table.maxMarkup') }}</Label>
            <Input v-model="editForm.maxMarkup" inputmode="decimal" placeholder="0.00" />
          </div>
          <div class="grid gap-2 sm:col-span-2">
            <Label>{{ t('admin.resellerProfiles.table.settlement') }}</Label>
            <Select v-model="editForm.settlementStatus">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="RESELLER_SETTLEMENT_STATUS_NORMAL">{{ t('admin.resellerProfiles.settlement.normal') }}</SelectItem>
                <SelectItem :value="RESELLER_SETTLEMENT_STATUS_FROZEN">{{ t('admin.resellerProfiles.settlement.frozen') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2 sm:col-span-2">
            <Label>{{ t('admin.resellerProfiles.actions.operationReason') }}</Label>
            <Textarea v-model="editForm.reason" rows="3" />
          </div>
          <p class="text-xs text-muted-foreground sm:col-span-2">{{ t('admin.resellerProfiles.actions.editHint') }}</p>
          <div class="flex justify-end gap-2 sm:col-span-2">
            <Button variant="outline" @click="showEditDialog = false">{{ t('admin.common.cancel') }}</Button>
            <Button :disabled="operatingId === selectedProfile?.id" @click="submitEditProfile">{{ t('admin.resellerProfiles.actions.saveConfig') }}</Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
