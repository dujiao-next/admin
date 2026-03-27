<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminCardSecret } from '@/api/types'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const props = defineProps<{
  modelValue: boolean
  cardSecret: AdminCardSecret | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const { t } = useI18n()

const editSubmitting = ref(false)
const editError = ref('')
const editForm = reactive({
  id: 0,
  secret: '',
  display_secret: '',
  is_selectable: false,
  status: 'available',
})

watch(
  () => props.cardSecret,
  (secret) => {
    if (secret) {
      editForm.id = secret.id
      editForm.secret = secret.secret || ''
      editForm.display_secret = secret.display_secret || ''
      editForm.is_selectable = Boolean(secret.is_selectable)
      editForm.status = secret.status || 'available'
      editError.value = ''
    }
  },
)

const closeModal = () => {
  emit('update:modelValue', false)
  editError.value = ''
}

const handleOpenChange = (value: boolean) => {
  if (!value) closeModal()
}

const submitEdit = async () => {
  if (!editForm.id) return
  editSubmitting.value = true
  editError.value = ''
  try {
    await adminAPI.updateCardSecret(editForm.id, {
      secret: editForm.secret,
      display_secret: editForm.display_secret,
      is_selectable: editForm.is_selectable,
      status: editForm.status,
    })
    closeModal()
    emit('success')
  } catch (error: any) {
    editError.value = error?.message || t('admin.cardSecrets.errors.updateFailed')
  } finally {
    editSubmitting.value = false
  }
}
</script>

<template>
  <Dialog :open="modelValue" @update:open="handleOpenChange">
    <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-lg p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>{{ t('admin.cardSecrets.editTitle') }}</DialogTitle>
      </DialogHeader>
      <form class="space-y-4" @submit.prevent="submitEdit">
        <div class="text-xs text-muted-foreground flex items-center gap-2">
          <span>{{ t('admin.cardSecrets.editId') }}:</span>
          <IdCell v-if="editForm.id" :value="editForm.id" />
          <span v-else>-</span>
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.cardSecrets.editSecret') }}</label>
          <Textarea v-model="editForm.secret" rows="3" :placeholder="t('admin.cardSecrets.editSecretPlaceholder')" />
        </div>
        <label class="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm text-foreground">
          <input v-model="editForm.is_selectable" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-input" />
          <span>
            <span class="block font-medium">允许前台自选</span>
            <span class="block text-xs text-muted-foreground">关闭后不会出现在自选列表里，开启后建议填写展示前缀，例如 `T12345`。</span>
          </span>
        </label>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1.5">展示前缀</label>
          <Input
            v-model="editForm.display_secret"
            placeholder="例如：T12345"
            :disabled="!editForm.is_selectable"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.cardSecrets.editStatus') }}</label>
          <Select v-model="editForm.status">
            <SelectTrigger class="h-9 w-full">
              <SelectValue :placeholder="t('admin.cardSecrets.status.available')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">{{ t('admin.cardSecrets.status.available') }}</SelectItem>
              <SelectItem value="reserved">{{ t('admin.cardSecrets.status.reserved') }}</SelectItem>
              <SelectItem value="used">{{ t('admin.cardSecrets.status.used') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-if="editError" class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {{ editError }}
        </div>
        <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button class="w-full sm:w-auto" type="button" variant="outline" @click="closeModal">{{ t('admin.common.cancel') }}</Button>
          <Button class="w-full sm:w-auto" type="submit" :disabled="editSubmitting">
            {{ editSubmitting ? t('admin.common.loading') : t('admin.common.save') }}
          </Button>
        </div>
      </form>
    </DialogScrollContent>
  </Dialog>
</template>
