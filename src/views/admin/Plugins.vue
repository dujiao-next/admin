<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminAPI } from '@/api/admin'
import type { AdminPlugin, AdminPluginDetail, AdminPluginRuntimeLog } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { notifyError, notifySuccess } from '@/utils/notify'
import { confirmAction } from '@/utils/confirm'
import { invalidateMountedAdminPluginPages } from '@/utils/plugin-runtime-pages'

type PluginConfigSchemaType =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'json'

interface PluginConfigOption {
  label: string
  rawValue: unknown
  selectValue: string
}

interface PluginConfigField {
  key: string
  label: string
  description: string
  placeholder: string
  type: PluginConfigSchemaType
  required: boolean
  multiline: boolean
  rows: number
  defaultValue: unknown
  options: PluginConfigOption[]
}

const router = useRouter()
const fileInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const uploading = ref(false)
const applyingRuntime = ref(false)
const actionLoading = ref('')
const detailOpen = ref(false)
const detailLoading = ref(false)
const configSaving = ref(false)
const items = ref<AdminPlugin[]>([])
const detail = ref<AdminPluginDetail | null>(null)
const runtimeLogs = ref<AdminPluginRuntimeLog[]>([])
const configText = ref('{}')
const configMode = ref<'form' | 'json'>('json')
const configFormValues = ref<Record<string, any>>({})
const pagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })
const filters = reactive({ keyword: '', type: '__all__', status: '__all__' })

const normalizeSelectValue = (value: string) => (value === '__all__' ? '' : value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const normalizeSchemaType = (rawType: unknown): PluginConfigSchemaType => {
  const value = String(rawType || 'string').trim().toLowerCase()
  if (['number', 'int', 'integer', 'float', 'double'].includes(value)) return 'number'
  if (['bool', 'boolean', 'switch', 'toggle'].includes(value)) return 'boolean'
  if (['text', 'textarea', 'multiline'].includes(value)) return 'text'
  if (['select', 'enum', 'radio'].includes(value)) return 'select'
  if (['json', 'object', 'array', 'map'].includes(value)) return 'json'
  return 'string'
}

const normalizeFieldOptions = (value: unknown): PluginConfigOption[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      if (isRecord(item)) {
        const rawValue = item.value ?? item.id ?? item.key ?? item.label ?? item.name ?? ''
        const label = String((item.label ?? item.name ?? item.title ?? rawValue) || `选项 ${index + 1}`)
        return { label, rawValue, selectValue: String(index) }
      }
      return {
        label: String(item),
        rawValue: item,
        selectValue: String(index),
      }
    })
    .filter((item) => item.label.trim() !== '')
}

const normalizeConfigSchema = (schema: Record<string, unknown> | undefined | null): PluginConfigField[] => {
  if (!schema || !isRecord(schema)) return []
  return Object.entries(schema).map(([key, rawValue]) => {
    if (typeof rawValue === 'string') {
      const type = normalizeSchemaType(rawValue)
      return {
        key,
        label: key,
        description: '',
        placeholder: '',
        type,
        required: false,
        multiline: type === 'text',
        rows: type === 'text' ? 4 : 5,
        defaultValue: type === 'boolean' ? false : type === 'json' ? {} : '',
        options: [],
      }
    }

    if (Array.isArray(rawValue)) {
      const options = normalizeFieldOptions(rawValue)
      return {
        key,
        label: key,
        description: '',
        placeholder: '',
        type: options.length ? 'select' : 'json',
        required: false,
        multiline: false,
        rows: 5,
        defaultValue: options.length ? options[0]?.rawValue ?? '' : rawValue,
        options,
      }
    }

    if (isRecord(rawValue)) {
      const options = normalizeFieldOptions(rawValue.options)
      const inferredType = rawValue.type ?? (options.length ? 'select' : 'string')
      const type = normalizeSchemaType(inferredType)
      return {
        key,
        label: String(rawValue.label ?? rawValue.title ?? rawValue.name ?? key),
        description: String(rawValue.description ?? rawValue.help ?? rawValue.hint ?? ''),
        placeholder: String(rawValue.placeholder ?? ''),
        type: options.length && type === 'string' ? 'select' : type,
        required: Boolean(rawValue.required),
        multiline: Boolean(rawValue.multiline) || type === 'text',
        rows: Number(rawValue.rows || (type === 'text' ? 4 : 5)) || 5,
        defaultValue: rawValue.default ?? (type === 'boolean' ? false : type === 'json' ? {} : ''),
        options,
      }
    }

    return {
      key,
      label: key,
      description: '',
      placeholder: '',
      type: 'string',
      required: false,
      multiline: false,
      rows: 5,
      defaultValue: rawValue ?? '',
      options: [],
    }
  })
}

