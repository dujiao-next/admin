<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { adminAPI } from '@/api/admin'
import type { AdminApiCredential } from '@/api/types'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TableSkeleton from '@/components/TableSkeleton.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { confirmAction } from '@/utils/confirm'
import { notifyError, notifySuccess } from '@/utils/notify'

const { t } = useI18n()
const loading = ref(true)
const credentials = ref<AdminApiCredential[]>([])
const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const jumpPage = ref('')

const filterStatus = ref('__all__')
const searchQuery = ref('')
const adminPath = import.meta.env.VITE_ADMIN_PATH || ''
const userDetailLink = (userId: number) => `${adminPath}/users/${userId}`

const statusOptions = [
  { value: '__all__', key: 'apiCredentials.filters.allStatus' },
  { value: 'pending_review', key: 'apiCredentials.status.pending_review' },
  { value: 'approved', key: 'apiCredentials.status.approved' },
  { value: 'rejected', key: 'apiCredentials.status.rejected' },
]

// Detail dialog
const showDetail = ref(false)
const detailCred = ref<AdminApiCredential | null>(null)

// Reject dialog
const showReject = ref(false)
const rejectId = ref<number>(0)
const rejectReason = ref('')

const fetchCredentials = async (page = 1) => {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page, page_size: pagination.page_size }
    if (filterStatus.value && filterStatus.value !== '__all__') params.status = filterStatus.value
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
    const res = await adminAPI.getApiCredentials(params)
    credentials.value = Array.isArray(res.data?.data) ? res.data.data : []
    const pg = res.data?.pagination
    if (pg) {
      pagination.page = pg.page
      pagination.page_size = pg.page_size
      pagination.total = pg.total
      pagination.total_page = pg.total_page
    }
  } catch (e: any) {
    notifyError(e?.response?.data?.message || e.message)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchCredentials(1)
}
const debouncedSearch = useDebounceFn(handleSearch, 300)

const statusVariant = (status: string) => {
  switch (status) {
    case 'approved': return 'default'
    case 'pending_review': return 'secondary'
    case 'rejected': return 'destructive'
    default: return 'outline'
  }
}

const formatDate = (d?: string) => d ? new Date(d).toLocaleString() : '-'

const openDetail = (cred: AdminApiCredential) => {
  detailCred.value = cred
  showDetail.value = true
}

const handleApprove = async (id: number) => {
  const ok = await confirmAction(t('apiCredentials.approve.confirm'))
  if (!ok) return
  try {
    await adminAPI.approveApiCredential(id)
    notifySuccess(t('apiCredentials.approve.success'))
    fetchCredentials(pagination.page)
  } catch (e: any) {
    notifyError(e?.response?.data?.message || e.message)
  }
}

const openReject = (id: number) => {
  rejectId.value = id
  rejectReason.value = ''
  showReject.value = true
}

const handleReject = async () => {
  if (!rejectReason.value.trim()) return
  try {
    await adminAPI.rejectApiCredential(rejectId.value, { reason: rejectReason.value.trim() })
    notifySuccess(t('apiCredentials.reject.success'))
    showReject.value = false
    fetchCredentials(pagination.page)
  } catch (e: any) {
    notifyError(e?.response?.data?.message || e.message)
  }
}

const handleToggle = async (cred: AdminApiCredential) => {
  const msg = cred.is_active
    ? t('apiCredentials.toggle.disableConfirm')
    : t('apiCredentials.toggle.enableConfirm')
  const ok = await confirmAction(msg)
  if (!ok) return
  try {
    await adminAPI.updateApiCredentialStatus(cred.id, { is_active: !cred.is_active })
    notifySuccess(t('apiCredentials.toggle.success'))
    fetchCredentials(pagination.page)
  } catch (e: any) {
    notifyError(e?.response?.data?.message || e.message)
  }
}

const handleDelete = async (id: number) => {
  const ok = await confirmAction(t('apiCredentials.delete.confirm'))
  if (!ok) return
  try {
    await adminAPI.deleteApiCredential(id)
    notifySuccess(t('apiCredentials.delete.success'))
    fetchCredentials(pagination.page)
  } catch (e: any) {
    notifyError(e?.response?.data?.message || e.message)
  }
}

const goPage = (page: number) => {
  if (page < 1 || page > pagination.total_page) return
  fetchCredentials(page)
}

