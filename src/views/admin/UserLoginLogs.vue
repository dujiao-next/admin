<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminUserLoginLog } from '@/api/types'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import ListPagination from '@/components/ListPagination.vue'
import { useListRefresh, type ListFetchOptions } from '@/composables/useListRefresh'
import { getAdminRouteUrl } from '@/utils/adminPath'
import { formatDate, toRFC3339 } from '@/utils/format'

const { t } = useI18n()
const loading = ref(true)
const { refreshing, refreshList } = useListRefresh()
const logs = ref<AdminUserLoginLog[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const filters = reactive({
  userId: '',
  email: '',
  clientIp: '',
  status: '__all__',
  failReason: '__all__',
  createdFrom: '',
  createdTo: '',
})

const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const failReasonOptions = [
  'bad_request',
  'captcha_required',
  'captcha_invalid',
  'captcha_config_invalid',
  'captcha_verify_failed',
  'invalid_email',
  'invalid_credentials',
  'email_not_verified',
  'user_disabled',
  'internal_error',
]

const fetchLogs = async (page = 1, options: ListFetchOptions = {}) => {
  if (!options.preserveRows) loading.value = true
  try {
    const response = await adminAPI.getUserLoginLogs({
      page,
      page_size: pagination.value.page_size,
      user_id: filters.userId || undefined,
      email: filters.email || undefined,
      client_ip: filters.clientIp || undefined,
      status: normalizeFilterValue(filters.status) || undefined,
      fail_reason: normalizeFilterValue(filters.failReason) || undefined,
      created_from: toRFC3339(filters.createdFrom),
      created_to: toRFC3339(filters.createdTo),
    })
    logs.value = response.data.data || []
    pagination.value = response.data.pagination || pagination.value
  } catch {
    if (!options.preserveRows) logs.value = []
  } finally {
    if (!options.preserveRows) loading.value = false
  }
}

const handleSearch = () => {
  fetchLogs(1)
}
const debouncedSearch = useDebounceFn(handleSearch, 300)

const refresh = () => {
  refreshList(() => fetchLogs(pagination.value.page, { preserveRows: true }))
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchLogs(page)
}

const pageSizeOptions = [10, 20, 50, 100]

const changePageSize = (size: number) => {
  if (size === pagination.value.page_size) return
  pagination.value.page_size = size
  fetchLogs(1)
}

const userDetailLink = (userId: number) => getAdminRouteUrl(`/users/${userId}`)

const statusLabel = (status: string) => t(`admin.userLoginLogs.status.${status || 'failed'}`)

const statusClass = (status: string) => {
  if (status === 'success') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
  return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300'
}

const failReasonLabel = (reason?: string) => {
  const normalized = (reason || '').trim()
  if (!normalized) return '-'
  const key = `admin.userLoginLogs.failReason.${normalized}`
  const translated = t(key)
  return translated === key ? normalized : translated
}

onMounted(() => {
  fetchLogs()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.userLoginLogs.title') }}</h1>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div class="w-full md:w-32">
          <Input
            v-model="filters.userId"
            type="number"
            min="1"
            :placeholder="t('admin.userLoginLogs.filterUserId')"
            @update:modelValue="debouncedSearch"
          />
        </div>
        <div class="w-full md:w-48">
          <Input
            v-model="filters.email"
            type="text"
            :placeholder="t('admin.userLoginLogs.filterEmail')"
            @update:modelValue="debouncedSearch"
          />
        </div>
        <div class="w-full md:w-36">
          <Input
            v-model="filters.clientIp"
            type="text"
            :placeholder="t('admin.userLoginLogs.filterClientIp')"
            @update:modelValue="debouncedSearch"
          />
        </div>
        <div class="w-full md:w-40">
          <Select v-model="filters.status" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.userLoginLogs.filterStatusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.userLoginLogs.filterStatusAll') }}</SelectItem>
              <SelectItem value="success">{{ t('admin.userLoginLogs.status.success') }}</SelectItem>
              <SelectItem value="failed">{{ t('admin.userLoginLogs.status.failed') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-full md:w-48">
          <Select v-model="filters.failReason" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.userLoginLogs.filterFailReasonAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.userLoginLogs.filterFailReasonAll') }}</SelectItem>
              <SelectItem v-for="item in failReasonOptions" :key="item" :value="item">
                {{ failReasonLabel(item) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center">
          <span class="text-xs text-muted-foreground whitespace-nowrap">{{ t('admin.userLoginLogs.filterCreatedFrom') }}</span>
          <Input
            v-model="filters.createdFrom"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            @update:modelValue="handleSearch"
          />
          <span class="hidden text-muted-foreground md:inline">-</span>
          <Input
            v-model="filters.createdTo"
            type="datetime-local"
            class="h-9 w-full md:w-auto"
            @update:modelValue="handleSearch"
          />
        </div>
        <div class="hidden flex-1 sm:block"></div>
        <Button size="sm" variant="outline" class="w-full sm:w-auto" :disabled="refreshing" @click="refresh">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card overflow-x-auto">
      <Table class="min-w-[840px]">
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.userLoginLogs.table.id') }}</TableHead>
            <TableHead class="min-w-[100px] px-6 py-3">{{ t('admin.userLoginLogs.table.user') }}</TableHead>
            <TableHead class="min-w-[90px] px-6 py-3">{{ t('admin.userLoginLogs.table.status') }}</TableHead>
            <TableHead class="min-w-[100px] px-6 py-3">{{ t('admin.userLoginLogs.table.failReason') }}</TableHead>
            <TableHead class="min-w-[100px] px-6 py-3">{{ t('admin.userLoginLogs.table.clientIp') }}</TableHead>
            <TableHead class="min-w-[100px] px-6 py-3">{{ t('admin.userLoginLogs.table.loginSource') }}</TableHead>
            <TableHead class="min-w-[100px] px-6 py-3">{{ t('admin.userLoginLogs.table.createdAt') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell :colspan="7" class="p-0">
              <TableSkeleton :columns="7" :rows="5" />
            </TableCell>
          </TableRow>
          <TableRow v-else-if="logs.length === 0">
            <TableCell colspan="7" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.userLoginLogs.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="item in logs" :key="item.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4"><IdCell :value="item.id" /></TableCell>
            <TableCell class="min-w-[100px] px-6 py-4 text-xs text-muted-foreground">
              <div>
                {{ t('admin.userLoginLogs.userIdLabel') }}:
                <a v-if="item.user_id" :href="userDetailLink(item.user_id)" target="_blank" rel="noopener" class="text-primary underline-offset-4 hover:underline">
                  #{{ item.user_id }}
                </a>
                <span v-else>-</span>
              </div>
              <div class="mt-1 break-all text-foreground">{{ item.email || '-' }}</div>
            </TableCell>
            <TableCell class="min-w-[90px] px-6 py-4">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="statusClass(item.status)">
                {{ statusLabel(item.status) }}
              </span>
            </TableCell>
            <TableCell class="min-w-[100px] px-6 py-4 text-xs text-muted-foreground">{{ failReasonLabel(item.fail_reason) }}</TableCell>
            <TableCell class="min-w-[100px] px-6 py-4 font-mono text-xs text-foreground break-all">{{ item.client_ip || '-' }}</TableCell>
            <TableCell class="min-w-[100px] px-6 py-4 text-xs text-muted-foreground break-words">{{ item.login_source || '-' }}</TableCell>
            <TableCell class="min-w-[100px] px-6 py-4 text-xs text-muted-foreground">{{ formatDate(item.created_at) }}</TableCell>
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
  </div>
</template>