const pluginConfigFields = computed(() => normalizeConfigSchema(detail.value?.plugin?.config_schema))
const hasVisualConfigSchema = computed(() => pluginConfigFields.value.length > 0)

const getRawConfigObject = () => {
  const value = detail.value?.config
  return isRecord(value) ? { ...value } : {}
}

const serializeJSONValue = (value: unknown) => {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  return JSON.stringify(value ?? {}, null, 2)
}

const buildFieldInitialValue = (field: PluginConfigField, source: Record<string, unknown>) => {
  const hasValue = Object.prototype.hasOwnProperty.call(source, field.key)
  const currentValue = hasValue ? source[field.key] : field.defaultValue
  switch (field.type) {
    case 'boolean':
      return Boolean(currentValue)
    case 'number':
      return currentValue === null || currentValue === undefined ? '' : String(currentValue)
    case 'select': {
      const matched = field.options.find((item) => item.rawValue === currentValue)
      if (matched) return matched.selectValue
      const fallback = field.options.find((item) => item.rawValue === field.defaultValue)
      return fallback?.selectValue ?? ''
    }
    case 'json':
      return serializeJSONValue(currentValue ?? field.defaultValue)
    default:
      return currentValue === null || currentValue === undefined ? '' : String(currentValue)
  }
}

const syncConfigEditor = (detailValue: AdminPluginDetail | null) => {
  const currentConfig = detailValue?.config && isRecord(detailValue.config) ? detailValue.config : {}
  configText.value = JSON.stringify(currentConfig, null, 2)
  const nextFormValues: Record<string, any> = {}
  const fields = normalizeConfigSchema(detailValue?.plugin?.config_schema)
  fields.forEach((field) => {
    nextFormValues[field.key] = buildFieldInitialValue(field, currentConfig)
  })
  configFormValues.value = nextFormValues
  configMode.value = fields.length > 0 ? 'form' : 'json'
}

const parseJSONFieldValue = (field: PluginConfigField, rawValue: unknown) => {
  const text = String(rawValue ?? '').trim()
  if (!text) {
    if (field.required) {
      throw new Error(`配置项「${field.label}」不能为空`)
    }
    return undefined
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`配置项「${field.label}」不是合法 JSON`)
  }
}

