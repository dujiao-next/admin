<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import { AFFILIATE_PROFILE_STATUS_ACTIVE, AFFILIATE_PROFILE_STATUS_DISABLED } from '@/constants/affiliate'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/utils/format'
import { confirmAction } from '@/utils/confirm'
import { notifyError, notifySuccess } from '@/utils/notify'

const { t } = useI18n()
const loading = ref(true)
const operatingProfileID = ref<number | null>(null)
const rows = ref<any[]>([])
const selectedIds = ref<number[]>([])
const jumpPage = ref('')
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})

const filters = reactive({
  keyword: '',
  code: '',
  status: '__all__',
})

const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const pickStatAmount = (stats: any, camelKey: string, snakeKey: string) => {
  const value = stats?.[snakeKey] ?? stats?.[camelKey]
  if (value === null || value === undefined || value === '') {
    return '0.00'
  }
  return String(value)
}

const pickStatNumber = (stats: any, camelKey: string, snakeKey: string) => {
  return parseNumber(stats?.[snakeKey] ?? stats?.[camelKey], 0)
}

const conversionRateText = (stats: any) => {
  const value = pickStatNumber(stats, 'ConversionRate', 'conversion_rate')
  return `${value.toFixed(2)}%`
}

const fetchRows = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getAffiliateUsers({
      page,
      page_size: pagination.value.page_size,
      keyword: filters.keyword || undefined,
      code: filters.code || undefined,
      status: normalizeFilterValue(filters.status) || undefined,
    })
    rows.value = (response.data.data as any[]) || []
    const currentIDs = new Set(
      rows.value
        .map((item) => resolveProfileID(item))
        .filter((id) => id > 0),
    )
    selectedIds.value = selectedIds.value.filter((id) => currentIDs.has(id))
    pagination.value = response.data.pagination || pagination.value
  } catch {
    rows.value = []
    selectedIds.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchRows(1)
}

const refreshCurrentPage = () => {
  fetchRows(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchRows(page)
}

const jumpToPage = () => {
  if (!jumpPage.value) return
  const raw = Number(jumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), pagination.value.total_page)
  if (target === pagination.value.page) return
  changePage(target)
}

const statusLabel = (status?: string) => {
  if (status === AFFILIATE_PROFILE_STATUS_ACTIVE) return t('admin.affiliatesUsers.status.active')
  if (status === AFFILIATE_PROFILE_STATUS_DISABLED) return t('admin.affiliatesUsers.status.disabled')
  return status || '-'
}

const statusClass = (status?: string) => {
  if (status === AFFILIATE_PROFILE_STATUS_ACTIVE) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === AFFILIATE_PROFILE_STATUS_DISABLED) return 'border-zinc-200 bg-zinc-50 text-zinc-700'
  return 'border-border bg-muted/30 text-muted-foreground'
}

const resolveProfileID = (row: any) => Number(row?.profile?.id || row?.id || 0)
const resolveProfileStatus = (row: any) => String(row?.profile?.status || row?.status || '').trim()
const canToggleStatus = (row: any) => resolveProfileID(row) > 0
const allSelected = computed(() => {
  if (rows.value.length === 0) return false
  return rows.value.every((item) => {
    const id = resolveProfileID(item)
    return id > 0 && selectedIds.value.includes(id)
  })
})

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedIds.value = []
    return
  }
  selectedIds.value = rows.value
    .map((item) => resolveProfileID(item))
    .filter((id) => id > 0)
}

const toggleProfileStatus = async (row: any) => {
  const profileID = resolveProfileID(row)
  if (profileID <= 0) return
  const currentStatus = resolveProfileStatus(row)
  const isActive = currentStatus === AFFILIATE_PROFILE_STATUS_ACTIVE
  const nextStatus = isActive ? AFFILIATE_PROFILE_STATUS_DISABLED : AFFILIATE_PROFILE_STATUS_ACTIVE

  const confirmed = await confirmAction({
    description: isActive
      ? t('admin.affiliatesUsers.actions.disableConfirm', { id: profileID })
      : t('admin.affiliatesUsers.actions.enableConfirm', { id: profileID }),
  })
  if (!confirmed) return

  operatingProfileID.value = profileID
  try {
    await adminAPI.updateAffiliateUserStatus(profileID, { status: nextStatus })
    notifySuccess(
      isActive
        ? t('admin.affiliatesUsers.actions.disableSuccess')
        : t('admin.affiliatesUsers.actions.enableSuccess'),
    )
    await refreshCurrentPage()
  } catch (err: any) {
    notifyError(
      err?.message
      || (isActive
        ? t('admin.affiliatesUsers.actions.disableFailed')
        : t('admin.affiliatesUsers.actions.enableFailed')),
    )
  } finally {
    operatingProfileID.value = null
  }
}

