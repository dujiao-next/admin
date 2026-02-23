<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'

const loading = ref(true)
const coupons = ref<any[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const jumpPage = ref('')
const filters = reactive({
  id: '',
  code: '',
  isActive: '__all__',
})
const autoOpenId = ref<number | null>(null)
const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const showModal = ref(false)
const error = ref('')
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  code: '',
  type: 'percent',
  value: 0,
  scope_ref_ids: '',
  min_amount: 0,
  max_discount: 0,
  usage_limit: 0,
  per_user_limit: 0,
  starts_at: '',
  ends_at: '',
  is_active: true,
})
const { t } = useI18n()
const route = useRoute()

const applyRouteFilter = () => {
  const rawCode = route.query.code
  if (typeof rawCode === 'string' && rawCode.trim() !== '') {
    filters.code = rawCode.trim()
  } else {
    filters.code = ''
  }
  const rawId = route.query.id || route.query.coupon_id
  const parsed = Number(rawId)
  if (Number.isFinite(parsed) && parsed > 0) {
    filters.id = String(parsed)
    autoOpenId.value = parsed
    return
  }
  filters.id = ''
  autoOpenId.value = null
}

const discountTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    percent: t('admin.common.discountTypes.percent'),
    fixed: t('admin.common.discountTypes.fixed'),
  }
  return map[type] || type
}

const resetForm = () => {
  form.code = ''
  form.type = 'percent'
  form.value = 0
  form.scope_ref_ids = ''
  form.min_amount = 0
  form.max_discount = 0
  form.usage_limit = 0
  form.per_user_limit = 0
  form.starts_at = ''
  form.ends_at = ''
  form.is_active = true
  editingId.value = null
  isEditing.value = false
}

const toISO = (raw: string) => {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toISOString()
}