const buildConfigPayloadFromForm = () => {
  const payload: Record<string, unknown> = { ...getRawConfigObject() }
  for (const field of pluginConfigFields.value) {
    const rawValue = configFormValues.value[field.key]
    switch (field.type) {
      case 'boolean':
        payload[field.key] = Boolean(rawValue)
        break
      case 'number': {
        const text = String(rawValue ?? '').trim()
        if (!text) {
          if (field.required) {
            throw new Error(`配置项「${field.label}」不能为空`)
          }
          delete payload[field.key]
          break
        }
        const parsed = Number(text)
        if (!Number.isFinite(parsed)) {
          throw new Error(`配置项「${field.label}」必须是数字`)
        }
        payload[field.key] = parsed
        break
      }
      case 'select': {
        if (!String(rawValue ?? '').trim()) {
          if (field.required) {
            throw new Error(`请选择配置项「${field.label}」`)
          }
          delete payload[field.key]
          break
        }
        const matched = field.options.find((item) => item.selectValue === rawValue)
        payload[field.key] = matched?.rawValue ?? rawValue
        break
      }
      case 'json': {
        const parsed = parseJSONFieldValue(field, rawValue)
        if (parsed === undefined) {
          delete payload[field.key]
        } else {
          payload[field.key] = parsed
        }
        break
      }
      default: {
        const text = String(rawValue ?? '')
        if (!text.trim() && field.required) {
          throw new Error(`配置项「${field.label}」不能为空`)
        }
        payload[field.key] = text
        break
      }
    }
  }
  return payload
}

const setConfigMode = (nextMode: 'form' | 'json') => {
  if (nextMode === configMode.value) return
  if (nextMode === 'json') {
    try {
      configText.value = JSON.stringify(buildConfigPayloadFromForm(), null, 2)
    } catch (err: any) {
      notifyError(err?.message || '当前表单配置有误，无法切换到 JSON 模式')
      return
    }
    configMode.value = 'json'
    return
  }

  try {
    const raw = JSON.parse(configText.value || '{}')
    if (!isRecord(raw)) {
      notifyError('原始 JSON 必须是对象')
      return
    }
    const nextFormValues: Record<string, any> = {}
    pluginConfigFields.value.forEach((field) => {
      nextFormValues[field.key] = buildFieldInitialValue(field, raw)
    })
    configFormValues.value = nextFormValues
    configMode.value = 'form'
  } catch (err: any) {
    notifyError(err instanceof SyntaxError ? '当前 JSON 格式不正确，无法切换到表单模式' : err?.message || '切换配置模式失败')
  }
}

const booleanSelectValue = (fieldKey: string) => (configFormValues.value[fieldKey] ? 'true' : 'false')

const fetchPlugins = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getPlugins({
      page,
      page_size: pagination.value.page_size,
      keyword: filters.keyword.trim() || undefined,
      type: normalizeSelectValue(filters.type) || undefined,
      status: normalizeSelectValue(filters.status) || undefined,
    })
    items.value = response.data?.data || []
    pagination.value = response.data?.pagination || pagination.value
  } catch (err: any) {
    items.value = []
    notifyError(err?.response?.data?.msg || err?.message || '加载插件列表失败')
  } finally {
    loading.value = false
  }
}

const fetchDetail = async (id: string) => {
  if (!id) return
  detailLoading.value = true
  try {
    const [detailRes, logRes] = await Promise.all([
      adminAPI.getPlugin(id),
      adminAPI.getPluginLogs(id, { page: 1, page_size: 20 }),
    ])
    detail.value = detailRes.data?.data || null
    runtimeLogs.value = logRes.data?.data || []
    syncConfigEditor(detail.value)
    detailOpen.value = true
  } catch (err: any) {
    notifyError(err?.response?.data?.msg || err?.message || '加载插件详情失败')
  } finally {
    detailLoading.value = false
  }
}

const triggerUpload = () => fileInput.value?.click()

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  uploading.value = true
  try {
    await adminAPI.uploadPlugin(formData)
    notifySuccess('插件包上传成功')
    await fetchPlugins(1)
  } catch (err: any) {
    notifyError(err?.response?.data?.msg || err?.message || '插件包上传失败')
  } finally {
    uploading.value = false
    target.value = ''
  }
}

const executeAction = async (actionKey: string, executor: () => Promise<any>, successText: string, refreshDetail = true) => {
  actionLoading.value = actionKey
  try {
    await executor()
    notifySuccess(successText)
    await fetchPlugins(pagination.value.page)
    if (refreshDetail && detail.value?.plugin?.id) {
      await fetchDetail(detail.value.plugin.id)
    }
  } catch (err: any) {
    notifyError(err?.response?.data?.msg || err?.message || `${successText}失败`)
  } finally {
    actionLoading.value = ''
  }
}

