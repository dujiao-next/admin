<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

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
  is_selectable: false,
  batch_no: '',
  note: '',
})
const batchSubmitting = ref(false)
const batchError = ref('')
const batchSuccess = ref('')

// --- CSV import ---
const importForm = ref({
  file: null as File | null,
  is_selectable: false,
  batch_no: '',
  note: '',
})
const importSubmitting = ref(false)
const importError = ref('')
const importSuccess = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const importFileLabel = computed(() => importForm.value.file?.name || t('admin.cardSecrets.csvPlaceholder'))

const resetBatchForm = () => {
  batchForm.value.secrets = ''
  batchForm.value.is_selectable = false
  batchForm.value.batch_no = ''
  batchForm.value.note = ''
  batchError.value = ''
  batchSuccess.value = ''
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
  const secrets = batchForm.value.secrets
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item)
  if (!secrets.length) {
    batchError.value = t('admin.cardSecrets.errors.secretsRequired')
    return
  }

  batchSubmitting.value = true
  try {
    await adminAPI.createCardSecretBatch({
      product_id: props.productId,
      sku_id: props.skuId || undefined,
      secrets,
      is_selectable: batchForm.value.is_selectable,
      batch_no: batchForm.value.batch_no.trim(),
      note: batchForm.value.note.trim(),
    })
    batchSuccess.value = t('admin.cardSecrets.success.batchCreated')
    batchForm.value.secrets = ''
    emit('success')
  } catch (err: any) {
    batchError.value = err.message || t('admin.cardSecrets.errors.batchFailed')
  } finally {
    batchSubmitting.value = false
  }
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files && target.files[0]
  importForm.value.file = file || null
}

const triggerImportFile = () => {
  fileInput.value?.click()
}

const clearImportFile = () => {
  importForm.value.file = null
  if (fileInput.value) fileInput.value.value = ''
}

const resetImportForm = () => {
  clearImportFile()
  importForm.value.is_selectable = false
  importForm.value.batch_no = ''
  importForm.value.note = ''
  importError.value = ''
  importSuccess.value = ''
  if (fileInput.value) fileInput.value.value = ''
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
    const formData = new FormData()
    formData.append('product_id', String(props.productId))
    if (props.skuId > 0) {
      formData.append('sku_id', String(props.skuId))
    }
    formData.append('is_selectable', String(importForm.value.is_selectable))
    formData.append('batch_no', importForm.value.batch_no.trim())
    formData.append('note', importForm.value.note.trim())
    formData.append('file', importForm.value.file)
    await adminAPI.importCardSecretCSV(formData)
    importSuccess.value = t('admin.cardSecrets.success.imported')
    resetImportForm()
    emit('success')
  } catch (err: any) {
    importError.value = err.message || t('admin.cardSecrets.errors.importFailed')
  } finally {
    importSubmitting.value = false
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
          <Textarea
            v-model="batchForm.secrets"
            rows="6"
            :placeholder="batchForm.is_selectable ? '一行一个，例如：T12345---12344' : t('admin.cardSecrets.secretsPlaceholder')"
          />
        </div>
        <label class="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm text-foreground">
          <input v-model="batchForm.is_selectable" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-input" />
          <span>
            <span class="block font-medium">作为自选卡密导入</span>
            <span class="block text-xs text-muted-foreground">格式必须是 `TXXXXX---12344`，系统只展示前缀 `TXXXXX`，实际自动发货仍发送完整卡密。</span>
          </span>
        </label>
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
          <div class="flex flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <Button type="button" size="sm" variant="outline" @click="triggerImportFile">{{ t('admin.cardSecrets.csvChoose') }}</Button>
            <span class="flex-1 truncate" :class="importForm.file ? 'text-foreground' : 'text-muted-foreground'">{{ importFileLabel }}</span>
            <Button v-if="importForm.file" type="button" size="sm" variant="ghost" @click="clearImportFile">{{ t('admin.cardSecrets.csvClear') }}</Button>
          </div>
          <input ref="fileInput" type="file" accept=".csv" class="hidden" @change="handleFileChange" />
          <p class="mt-2 text-xs text-muted-foreground">{{ t('admin.cardSecrets.csvHint') }}</p>
        </div>
        <label class="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm text-foreground">
          <input v-model="importForm.is_selectable" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-input" />
          <span>
            <span class="block font-medium">CSV 作为自选卡密导入</span>
            <span class="block text-xs text-muted-foreground">CSV 的 `secret` 列也必须是 `TXXXXX---12344` 格式，系统只展示前缀，自动发货发送完整卡密。</span>
          </span>
        </label>
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
  </div>
</template>
