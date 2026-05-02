<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { AdminTelegramBroadcast } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/utils/format'
import { notifyError } from '@/utils/notify'
import { sanitizeTelegramHtml } from '@/utils/sanitize'
import { ArrowLeft, Loader2, Paperclip } from 'lucide-vue-next'

const { t } = useI18n()
const route = useRoute()
const broadcastId = computed(() => Number(route.params.id))

const loading = ref(false)
const broadcast = ref<AdminTelegramBroadcast | null>(null)
const sanitizedMessageHtml = computed(() => sanitizeTelegramHtml(broadcast.value?.message_html || ''))

const formatRecipientType = (value: string) =>
  value === 'specific' ? t('telegramBot.broadcasts.recipientTypeSpecific') : t('telegramBot.broadcasts.recipientTypeAll')

const formatStatus = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'running') return t('telegramBot.broadcasts.statusRunning')
  if (normalized === 'completed') return t('telegramBot.broadcasts.statusCompleted')
  if (normalized === 'failed') return t('telegramBot.broadcasts.statusFailed')
  return t('telegramBot.broadcasts.statusPending')
}

const statusClass = (value: string) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'completed') return 'text-green-600'
  if (normalized === 'failed') return 'text-destructive'
  if (normalized === 'running') return 'text-blue-600'
  return 'text-muted-foreground'
}

const fetchBroadcast = async () => {
  loading.value = true
  try {
    const res = await adminAPI.getTelegramBroadcast(broadcastId.value)
    broadcast.value = res.data?.data || null
  } catch {
    notifyError(t('telegramBot.broadcasts.detailLoadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchBroadcast()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">{{ t('telegramBot.broadcasts.detailTitle') }}</h2>
        <p class="text-muted-foreground">{{ t('telegramBot.broadcasts.detailSubtitle') }}</p>
      </div>
      <Button variant="outline" class="w-full sm:w-auto" as-child>
        <RouterLink to="/telegram-bot/broadcasts">
          <ArrowLeft class="h-4 w-4 mr-2" />
          {{ t('telegramBot.broadcasts.backToList') }}
        </RouterLink>
      </Button>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="broadcast">
      <!-- Basic Info -->
      <Card>
        <CardHeader>
          <CardTitle>{{ t('telegramBot.broadcasts.detailBasicInfo') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm font-medium text-muted-foreground">ID</dt>
              <dd class="mt-1">{{ broadcast.id }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">{{ t('telegramBot.broadcasts.fieldTitle') }}</dt>
              <dd class="mt-1">{{ broadcast.title }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">{{ t('telegramBot.broadcasts.tableRecipientType') }}</dt>
              <dd class="mt-1">{{ formatRecipientType(broadcast.recipient_type) }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">{{ t('telegramBot.broadcasts.tableCreatedAt') }}</dt>
              <dd class="mt-1">{{ formatDate(broadcast.created_at) || '-' }}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <!-- Execution Status -->
      <Card>
        <CardHeader>
          <CardTitle>{{ t('telegramBot.broadcasts.detailExecution') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt class="text-sm font-medium text-muted-foreground">{{ t('telegramBot.broadcasts.tableStatus') }}</dt>
              <dd class="mt-1 font-semibold" :class="statusClass(broadcast.status)">{{ formatStatus(broadcast.status) }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">{{ t('telegramBot.broadcasts.tableRecipientCount') }}</dt>
              <dd class="mt-1">{{ broadcast.recipient_count }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">{{ t('telegramBot.broadcasts.tableSuccessCount') }}</dt>
              <dd class="mt-1 text-green-600">{{ broadcast.success_count }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">{{ t('telegramBot.broadcasts.tableFailedCount') }}</dt>
              <dd class="mt-1" :class="broadcast.failed_count > 0 ? 'text-destructive' : ''">{{ broadcast.failed_count }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">{{ t('telegramBot.broadcasts.fieldStartedAt') }}</dt>
              <dd class="mt-1">{{ formatDate(broadcast.started_at || '') || '-' }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-muted-foreground">{{ t('telegramBot.broadcasts.fieldCompletedAt') }}</dt>
              <dd class="mt-1">{{ formatDate(broadcast.completed_at || '') || '-' }}</dd>
            </div>
          </dl>
          <div v-if="broadcast.last_error" class="mt-4">
            <dt class="text-sm font-medium text-muted-foreground">{{ t('telegramBot.broadcasts.fieldLastError') }}</dt>
            <dd class="mt-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{{ broadcast.last_error }}</dd>
          </div>
        </CardContent>
      </Card>

      <!-- Message Content -->
      <Card>
        <CardHeader>
          <CardTitle>{{ t('telegramBot.broadcasts.detailMessageContent') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="rounded-md border bg-muted/50 p-4">
            <div class="prose prose-sm max-w-none dark:prose-invert break-words whitespace-pre-wrap" v-html="sanitizedMessageHtml" />
          </div>
        </CardContent>
      </Card>

      <!-- Attachment -->
      <Card v-if="broadcast.attachment_url">
        <CardHeader>
          <CardTitle>{{ t('telegramBot.broadcasts.detailAttachment') }}</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-3">
            <Paperclip class="h-4 w-4 text-muted-foreground" />
            <a :href="broadcast.attachment_url" target="_blank" rel="noopener noreferrer" class="text-sm text-primary underline underline-offset-4 hover:text-primary/80">
              {{ broadcast.attachment_name || broadcast.attachment_url }}
            </a>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
