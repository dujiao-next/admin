<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminOrderRefund } from '@/api/types'
import IdCell from '@/components/IdCell.vue'
import { Copy } from 'lucide-vue-next'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { copyText } from '@/utils/clipboard'
import { getAdminRouteUrl } from '@/utils/adminPath'
import { formatDate, getLocalizedText } from '@/utils/format'
import { formatSkuDisplayLabel } from '@/utils/sku'

const props = defineProps<{
  modelValue: boolean
  refundId?: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t, locale } = useI18n()

const entrySkuLabel = (entry: Record<string, unknown>) =>
  formatSkuDisplayLabel(entry?.sku_snapshot, locale.value)
const detailLoading = ref(false)
const detailError = ref('')
const detailRefund = ref<AdminOrderRefund | null>(null)

const resetDetail = () => {
  detailLoading.value = false
  detailError.value = ''
  detailRefund.value = null
}

const resolveOrderDetailLink = (refund: AdminOrderRefund | null) => {
  if (!refund || !refund.order_id) return ''
  return getAdminRouteUrl(`/orders?order_id=${refund.order_id}`)
}

const refundTypeLabel = (item: AdminOrderRefund | null) => {
  if (!item) return '-'
  const code = String(item.refund_type_label || item.type || '').trim().toLowerCase()
  if (code === 'wallet') return t('admin.orderRefunds.typeWallet')
  if (code === 'manual') return t('admin.orderRefunds.typeManual')
  return code || '-'
}

const handleCopyOrderNo = async (orderNo: string) => {
  try {
    await copyText(orderNo)
  } catch {}
}

const fetchRefundDetail = async (refundId: number) => {
  detailLoading.value = true
  detailError.value = ''
  detailRefund.value = null
  try {
    const response = await adminAPI.getOrderRefund(refundId)
    detailRefund.value = response.data.data
  } catch (err: any) {
    detailError.value = err?.message || t('admin.orderRefunds.detailFetchFailed')
  } finally {
    detailLoading.value = false
  }
}

watch(
  [() => props.modelValue, () => props.refundId],
  ([open, refundId]) => {
    if (!open) {
      resetDetail()
      return
    }
    if (!refundId || refundId <= 0) {
      detailError.value = t('admin.orderRefunds.detailFetchFailed')
      detailRefund.value = null
      detailLoading.value = false
      return
    }
    void fetchRefundDetail(refundId)
  },
  { immediate: true }
)
</script>

<template>
  <Dialog :open="modelValue" @update:open="(value) => { if (!value) emit('update:modelValue', false) }">
    <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-4xl p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>{{ t('admin.orderRefunds.detailTitle') }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-6">
        <div v-if="detailLoading" class="h-32 rounded-lg border border-border bg-muted/40 animate-pulse"></div>
        <div v-else-if="detailError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {{ detailError }}
        </div>
        <div v-else-if="detailRefund" class="space-y-4 text-sm text-muted-foreground">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card class="rounded-lg border-border bg-background shadow-none">
              <CardContent class="p-4">
                <div class="mb-2 text-xs text-muted-foreground">{{ t('admin.orderRefunds.detailRefundId') }}</div>
                <div class="text-foreground">
                  <IdCell :value="detailRefund.id" />
                </div>
              </CardContent>
            </Card>
            <Card class="rounded-lg border-border bg-background shadow-none">
              <CardContent class="p-4">
                <div class="mb-2 text-xs text-muted-foreground">{{ t('admin.orderRefunds.detailOrderNo') }}</div>
                <div class="flex items-center gap-1.5 text-foreground font-mono text-sm">
                  <a
                    v-if="detailRefund.order_id"
                    :href="resolveOrderDetailLink(detailRefund)"
                    target="_blank"
                    rel="noopener"
                    class="text-primary underline-offset-4 hover:underline"
                  >
                    {{ detailRefund.order_no || `#${detailRefund.order_id}` }}
                  </a>
                  <span v-else>{{ detailRefund.order_no || '-' }}</span>
                  <button
                    v-if="detailRefund.order_no"
                    type="button"
                    class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
                    :title="t('admin.common.copy')"
                    @click="handleCopyOrderNo(detailRefund.order_no)"
                  >
                    <Copy class="h-3 w-3" />
                  </button>
                </div>
              </CardContent>
            </Card>
            <Card class="rounded-lg border-border bg-background shadow-none">
              <CardContent class="p-4">
                <div class="mb-2 text-xs text-muted-foreground">{{ t('admin.orderRefunds.detailProductName') }}</div>
                <div v-if="detailRefund.items && detailRefund.items.length > 0" class="space-y-1">
                  <div v-for="entry in detailRefund.items" :key="entry.id" class="text-xs">
                    <span class="text-foreground">{{ getLocalizedText((entry as any).title) || '-' }}</span>
                    <span v-if="entrySkuLabel(entry as any)" class="ml-1 text-muted-foreground">
                      ({{ entrySkuLabel(entry as any) }})
                    </span>
                    <span class="ml-1 text-muted-foreground">x{{ entry.quantity }}</span>
                  </div>
                </div>
                <span v-else class="text-xs text-muted-foreground">-</span>
              </CardContent>
            </Card>
            <Card class="rounded-lg border-border bg-background shadow-none">
              <CardContent class="p-4">
                <div class="mb-2 text-xs text-muted-foreground">{{ t('admin.orderRefunds.detailType') }}</div>
                <div class="text-foreground">{{ refundTypeLabel(detailRefund) }}</div>
              </CardContent>
            </Card>
            <Card class="rounded-lg border-border bg-background shadow-none">
              <CardContent class="p-4">
                <div class="mb-2 text-xs text-muted-foreground">{{ t('admin.orderRefunds.detailAmount') }}</div>
                <div class="text-foreground font-mono">{{ detailRefund.amount }} {{ detailRefund.currency }}</div>
              </CardContent>
            </Card>
            <Card class="rounded-lg border-border bg-background shadow-none">
              <CardContent class="p-4">
                <div class="mb-2 text-xs text-muted-foreground">{{ t('admin.orderRefunds.detailCreatedAt') }}</div>
                <div class="text-foreground">{{ formatDate(detailRefund.created_at) }}</div>
              </CardContent>
            </Card>
          </div>

          <Card class="rounded-lg border-border bg-background shadow-none">
            <CardContent class="p-4">
              <div class="mb-3 text-xs text-muted-foreground">{{ t('admin.orderRefunds.detailRemark') }}</div>
              <div class="min-h-[160px] rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground whitespace-pre-wrap break-words">
                {{ detailRefund.remark || t('admin.orderRefunds.noRemark') }}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>
</template>
