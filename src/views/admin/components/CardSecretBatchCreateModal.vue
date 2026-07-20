<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminCardSecretImportResult } from '@/api/types'
import { AlertTriangle, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import FileInput from '@/components/FileInput.vue'

const props = defineProps<{
  modelValue: boolean
  productId: number
  skuId: number
  requireSkuSelection?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const { t } = useI18n()

// --- Manual batch create ---
const batchForm = ref({
  secrets: '',
  batch_no: '',
  note: '',
})
const batchSubmitting = ref(false)
const batchError = ref('')
const batchSuccess = ref('')

// --- CSV import ---
const importForm = ref({
  file: null as File | null,
  batch_no: '',
  note: '',
})
const importSubmitting = ref(false)
const importError = ref('')
const importSuccess = ref('')
const fileInputKey = ref(0)
type ImportKind = 'manual' | 'csv'
const duplicateDialog = ref<{
  kind: ImportKind
  count: number
  duplicates: string[]
} | null>(null)
const duplicateSubmitting = ref(false)
const duplicateError = ref('')

const resetBatchForm = () => {
  batchForm.value.secrets = ''
  batchForm.value.batch_no = ''
  batchForm.value.note = ''
  batchError.value = ''
  batchSuccess.value = ''
}

const parseImportResult = (response: any): AdminCardSecretImportResult => {
  const payload = response?.data?.data || {}
  return {
    requires_confirmation: Boolean(payload.requires_confirmation),
    duplicate_count: Number(payload.duplicate_count || 0),
    duplicates: Array.isArray(payload.duplicates) ? payload.duplicates.map((item: unknown) => String(item)) : [],
    created: Number(payload.created || 0),
    imported: Number(payload.imported ?? payload.created ?? 0),
    batch_id: Number(payload.batch_id || 0) || undefined,
    batch_no: String(payload.batch_no || '') || undefined,
  }
}

const normalizedBatchSecrets = () => Array.from(new Set(
  batchForm.value.secrets
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item),
))

const requestBatchImport = async (overwriteDuplicates: boolean) => {
  const response = await adminAPI.createCardSecretBatch({
    product_id: props.productId,
    sku_id: props.skuId || undefined,
    secrets: normalizedBatchSecrets(),
    batch_no: batchForm.value.batch_no.trim(),
    note: batchForm.value.note.trim(),
    overwrite_duplicates: overwriteDuplicates,
  })
  return parseImportResult(response)
}

const openDuplicateDialog = (kind: ImportKind, result: AdminCardSecretImportResult) => {
  duplicateDialog.value = {
    kind,
    count: Number(result.duplicate_count || result.duplicates?.length || 0),
    duplicates: result.duplicates || [],
  }
  duplicateError.value = ''
}

const finishBatchImport = (result: AdminCardSecretImportResult) => {
  batchSuccess.value = t('admin.cardSecrets.success.batchCreatedCount', { count: result.imported })
  batchForm.value.secrets = ''
  emit('success')
}

const handleBatchCreate = async () => {
  batchError.value = ''
  batchSuccess.value = ''
  if (!props.productId) {
    batchError.value = t('admin.cardSecrets.errors.productRequired')
    return
  }
  if (props.requireSkuSelection && !props.skuId) {
    batchError.value = t('admin.cardSecrets.errors.skuRequired')
    return
  }
  const secrets = normalizedBatchSecrets()
  if (!secrets.length) {
    batchError.value = t('admin.cardSecrets.errors.secretsRequired')
    return
  }

  batchSubmitting.value = true
  try {
    const result = await requestBatchImport(false)
    if (result.requires_confirmation) {
      openDuplicateDialog('manual', result)
      return
    }
    finishBatchImport(result)
  } catch (err: any) {
    batchError.value = err.message || t('admin.cardSecrets.errors.batchFailed')
  } finally {
    batchSubmitting.value = false
  }
}

const handleFileChange = (files: FileList | null) => {
  importForm.value.file = (files && files[0]) || null
}

const clearImportFile = () => {
  importForm.value.file = null
  fileInputKey.value += 1
}

const resetImportForm = () => {
  clearImportFile()
  importForm.value.batch_no = ''
  importForm.value.note = ''
  importError.value = ''
  importSuccess.value = ''
}

const requestCSVImport = async (overwriteDuplicates: boolean) => {
  const formData = new FormData()
  formData.append('product_id', String(props.productId))
  if (props.skuId > 0) {
    formData.append('sku_id', String(props.skuId))
  }
  formData.append('batch_no', importForm.value.batch_no.trim())
  formData.append('note', importForm.value.note.trim())
  formData.append('overwrite_duplicates', String(overwriteDuplicates))
  formData.append('file', importForm.value.file as File)
  const response = await adminAPI.importCardSecretCSV(formData)
  return parseImportResult(response)
}

const finishCSVImport = (result: AdminCardSecretImportResult) => {
  clearImportFile()
  importForm.value.batch_no = ''
  importForm.value.note = ''
  importSuccess.value = t('admin.cardSecrets.success.importedCount', { count: result.imported })
  emit('success')
}

const handleImport = async () => {
  importError.value = ''
  importSuccess.value = ''
  if (!props.productId) {
    importError.value = t('admin.cardSecrets.errors.productRequired')
    return
  }
  if (props.requireSkuSelection && !props.skuId) {
    importError.value = t('admin.cardSecrets.errors.skuRequired')
    return
  }
  if (!importForm.value.file) {
    importError.value = t('admin.cardSecrets.errors.fileRequired')
    return
  }

  importSubmitting.value = true
  try {
    const result = await requestCSVImport(false)
    if (result.requires_confirmation) {
      openDuplicateDialog('csv', result)
      return
    }
    finishCSVImport(result)
  } catch (err: any) {
    importError.value = err.message || t('admin.cardSecrets.errors.importFailed')
  } finally {
    importSubmitting.value = false
  }
}

const closeDuplicateDialog = () => {
  if (duplicateSubmitting.value) return
  duplicateDialog.value = null
  duplicateError.value = ''
}

const confirmDuplicateOverwrite = async () => {
  const pending = duplicateDialog.value
  if (!pending) return
  duplicateSubmitting.value = true
  duplicateError.value = ''
  try {
    const result = pending.kind === 'manual'
      ? await requestBatchImport(true)
      : await requestCSVImport(true)
    if (result.requires_confirmation) {
      openDuplicateDialog(pending.kind, result)
      return
    }
    if (pending.kind === 'manual') {
      finishBatchImport(result)
    } else {
      finishCSVImport(result)
    }
    duplicateDialog.value = null
  } catch (err: any) {
    duplicateError.value = err.message || t('admin.cardSecrets.errors.importFailed')
  } finally {
    duplicateSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="modelValue" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Manual batch create -->
    <div class="rounded-xl border border-border bg-card p-6">
      <h2 class="text-lg font-semibold text-foreground mb-4">{{ t('admin.cardSecrets.batchTitle') }}</h2>
      <form class="space-y-4" @submit.prevent="handleBatchCreate">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.cardSecrets.secretsLabel') }} *</label>
          <Textarea v-model="batchForm.secrets" rows="6" :placeholder="t('admin.cardSecrets.secretsPlaceholder')" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.cardSecrets.batchNoLabel') }}</label>
            <Input v-model="batchForm.batch_no" placeholder="BATCH-20260203-001" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.cardSecrets.noteLabel') }}</label>
            <Input v-model="batchForm.note" :placeholder="t('admin.cardSecrets.notePlaceholder')" />
          </div>
        </div>
        <div v-if="batchError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {{ batchError }}
        </div>
        <div v-if="batchSuccess" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {{ batchSuccess }}
        </div>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button class="w-full sm:w-auto" type="button" variant="outline" @click="resetBatchForm">{{ t('admin.common.reset') }}</Button>
          <Button class="w-full sm:w-auto" type="submit" :disabled="batchSubmitting || !!(props.requireSkuSelection && !props.skuId)">
            {{ batchSubmitting ? t('admin.cardSecrets.submitting') : t('admin.cardSecrets.submitBatch') }}
          </Button>
        </div>
      </form>
    </div>

    <!-- CSV import -->
    <div class="rounded-xl border border-border bg-card p-6">
      <h2 class="text-lg font-semibold text-foreground mb-4">{{ t('admin.cardSecrets.importTitle') }}</h2>
      <form class="space-y-4" @submit.prevent="handleImport">
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.cardSecrets.csvLabel') }} *</label>
          <div class="flex flex-wrap items-center gap-2">
            <FileInput
              :key="fileInputKey"
              accept=".csv"
              :button-text="t('admin.cardSecrets.csvChoose')"
              @change="handleFileChange"
            />
            <Button v-if="importForm.file" type="button" size="sm" variant="ghost" @click="clearImportFile">{{ t('admin.cardSecrets.csvClear') }}</Button>
          </div>
          <p class="mt-2 text-xs text-muted-foreground">{{ t('admin.cardSecrets.csvHint') }}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.cardSecrets.batchNoLabel') }}</label>
            <Input v-model="importForm.batch_no" placeholder="BATCH-20260203-002" />
          </div>
          <div>
            <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.cardSecrets.noteLabel') }}</label>
            <Input v-model="importForm.note" :placeholder="t('admin.cardSecrets.importNotePlaceholder')" />
          </div>
        </div>
        <div v-if="importError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {{ importError }}
        </div>
        <div v-if="importSuccess" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {{ importSuccess }}
        </div>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button class="w-full sm:w-auto" type="button" variant="outline" @click="resetImportForm">{{ t('admin.common.reset') }}</Button>
          <Button class="w-full sm:w-auto" type="submit" :disabled="importSubmitting || !!(props.requireSkuSelection && !props.skuId)">
            {{ importSubmitting ? t('admin.cardSecrets.importing') : t('admin.cardSecrets.startImport') }}
          </Button>
        </div>
      </form>
    </div>

    <div
      v-if="duplicateDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div class="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div class="flex items-start gap-3 border-b border-border px-5 py-4">
          <div class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <AlertTriangle class="h-5 w-5" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-base font-semibold text-foreground">{{ t('admin.cardSecrets.duplicate.title') }}</h3>
            <p class="mt-1 text-sm leading-6 text-muted-foreground">
              {{ t('admin.cardSecrets.duplicate.description', { count: duplicateDialog.count }) }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            :title="t('admin.common.close')"
            :aria-label="t('admin.common.close')"
            :disabled="duplicateSubmitting"
            @click="closeDuplicateDialog"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <div class="min-h-0 flex-1 space-y-3 px-5 py-4">
          <div class="max-h-[46vh] overflow-y-auto rounded-lg border border-border bg-muted/20">
            <div
              v-for="(secret, index) in duplicateDialog.duplicates"
              :key="`${secret}-${index}`"
              class="flex gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0"
            >
              <span class="w-8 shrink-0 text-right text-muted-foreground">{{ index + 1 }}</span>
              <span class="min-w-0 break-all font-mono text-foreground">{{ secret }}</span>
            </div>
          </div>
          <p class="text-xs leading-5 text-muted-foreground">{{ t('admin.cardSecrets.duplicate.preserveHint') }}</p>
          <p v-if="duplicateError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {{ duplicateError }}
          </p>
        </div>

        <div class="flex flex-col-reverse gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" :disabled="duplicateSubmitting" @click="closeDuplicateDialog">
            {{ t('admin.cardSecrets.duplicate.cancel') }}
          </Button>
          <Button :disabled="duplicateSubmitting" @click="confirmDuplicateOverwrite">
            {{ duplicateSubmitting ? t('admin.cardSecrets.duplicate.overwriting') : t('admin.cardSecrets.duplicate.overwrite') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