const installPlugin = async (plugin: AdminPlugin) => executeAction(`install:${plugin.id}`, () => adminAPI.installPlugin(plugin.id), '插件安装成功')
const enablePlugin = async (plugin: AdminPlugin) => executeAction(`enable:${plugin.id}`, () => adminAPI.enablePlugin(plugin.id), '插件已启用，等待应用运行时变更')
const disablePlugin = async (plugin: AdminPlugin) => executeAction(`disable:${plugin.id}`, () => adminAPI.disablePlugin(plugin.id), '插件已禁用，等待应用运行时变更')
const rollbackPlugin = async (plugin: AdminPlugin) => executeAction(`rollback:${plugin.id}`, () => adminAPI.rollbackPlugin(plugin.id), '插件版本已切换，等待应用运行时变更')

const applyRuntimeChanges = async () => {
  applyingRuntime.value = true
  const currentDetailID = detail.value?.plugin?.id || ''
  const currentDetailStatus = detail.value?.plugin?.status || ''
  try {
    await adminAPI.applyPluginRuntimeChanges()
    invalidateMountedAdminPluginPages()
    window.dispatchEvent(new Event('admin-plugin-runtime-pages-changed'))
    notifySuccess('插件运行时变更已应用')
    await fetchPlugins(pagination.value.page)
    if (currentDetailID) {
      if (currentDetailStatus === 'remove_pending_restart') {
        detailOpen.value = false
        detail.value = null
        runtimeLogs.value = []
      } else {
        await fetchDetail(currentDetailID)
      }
    }
  } catch (err: any) {
    notifyError(err?.response?.data?.msg || err?.message || '应用插件运行时变更失败')
  } finally {
    applyingRuntime.value = false
  }
}

const removePlugin = async (plugin: AdminPlugin) => {
  const confirmed = await confirmAction({
    description: `确定移除插件 ${plugin.name}（${plugin.id}）吗？`,
    confirmText: '移除',
    variant: 'destructive',
  })
  if (!confirmed) return
  await executeAction(`remove:${plugin.id}`, () => adminAPI.deletePlugin(plugin.id, { purge: true }), '插件已标记移除，应用运行时变更后完成清理')
}

const saveConfig = async () => {
  if (!detail.value?.plugin?.id) return
  configSaving.value = true
  try {
    const payload = hasVisualConfigSchema.value && configMode.value === 'form'
      ? buildConfigPayloadFromForm()
      : JSON.parse(configText.value || '{}')
    if (!isRecord(payload)) {
      notifyError('插件配置必须是 JSON 对象')
      return
    }
    await adminAPI.updatePluginConfig(detail.value.plugin.id, payload)
    notifySuccess('插件配置已保存')
    await fetchDetail(detail.value.plugin.id)
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      notifyError('插件配置 JSON 格式不正确')
    } else if (err instanceof Error) {
      notifyError(err.message || '保存插件配置失败')
    } else {
      notifyError(err?.response?.data?.msg || err?.message || '保存插件配置失败')
    }
  } finally {
    configSaving.value = false
  }
}

const typeLabel = (value?: string) => {
  const map: Record<string, string> = { theme: '模板', payment: '支付', feature: '功能' }
  return map[value || ''] || value || '-'
}

const statusLabel = (value?: string) => {
  const map: Record<string, string> = {
    uploaded: '已上传',
    installed: '已安装',
    enabled: '已启用',
    disabled: '已禁用',
    load_failed: '加载失败',
    upgrade_pending_restart: '待重载生效',
    remove_pending_restart: '待重载删除',
  }
  return map[value || ''] || value || '-'
}