const handleJump = () => {
  const p = parseInt(jumpPage.value)
  if (p >= 1 && p <= pagination.total_page) {
    fetchCredentials(p)
  }
  jumpPage.value = ''
}

onMounted(() => fetchCredentials())
</script>

<template>
  <div class="space-y-4 p-4 md:p-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-2xl font-bold">{{ t('apiCredentials.title') }}</h1>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 items-center">
      <Select v-model="filterStatus" @update:model-value="fetchCredentials(1)">
        <SelectTrigger class="w-full sm:w-[160px]">
          <SelectValue :placeholder="t('apiCredentials.filters.statusPlaceholder')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ t(opt.key) }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Input
        v-model="searchQuery"
        class="w-full sm:w-[240px]"
        :placeholder="t('apiCredentials.filters.searchPlaceholder')"
        @update:modelValue="debouncedSearch"
        @keyup.enter="handleSearch"
      />
      <Button size="sm" variant="outline" @click="handleSearch">
        {{ t('apiCredentials.filters.search') }}
      </Button>
    </div>

    <!-- Table -->
    <div class="rounded-md border overflow-x-auto">
      <Table class="min-w-[940px]">
        <TableHeader>
          <TableRow>
            <TableHead>{{ t('apiCredentials.columns.id') }}</TableHead>
            <TableHead class="min-w-[160px]">{{ t('apiCredentials.columns.user') }}</TableHead>
            <TableHead class="min-w-[100px]">{{ t('apiCredentials.columns.apiKey') }}</TableHead>
            <TableHead class="min-w-[100px]">{{ t('apiCredentials.columns.status') }}</TableHead>
            <TableHead class="min-w-[90px]">{{ t('apiCredentials.columns.isActive') }}</TableHead>
            <TableHead class="min-w-[100px]">{{ t('apiCredentials.columns.lastUsedAt') }}</TableHead>
            <TableHead class="min-w-[100px]">{{ t('apiCredentials.columns.createdAt') }}</TableHead>
            <TableHead class="min-w-[160px]">{{ t('apiCredentials.columns.actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="loading">
            <TableCell :colspan="8" class="p-0">
              <TableSkeleton :columns="8" :rows="5" />
            </TableCell>
          </TableRow>
          <TableRow v-else-if="credentials.length === 0">
            <TableCell :colspan="8" class="text-center py-8 text-muted-foreground">{{ t('apiCredentials.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="cred in credentials" :key="cred.id">
            <TableCell><IdCell :value="cred.id" /></TableCell>
            <TableCell class="min-w-[160px]">
              <div class="text-sm">
                <div class="break-words font-medium">{{ cred.user?.display_name || '-' }}</div>
                <div class="break-all text-xs text-muted-foreground">{{ cred.user?.email || '-' }}</div>
                <div class="text-xs text-muted-foreground">
                  ID:
                  <a
                    :href="userDetailLink(cred.user_id)"
                    target="_blank"
                    rel="noopener"
                    class="font-mono text-primary underline-offset-4 hover:underline"
                  >
                    {{ cred.user_id }}
                  </a>
                </div>
              </div>
            </TableCell>
            <TableCell class="min-w-[100px] font-mono text-xs"><div class="break-all">{{ cred.api_key || '-' }}</div></TableCell>
            <TableCell class="min-w-[100px]">
              <Badge :variant="statusVariant(cred.status)">
                {{ t(`apiCredentials.status.${cred.status}`, cred.status) }}
              </Badge>
            </TableCell>
            <TableCell class="min-w-[90px]">
              <Badge :variant="cred.is_active ? 'default' : 'outline'">
                {{ cred.is_active ? 'ON' : 'OFF' }}
              </Badge>
            </TableCell>
            <TableCell class="min-w-[100px] text-xs">{{ formatDate(cred.last_used_at) }}</TableCell>
            <TableCell class="min-w-[100px] text-xs">{{ formatDate(cred.created_at) }}</TableCell>
            <TableCell class="min-w-[160px]">
              <div class="flex flex-wrap gap-1">
                <Button size="xs" variant="outline" @click="openDetail(cred)">
                  {{ t('apiCredentials.actions.detail') }}
                </Button>
                <Button
                  v-if="cred.status === 'pending_review'"
                  size="xs"
                  variant="default"
                  @click="handleApprove(cred.id)"
                >
                  {{ t('apiCredentials.actions.approve') }}
                </Button>
                <Button
                  v-if="cred.status === 'pending_review'"
                  size="xs"
                  variant="destructive"
                  @click="openReject(cred.id)"
                >
                  {{ t('apiCredentials.actions.reject') }}
                </Button>
                <Button
                  v-if="cred.status === 'approved'"
                  size="xs"
                  :variant="cred.is_active ? 'outline' : 'default'"
                  @click="handleToggle(cred)"
                >
                  {{ cred.is_active ? t('apiCredentials.actions.disable') : t('apiCredentials.actions.enable') }}
                </Button>
                <Button size="xs" variant="destructive" @click="handleDelete(cred.id)">
                  {{ t('apiCredentials.actions.delete') }}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.total_page > 1" class="flex items-center justify-between gap-2 text-sm">
      <span class="text-muted-foreground">
        {{ pagination.page }} / {{ pagination.total_page }} ({{ pagination.total }})
      </span>
      <div class="flex items-center gap-1">
        <Button size="sm" variant="outline" :disabled="pagination.page <= 1" @click="goPage(pagination.page - 1)">
          &laquo;
        </Button>
        <Button size="sm" variant="outline" :disabled="pagination.page >= pagination.total_page" @click="goPage(pagination.page + 1)">
          &raquo;
        </Button>
        <Input
          v-model="jumpPage"
          class="w-16 h-8 text-xs"
          placeholder="Go"
          @keyup.enter="handleJump"
        />
      </div>
    </div>

    <!-- Detail Dialog -->
    <Dialog v-model:open="showDetail">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-lg p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{{ t('apiCredentials.detail.title') }}</DialogTitle>
        </DialogHeader>
        <div v-if="detailCred" class="space-y-3 text-sm">
          <div class="grid grid-cols-1 gap-y-2 sm:grid-cols-[120px_1fr]">
            <span class="text-muted-foreground">{{ t('apiCredentials.columns.id') }}</span>
            <span>{{ detailCred.id }}</span>
            <span class="text-muted-foreground">{{ t('apiCredentials.columns.user') }}</span>
            <div>
              <div>{{ detailCred.user?.display_name || '-' }}</div>
              <div class="text-xs text-muted-foreground">{{ detailCred.user?.email || '-' }}</div>
              <div class="text-xs text-muted-foreground">ID: {{ detailCred.user_id }}</div>
            </div>
            <span class="text-muted-foreground">{{ t('apiCredentials.columns.apiKey') }}</span>
            <span class="font-mono text-xs break-all">{{ detailCred.api_key || '-' }}</span>
            <span class="text-muted-foreground">{{ t('apiCredentials.columns.status') }}</span>
            <Badge :variant="statusVariant(detailCred.status)" class="w-fit">
              {{ t(`apiCredentials.status.${detailCred.status}`, detailCred.status) }}
            </Badge>
            <span class="text-muted-foreground">{{ t('apiCredentials.columns.isActive') }}</span>
            <span>{{ detailCred.is_active ? 'ON' : 'OFF' }}</span>
            <template v-if="detailCred.reject_reason">
              <span class="text-muted-foreground">{{ t('apiCredentials.detail.rejectReason') }}</span>
              <span class="text-destructive">{{ detailCred.reject_reason }}</span>
            </template>
            <span class="text-muted-foreground">{{ t('apiCredentials.columns.approvedAt') }}</span>
            <span>{{ formatDate(detailCred.approved_at) }}</span>
            <span class="text-muted-foreground">{{ t('apiCredentials.columns.lastUsedAt') }}</span>
            <span>{{ formatDate(detailCred.last_used_at) }}</span>
            <span class="text-muted-foreground">{{ t('apiCredentials.columns.createdAt') }}</span>
            <span>{{ formatDate(detailCred.created_at) }}</span>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>

    <!-- Reject Dialog -->
    <Dialog v-model:open="showReject">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{{ t('apiCredentials.reject.title') }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>{{ t('apiCredentials.reject.reasonLabel') }}</Label>
            <Input v-model="rejectReason" :placeholder="t('apiCredentials.reject.reasonPlaceholder')" />
          </div>
          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" class="w-full sm:w-auto" @click="showReject = false">Cancel</Button>
            <Button variant="destructive" class="w-full sm:w-auto" :disabled="!rejectReason.trim()" @click="handleReject">
              {{ t('apiCredentials.actions.reject') }}
            </Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>

  </div>
</template>