const batchUpdateStatus = async (status: string) => {
  if (selectedIds.value.length === 0) return
  const isEnable = status === AFFILIATE_PROFILE_STATUS_ACTIVE
  const confirmed = await confirmAction({
    description: t('admin.affiliatesUsers.batch.confirm', { count: selectedIds.value.length }),
  })
  if (!confirmed) return

  try {
    await adminAPI.batchUpdateAffiliateUserStatus({
      profile_ids: selectedIds.value,
      status,
    })
    notifySuccess(
      isEnable
        ? t('admin.affiliatesUsers.batch.enableSuccess', { count: selectedIds.value.length })
        : t('admin.affiliatesUsers.batch.disableSuccess', { count: selectedIds.value.length }),
    )
    selectedIds.value = []
    await refreshCurrentPage()
  } catch (err: any) {
    notifyError(
      err?.message
      || (isEnable
        ? t('admin.affiliatesUsers.batch.enableFailed')
        : t('admin.affiliatesUsers.batch.disableFailed')),
    )
  }
}

onMounted(() => {
  fetchRows()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.affiliatesUsers.title') }}</h1>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-56">
          <Input v-model="filters.keyword" :placeholder="t('admin.affiliatesUsers.filters.keyword')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-44">
          <Input v-model="filters.code" :placeholder="t('admin.affiliatesUsers.filters.code')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-44">
          <Select v-model="filters.status" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.affiliatesUsers.filters.statusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.affiliatesUsers.filters.statusAll') }}</SelectItem>
              <SelectItem :value="AFFILIATE_PROFILE_STATUS_ACTIVE">{{ t('admin.affiliatesUsers.status.active') }}</SelectItem>
              <SelectItem :value="AFFILIATE_PROFILE_STATUS_DISABLED">{{ t('admin.affiliatesUsers.status.disabled') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex-1"></div>
        <template v-if="selectedIds.length > 0">
          <Button
            size="sm"
            variant="outline"
            class="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            @click="batchUpdateStatus(AFFILIATE_PROFILE_STATUS_ACTIVE)"
          >
            {{ t('admin.affiliatesUsers.batch.enable') }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            class="border-destructive/40 text-destructive hover:bg-destructive/10"
            @click="batchUpdateStatus(AFFILIATE_PROFILE_STATUS_DISABLED)"
          >
            {{ t('admin.affiliatesUsers.batch.disable') }}
          </Button>
        </template>
        <Button size="sm" variant="outline" @click="refreshCurrentPage">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">
              <input type="checkbox" :checked="allSelected" class="h-4 w-4 accent-primary" @change="toggleSelectAll" />
            </TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.user') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.code') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.clicks') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.validOrders') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.conversionRate') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.pending') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.available') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.withdrawn') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.affiliatesUsers.table.createdAt') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.affiliatesUsers.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="13" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="rows.length === 0">
            <TableCell colspan="13" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.affiliatesUsers.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="item in rows" :key="item?.profile?.id || item?.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <input
                type="checkbox"
                :value="resolveProfileID(item)"
                v-model="selectedIds"
                class="h-4 w-4 accent-primary"
                :disabled="resolveProfileID(item) <= 0"
              />
            </TableCell>
            <TableCell class="px-6 py-4">
              <IdCell :value="item?.profile?.id || item?.id" />
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div class="text-foreground">#{{ item?.profile?.user_id || item?.user_id || '-' }}</div>
              <div v-if="item?.profile?.user?.display_name" class="mt-0.5 text-foreground">{{ item.profile.user.display_name }}</div>
              <div v-if="item?.profile?.user?.email" class="mt-0.5">{{ item.profile.user.email }}</div>
            </TableCell>
            <TableCell class="px-6 py-4">
              <span class="rounded-md border border-border bg-muted/30 px-2 py-1 font-mono text-xs text-foreground">
                {{ item?.profile?.code || item?.profile?.affiliate_code || '-' }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ pickStatNumber(item?.stats, 'ClickCount', 'click_count') }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ pickStatNumber(item?.stats, 'ValidOrderCount', 'valid_order_count') }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ conversionRateText(item?.stats) }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ pickStatAmount(item?.stats, 'PendingCommission', 'pending_commission') }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ pickStatAmount(item?.stats, 'AvailableCommission', 'available_commission') }}</TableCell>
            <TableCell class="px-6 py-4 font-mono text-xs text-foreground">{{ pickStatAmount(item?.stats, 'WithdrawnCommission', 'withdrawn_commission') }}</TableCell>
            <TableCell class="px-6 py-4 text-xs">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(item?.profile?.status || item?.status)">
                {{ statusLabel(item?.profile?.status || item?.status) }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item?.profile?.created_at || item?.created_at) }}</TableCell>
            <TableCell class="px-6 py-4 text-right">
              <Button
                size="sm"
                variant="outline"
                :disabled="!canToggleStatus(item) || operatingProfileID === resolveProfileID(item)"
                @click="toggleProfileStatus(item)"
              >
                {{
                  resolveProfileStatus(item) === AFFILIATE_PROFILE_STATUS_ACTIVE
                    ? t('admin.affiliatesUsers.actions.disable')
                    : t('admin.affiliatesUsers.actions.enable')
                }}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div v-if="pagination.total_page > 1" class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
        <span class="text-xs text-muted-foreground">
          {{ t('admin.common.pageInfo', { total: pagination.total, page: pagination.page, totalPage: pagination.total_page }) }}
        </span>
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
            <Button variant="outline" size="sm" class="h-8" :disabled="pagination.page >= pagination.total_page" @click="changePage(pagination.page + 1)">
              {{ t('admin.common.nextPage') }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