const statusVariant = (value?: string) => {
  switch (value) {
    case 'enabled': return 'default'
    case 'load_failed': return 'destructive'
    case 'upgrade_pending_restart': return 'secondary'
    case 'remove_pending_restart': return 'destructive'
    default: return 'outline'
  }
}

const canInstall = (plugin: AdminPlugin) => ['uploaded'].includes(plugin.status)
const canEnable = (plugin: AdminPlugin) => !plugin.is_enabled && ['installed', 'disabled', 'upgrade_pending_restart'].includes(plugin.status)
const canDisable = (plugin: AdminPlugin) => plugin.is_enabled
const canRollback = (plugin: AdminPlugin) => !!plugin.current_version

const activeVersion = computed(() => detail.value?.versions?.find((item) => item.is_active) || null)
const pendingChangeCount = computed(() => items.value.filter((item) => item.needs_restart).length)
const hasPendingChanges = computed(() => pendingChangeCount.value > 0)

onMounted(() => {
  fetchPlugins(1)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">插件中心</h1>
        <p class="text-sm text-muted-foreground">管理本地导入插件、版本切换、运行状态与插件配置。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="router.push('/plugin-market')">在线插件库</Button>
        <Button variant="outline" :disabled="uploading" @click="triggerUpload">{{ uploading ? '上传中...' : '导入插件包' }}</Button>
        <input ref="fileInput" type="file" accept=".zip,.tar.gz,.tgz" class="hidden" @change="onFileChange" />
      </div>
    </div>

    <Card v-if="hasPendingChanges" class="border-amber-200 bg-amber-50/60">
      <CardContent class="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="space-y-1 text-sm">
          <div class="font-medium text-amber-950">有 {{ pendingChangeCount }} 个插件变更待应用</div>
          <div class="text-amber-900/80">启用、禁用、回滚和删除会先进入待重载状态，点击这里统一应用运行时变更。</div>
        </div>
        <Button :disabled="applyingRuntime" @click="applyRuntimeChanges">{{ applyingRuntime ? '应用中...' : '应用运行时变更' }}</Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>筛选条件</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3 lg:flex-row">
        <Input v-model="filters.keyword" placeholder="按插件 ID / 名称 / 作者搜索" @keyup.enter="fetchPlugins(1)" />
        <Select v-model="filters.type" @update:modelValue="fetchPlugins(1)">
          <SelectTrigger class="w-full lg:w-40"><SelectValue placeholder="全部类型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部类型</SelectItem>
            <SelectItem value="theme">模板</SelectItem>
            <SelectItem value="payment">支付</SelectItem>
            <SelectItem value="feature">功能</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="filters.status" @update:modelValue="fetchPlugins(1)">
          <SelectTrigger class="w-full lg:w-52"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            <SelectItem value="uploaded">已上传</SelectItem>
            <SelectItem value="installed">已安装</SelectItem>
            <SelectItem value="enabled">已启用</SelectItem>
            <SelectItem value="disabled">已禁用</SelectItem>
            <SelectItem value="load_failed">加载失败</SelectItem>
            <SelectItem value="upgrade_pending_restart">待重载生效</SelectItem>
            <SelectItem value="remove_pending_restart">待重载删除</SelectItem>
          </SelectContent>
        </Select>
        <Button class="lg:w-auto" @click="fetchPlugins(1)">搜索</Button>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[240px]">插件</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>版本</TableHead>
              <TableHead>状态</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell colspan="6" class="py-8 text-center text-muted-foreground">正在加载插件列表...</TableCell>
            </TableRow>
            <TableRow v-else-if="items.length === 0">
              <TableCell colspan="6" class="py-8 text-center text-muted-foreground">暂无插件数据</TableCell>
            </TableRow>
            <TableRow v-for="plugin in items" :key="plugin.id">
              <TableCell>
                <div class="space-y-1">
                  <div class="font-medium">{{ plugin.name }}</div>
                  <div class="text-xs text-muted-foreground">{{ plugin.id }}</div>
                  <div class="text-xs text-muted-foreground">作者：{{ plugin.author || '-' }}</div>
                </div>
              </TableCell>
              <TableCell>{{ typeLabel(plugin.type) }}</TableCell>
              <TableCell>{{ plugin.source || '-' }}</TableCell>
              <TableCell>
                <div class="space-y-1 text-xs">
                  <div>当前：{{ plugin.current_version || '-' }}</div>
                  <div class="text-muted-foreground">待生效：{{ plugin.pending_version || '-' }}</div>
                </div>
              </TableCell>
              <TableCell>
                <div class="space-y-2">
                  <Badge :variant="statusVariant(plugin.status) as any">{{ statusLabel(plugin.status) }}</Badge>
                  <div v-if="plugin.last_error" class="max-w-xs text-xs text-rose-500 line-clamp-2">{{ plugin.last_error }}</div>
                </div>
              </TableCell>
              <TableCell class="text-right">
                <div class="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" @click="fetchDetail(plugin.id)">详情</Button>
                  <Button size="sm" variant="outline" :disabled="!canInstall(plugin) || actionLoading === `install:${plugin.id}`" @click="installPlugin(plugin)">安装</Button>
                  <Button size="sm" variant="outline" :disabled="!canEnable(plugin) || actionLoading === `enable:${plugin.id}`" @click="enablePlugin(plugin)">启用</Button>
                  <Button size="sm" variant="outline" :disabled="!canDisable(plugin) || actionLoading === `disable:${plugin.id}`" @click="disablePlugin(plugin)">禁用</Button>
                  <Button size="sm" variant="outline" :disabled="!canRollback(plugin) || actionLoading === `rollback:${plugin.id}`" @click="rollbackPlugin(plugin)">回滚</Button>
                  <Button size="sm" variant="destructive" :disabled="actionLoading === `remove:${plugin.id}`" @click="removePlugin(plugin)">删除</Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <div class="flex items-center justify-between text-sm text-muted-foreground">
      <div>共 {{ pagination.total }} 条记录</div>
      <div class="flex gap-2">
        <Button size="sm" variant="outline" :disabled="pagination.page <= 1" @click="fetchPlugins(pagination.page - 1)">上一页</Button>
        <Button size="sm" variant="outline" :disabled="pagination.page >= pagination.total_page" @click="fetchPlugins(pagination.page + 1)">下一页</Button>
      </div>
    </div>

    <Dialog v-model:open="detailOpen">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-6xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>插件详情</DialogTitle>
        </DialogHeader>
        <div v-if="detailLoading" class="py-10 text-center text-sm text-muted-foreground">正在加载插件详情...</div>
        <div v-else-if="detail" class="space-y-6">
          <div class="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle class="text-base">基础信息</CardTitle></CardHeader>
              <CardContent class="space-y-2 text-sm">
                <div><span class="text-muted-foreground">插件：</span>{{ detail.plugin.name }}（{{ detail.plugin.id }}）</div>
                <div><span class="text-muted-foreground">类型：</span>{{ typeLabel(detail.plugin.type) }}</div>
                <div><span class="text-muted-foreground">版本：</span>{{ activeVersion?.version || detail.plugin.current_version || '-' }}</div>
                <div><span class="text-muted-foreground">状态：</span>{{ statusLabel(detail.plugin.status) }}</div>
                <div><span class="text-muted-foreground">宿主协议：</span>{{ detail.plugin.host_api_version || '-' }}</div>
                <div><span class="text-muted-foreground">Go 版本：</span>{{ detail.plugin.go_version || '-' }}</div>
                <div><span class="text-muted-foreground">构建目标：</span>{{ detail.plugin.build_target || '-' }}</div>
                <div><span class="text-muted-foreground">入口符号：</span>{{ detail.plugin.entry_symbol || '-' }}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle class="text-base">权限与运行态</CardTitle></CardHeader>
              <CardContent class="space-y-2 text-sm">
                <div class="flex flex-wrap gap-2">
                  <Badge v-for="permission in detail.plugin.permissions || []" :key="permission" variant="outline">{{ permission }}</Badge>
                  <span v-if="!detail.plugin.permissions?.length" class="text-muted-foreground">未声明权限</span>
                </div>
                <div><span class="text-muted-foreground">运行时：</span>{{ detail.runtime_loaded ? '已加载' : '未加载' }}</div>
                <div><span class="text-muted-foreground">需要重载：</span>{{ detail.plugin.needs_restart ? '是' : '否' }}</div>
                <div v-if="detail.plugin.last_loaded_at"><span class="text-muted-foreground">最近加载：</span>{{ detail.plugin.last_loaded_at }}</div>
                <div v-if="detail.plugin.last_error" class="text-rose-500"><span class="text-muted-foreground">最近错误：</span>{{ detail.plugin.last_error }}</div>
                <div class="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" :disabled="applyingRuntime" @click="applyRuntimeChanges">应用运行时变更</Button>
                  <Button size="sm" variant="outline" :disabled="actionLoading === `enable:${detail.plugin.id}`" @click="enablePlugin(detail.plugin)">启用</Button>
                  <Button size="sm" variant="outline" :disabled="actionLoading === `disable:${detail.plugin.id}`" @click="disablePlugin(detail.plugin)">禁用</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle class="text-base">版本记录</CardTitle></CardHeader>
              <CardContent class="space-y-2 text-sm">
                <div v-for="version in detail.versions" :key="version.id" class="rounded-lg border p-3">
                  <div class="flex items-center justify-between gap-2">
                    <div class="font-medium">{{ version.version }}</div>
                    <Badge :variant="version.is_active ? 'default' : 'outline'">{{ version.is_active ? '当前生效' : statusLabel(version.status) }}</Badge>
                  </div>
                  <div class="mt-2 text-xs text-muted-foreground break-all">{{ version.install_path || version.package_path || '-' }}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle class="text-base">插件配置</CardTitle></CardHeader>
              <CardContent class="space-y-3">
                <div v-if="hasVisualConfigSchema" class="space-y-4">
                  <div class="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-950">
                    插件已声明 `config_schema`，当前优先使用可视化表单编辑；如需补充高级字段，可切换到原始 JSON。
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <Button size="sm" :variant="configMode === 'form' ? 'default' : 'outline'" @click="setConfigMode('form')">表单模式</Button>
                    <Button size="sm" :variant="configMode === 'json' ? 'default' : 'outline'" @click="setConfigMode('json')">原始 JSON</Button>
                  </div>

                  <div v-if="configMode === 'form'" class="grid gap-4">
                    <div v-for="field in pluginConfigFields" :key="field.key" class="space-y-2 rounded-lg border p-4">
                      <div class="space-y-1">
                        <Label :for="`plugin-config-${field.key}`">{{ field.label }}</Label>
                        <div class="text-xs text-muted-foreground">
                          <span>{{ field.key }}</span>
                          <span v-if="field.required"> · 必填</span>
                          <span v-if="field.description"> · {{ field.description }}</span>
                        </div>
                      </div>

                      <Input
                        v-if="field.type === 'string' && !field.multiline"
                        :id="`plugin-config-${field.key}`"
                        v-model="configFormValues[field.key]"
                        :placeholder="field.placeholder || `请输入 ${field.label}`"
                      />

                      <Textarea
                        v-else-if="field.type === 'text'"
                        :id="`plugin-config-${field.key}`"
                        v-model="configFormValues[field.key]"
                        :rows="field.rows"
                        :placeholder="field.placeholder || `请输入 ${field.label}`"
                      />

                      <Input
                        v-else-if="field.type === 'number'"
                        :id="`plugin-config-${field.key}`"
                        v-model="configFormValues[field.key]"
                        type="number"
                        :placeholder="field.placeholder || `请输入 ${field.label}`"
                      />

                      <Select
                        v-else-if="field.type === 'boolean'"
                        :model-value="booleanSelectValue(field.key)"
                        @update:model-value="(value) => { configFormValues[field.key] = value === 'true' }"
                      >
                        <SelectTrigger :id="`plugin-config-${field.key}`">
                          <SelectValue placeholder="请选择" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">开启 / true</SelectItem>
                          <SelectItem value="false">关闭 / false</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        v-else-if="field.type === 'select'"
                        :model-value="configFormValues[field.key]"
                        @update:model-value="(value) => { configFormValues[field.key] = value }"
                      >
                        <SelectTrigger :id="`plugin-config-${field.key}`">
                          <SelectValue :placeholder="field.placeholder || '请选择'" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="option in field.options" :key="`${field.key}-${option.selectValue}`" :value="option.selectValue">
                            {{ option.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Textarea
                        v-else
                        :id="`plugin-config-${field.key}`"
                        v-model="configFormValues[field.key]"
                        :rows="field.rows"
                        class="font-mono text-xs"
                        :placeholder="field.placeholder || `请输入 ${field.label} 的 JSON 值`"
                      />
                    </div>
                  </div>
                </div>

                <div v-if="!hasVisualConfigSchema || configMode === 'json'" class="space-y-3">
                  <div v-if="!hasVisualConfigSchema" class="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
                    插件未声明 `config_schema`，当前使用原始 JSON 编辑模式。
                  </div>
                  <Textarea v-model="configText" rows="14" class="font-mono text-xs" />
                </div>

                <div class="flex justify-end">
                  <Button :disabled="configSaving" @click="saveConfig">{{ configSaving ? '保存中...' : '保存配置' }}</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle class="text-base">运行日志</CardTitle></CardHeader>
              <CardContent class="space-y-3">
                <div v-if="runtimeLogs.length === 0" class="text-sm text-muted-foreground">暂无运行日志</div>
                <div v-for="log in runtimeLogs" :key="log.id" class="rounded-lg border p-3 text-sm">
                  <div class="flex items-center justify-between gap-3">
                    <div class="font-medium">{{ log.message }}</div>
                    <Badge variant="outline">{{ log.level }}</Badge>
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">{{ log.event_type }} · {{ log.created_at }}</div>
                  <pre class="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">{{ JSON.stringify(log.details || {}, null, 2) }}</pre>
                </div>
              </CardContent>
            </Card>
          </div>

          <div class="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle class="text-base">路由登记</CardTitle></CardHeader>
              <CardContent class="space-y-2 text-sm">
                <div v-if="detail.routes.length === 0" class="text-muted-foreground">暂无路由登记</div>
                <div v-for="item in detail.routes" :key="item.id" class="rounded-lg border p-3">
                  <div class="font-medium">{{ item.scope }} · {{ item.path }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">{{ (item.methods || []).join(' / ') || 'ANY' }}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle class="text-base">页面登记</CardTitle></CardHeader>
              <CardContent class="space-y-2 text-sm">
                <div v-if="detail.pages.length === 0" class="text-muted-foreground">暂无页面登记</div>
                <div v-for="item in detail.pages" :key="item.id" class="rounded-lg border p-3">
                  <div class="font-medium">{{ item.title || item.route_path }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">{{ item.scope }} · {{ item.route_path }}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle class="text-base">事件订阅</CardTitle></CardHeader>
              <CardContent class="space-y-2 text-sm">
                <div v-if="detail.events.length === 0" class="text-muted-foreground">暂无事件订阅</div>
                <div v-for="item in detail.events" :key="item.id" class="rounded-lg border p-3">
                  <div class="font-medium">{{ item.event_type }}</div>
                  <pre class="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">{{ JSON.stringify(item.meta || {}, null, 2) }}</pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