const toLocalInput = (raw?: string) => {
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

const formatScopeInput = (scope: any) => {
  if (Array.isArray(scope)) return scope.join(', ')
  if (typeof scope === 'string') {
    try {
      const parsed = JSON.parse(scope)
      if (Array.isArray(parsed)) {
        return parsed.join(', ')
      }
    } catch (_err) {
      return scope
    }
  }
  return ''
}

const parseScopeIDs = (raw: string) => {
  return raw
    .split(/[,，\s]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
}

const fetchCoupons = async (page = 1) => {
  loading.value = true
  try {
    const normalizedIsActive = normalizeFilterValue(filters.isActive)
    const isActiveValue = normalizedIsActive === '' ? undefined : normalizedIsActive === 'true'
    const response = await adminAPI.getCoupons({
      page,
      page_size: pagination.value.page_size,
      id: filters.id || undefined,
      code: filters.code || undefined,
      is_active: isActiveValue,
    })
    coupons.value = (response.data.data as any[]) || []
    pagination.value = response.data.pagination || pagination.value
    if (autoOpenId.value) {
      const target = coupons.value.find((item) => item.id === autoOpenId.value)
      if (target) {
        openEditModal(target)
      }
      autoOpenId.value = null
    }
  } catch {
    coupons.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchCoupons(1)
}

const refresh = () => {
  fetchCoupons(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchCoupons(page)
}

const jumpToPage = () => {
  if (!jumpPage.value) return
  const raw = Number(jumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), pagination.value.total_page)
  if (target === pagination.value.page) return
  changePage(target)
}

const openCreateModal = () => {
  error.value = ''
  resetForm()
  showModal.value = true
}

const openEditModal = (coupon: any) => {
  error.value = ''
  isEditing.value = true
  editingId.value = coupon.id
  form.code = coupon.code || ''
  form.type = coupon.type || 'percent'
  form.value = coupon.value || 0
  form.scope_ref_ids = formatScopeInput(coupon.scope_ref_ids)
  form.min_amount = coupon.min_amount || 0
  form.max_discount = coupon.max_discount || 0
  form.usage_limit = coupon.usage_limit || 0
  form.per_user_limit = coupon.per_user_limit || 0
  form.starts_at = toLocalInput(coupon.starts_at)
  form.ends_at = toLocalInput(coupon.ends_at)
  form.is_active = Boolean(coupon.is_active)
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  isEditing.value = false
  editingId.value = null
}

const handleSubmit = async () => {
  error.value = ''
  const scopeIDs = parseScopeIDs(form.scope_ref_ids)
  if (!scopeIDs.length) {
    error.value = t('admin.coupons.errors.scopeRequired')
    return
  }
  try {
    const payload = {
      code: form.code.trim(),
      type: form.type,
      value: Number(form.value),
      scope_ref_ids: scopeIDs,
      min_amount: Number(form.min_amount || 0),
      max_discount: Number(form.max_discount || 0),
      usage_limit: Number(form.usage_limit || 0),
      per_user_limit: Number(form.per_user_limit || 0),
      starts_at: form.starts_at ? toISO(form.starts_at) : '',
      ends_at: form.ends_at ? toISO(form.ends_at) : '',
      is_active: form.is_active,
    }
    if (isEditing.value && editingId.value) {
      await adminAPI.updateCoupon(editingId.value, payload)
    } else {
      await adminAPI.createCoupon(payload)
    }
    closeModal()
    fetchCoupons(1)
  } catch (err: any) {
    error.value =
      err.message ||
      (isEditing.value ? t('admin.coupons.errors.updateFailed') : t('admin.coupons.errors.createFailed'))
  }
}

const handleDelete = async (coupon: any) => {
  const confirmed = await confirmAction({ description: t('admin.coupons.confirmDelete', { code: coupon.code }), confirmText: t('admin.common.delete'), variant: 'destructive' })
  if (!confirmed) return
  try {
    await adminAPI.deleteCoupon(coupon.id)
    fetchCoupons(pagination.value.page)
  } catch (err: any) {
    const message = err.message || t('admin.coupons.errors.deleteFailed')
    notifyError(message)
  }
}

const formatScope = (scope?: any) => {
  if (Array.isArray(scope) && scope.length > 0) {
    return scope.join(', ')
  }
  if (typeof scope === 'string') {
    try {
      const parsed = JSON.parse(scope)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.join(', ')
      }
    } catch (_err) {
      return scope || '-'
    }
  }
  return '-'
}

onMounted(() => {
  applyRouteFilter()
  fetchCoupons()
})

watch(
  () => route.query.id,
  () => {
    applyRouteFilter()
    fetchCoupons(1)
  }
)

watch(
  () => route.query.coupon_id,
  () => {
    applyRouteFilter()
    fetchCoupons(1)
  }
)

watch(
  () => route.query.code,
  () => {
    applyRouteFilter()
    fetchCoupons(1)
  }
)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.coupons.title') }}</h1>
      <Button size="sm" class="gap-2" @click="openCreateModal">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('admin.coupons.create') }}
      </Button>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-48">
          <Input v-model="filters.code" :placeholder="t('admin.coupons.filterCode')" @update:modelValue="handleSearch" />
        </div>
        <div class="w-full md:w-48">
          <Select v-model="filters.isActive" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
            <SelectValue :placeholder="t('admin.coupons.filterStatusAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.coupons.filterStatusAll') }}</SelectItem>
              <SelectItem value="true">{{ t('admin.common.enabled') }}</SelectItem>
              <SelectItem value="false">{{ t('admin.common.disabled') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex-1"></div>
        <Button size="sm" @click="refresh">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.code') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.type') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.value') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.scope') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.limits') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.period') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.coupons.table.status') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.coupons.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="9" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="coupons.length === 0">
            <TableCell colspan="9" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.coupons.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="coupon in coupons" :key="coupon.id" class="hover:bg-muted/30">
            <TableCell class="px-6 py-4">
              <IdCell :value="coupon.id" />
            </TableCell>
            <TableCell class="px-6 py-4 text-foreground font-medium">{{ coupon.code }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ discountTypeLabel(coupon.type) }}</TableCell>
            <TableCell class="px-6 py-4 text-foreground font-mono">{{ coupon.value }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatScope(coupon.scope_ref_ids) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div>{{ t('admin.coupons.limit.minAmount') }}：{{ coupon.min_amount || '-' }}</div>
              <div>{{ t('admin.coupons.limit.maxDiscount') }}：{{ coupon.max_discount || '-' }}</div>
              <div>{{ t('admin.coupons.limit.usageLimit') }}：{{ coupon.usage_limit || '-' }}</div>
              <div>{{ t('admin.coupons.limit.perUserLimit') }}：{{ coupon.per_user_limit || '-' }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div>{{ t('admin.coupons.period.startsAt') }}：{{ formatDate(coupon.starts_at) || '-' }}</div>
              <div>{{ t('admin.coupons.period.endsAt') }}：{{ formatDate(coupon.ends_at) || '-' }}</div>
            </TableCell>
            <TableCell class="px-6 py-4">
              <span
                class="inline-flex rounded-full border px-2.5 py-1 text-xs"
                :class="coupon.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-muted-foreground border-border bg-muted/30'"
              >
                {{ coupon.is_active ? t('admin.common.enabled') : t('admin.common.disabled') }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <Button size="sm" variant="outline" @click="openEditModal(coupon)">{{ t('admin.coupons.actions.edit') }}</Button>
                <Button size="sm" variant="destructive" @click="handleDelete(coupon)">{{ t('admin.coupons.actions.delete') }}</Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        v-if="pagination.total_page > 1"
        class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4"
      >
        <div class="flex items-center gap-3">
          <span class="text-xs text-muted-foreground">
            {{ t('admin.common.pageInfo', { total: pagination.total, page: pagination.page, totalPage: pagination.total_page }) }}
          </span>
        </div>
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
            <Button
              variant="outline"
              size="sm"
              class="h-8"
              :disabled="pagination.page >= pagination.total_page"
              @click="changePage(pagination.page + 1)"
            >
              {{ t('admin.common.nextPage') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <Dialog v-model:open="showModal" @update:open="(value) => { if (!value) closeModal() }">
      <DialogScrollContent class="w-full max-w-3xl" @interact-outside="(e) => e.preventDefault()">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? t('admin.coupons.modal.editTitle') : t('admin.coupons.modal.title') }}</DialogTitle>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.code') }} *</label>
              <Input v-model="form.code" required placeholder="PROMO2026" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.type') }} *</label>
              <Select v-model="form.type">
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.common.discountTypes.percent')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">{{ t('admin.common.discountTypes.percent') }}</SelectItem>
                  <SelectItem value="fixed">{{ t('admin.common.discountTypes.fixed') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.value') }} *</label>
              <Input v-model.number="form.value" type="number" step="0.01" required placeholder="20" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.scope') }} *</label>
              <Input v-model="form.scope_ref_ids" placeholder="10,11,12" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.minAmount') }}</label>
              <Input v-model.number="form.min_amount" type="number" step="0.01" placeholder="0" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.maxDiscount') }}</label>
              <Input v-model.number="form.max_discount" type="number" step="0.01" placeholder="0" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.usageLimit') }}</label>
              <Input v-model.number="form.usage_limit" type="number" placeholder="0" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.perUserLimit') }}</label>
              <Input v-model.number="form.per_user_limit" type="number" placeholder="0" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.startsAt') }}</label>
              <Input v-model="form.starts_at" type="datetime-local" />
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">{{ t('admin.coupons.modal.endsAt') }}</label>
              <Input v-model="form.ends_at" type="datetime-local" />
            </div>
            <div class="flex items-center gap-2 md:col-span-2">
              <input v-model="form.is_active" type="checkbox" class="h-4 w-4 accent-primary" />
              <span class="text-xs text-muted-foreground">{{ t('admin.common.enabled') }}</span>
            </div>
          </div>

          <div v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {{ error }}
          </div>

          <div class="flex justify-end gap-3">
            <Button type="button" variant="outline" @click="closeModal">{{ t('admin.common.cancel') }}</Button>
            <Button type="submit">{{ t('admin.common.save') }}</Button>
          </div>
        </form>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
