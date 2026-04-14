<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { adminAPI } from '@/api/admin'
import type {
  AdminOnlinePluginDetail,
  AdminOnlinePluginPlan,
  AdminOnlinePluginPublisher,
  AdminOnlinePluginSummary,
  AdminOnlinePluginVersion,
} from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { notifyError, notifySuccess } from '@/utils/notify'

const publisherLoading = ref(false)
const pluginLoading = ref(false)
const detailLoading = ref(false)
const saving = ref(false)
const deletingKey = ref('')

const publishers = ref<AdminOnlinePluginPublisher[]>([])
const plugins = ref<AdminOnlinePluginSummary[]>([])
const detail = ref<AdminOnlinePluginDetail | null>(null)
const selectedPluginID = ref('')
const pagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })

const filters = reactive({
  keyword: '',
  status: '__all__',
  plugin_type: '__all__',
  billing_mode: '__all__',
  publisher_id: '__all__',
})

const publisherDialogOpen = ref(false)
const pluginDialogOpen = ref(false)
const versionDialogOpen = ref(false)
const planDialogOpen = ref(false)

const editingPublisherID = ref<number | null>(null)
const editingPluginID = ref<string>('')
const editingVersionID = ref<number | null>(null)
const editingPlanID = ref<number | null>(null)

const publisherForm = reactive({
  publisher_code: '',
  name: '',
  contact_email: '',
  status: 'active',
  is_official: false,
  meta_text: '{}',
})

const pluginForm = reactive({
  plugin_id: '',
  slug: '',
  publisher_id: '',
  name: '',
  summary: '',
  description: '',
  plugin_type: 'feature',
  billing_mode: 'free',
  license_mode: 'free',
  status: 'draft',
  is_official: false,
  is_public: true,
  icon_url: '',
  cover_url: '',
  homepage_url: '',
  source_url: '',
  tags_text: '',
  meta_text: '{}',
})

const versionForm = reactive({
  version: '',
  release_channel: 'stable',
  package_storage_key: '',
  package_download_url: '',
  checksum_sha256: '',
  package_size_bytes: '0',
  host_api_version: '',
  build_target: '',
  go_version: '',
  permissions_text: '',
  config_schema_text: '{}',
  changelog_md: '',
  review_status: 'draft',
  published_at: '',
  meta_text: '{}',
})

const planForm = reactive({
  plan_code: '',
  plan_name: '',
  billing_mode: 'free',
  license_mode: 'free',
  price_amount: '0',
  price_currency: 'CNY',
  duration_days: '',
  max_sites: '1',
  max_activations: '1',
  status: 'active',
  sort_order: '0',
  feature_flags_text: '{}',
  meta_text: '{}',
})

const currentPlugin = computed(() => detail.value?.plugin || null)

const normalizeSelectValue = (value: string) => (value === '__all__' ? '' : value)

const parseObjectText = (text: string, label: string) => {
  const raw = text.trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label}必须是 JSON 对象`)
    }
    return parsed as Record<string, unknown>
  } catch (error: any) {
    throw new Error(error?.message || `${label}解析失败`)
  }
}

const parseStringList = (text: string) =>
  text
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)

const stringifyObject = (value: Record<string, unknown> | undefined) => JSON.stringify(value || {}, null, 2)

const stringifyStringList = (value: string[] | undefined) => (value || []).join('\n')

const loadPublishers = async () => {
  publisherLoading.value = true
  try {
    const response = await adminAPI.getPluginMarketCenterPublishers()
    publishers.value = response.data?.data || []
  } catch (error: any) {
    publishers.value = []
    notifyError(error?.response?.data?.msg || error?.message || '加载发布者失败')
  } finally {
    publisherLoading.value = false
  }
}

const loadPlugins = async (page = 1) => {
  pluginLoading.value = true
  try {
    const response = await adminAPI.getPluginMarketCenterPlugins({
      page,
      page_size: pagination.value.page_size,
      keyword: filters.keyword.trim() || undefined,
      status: normalizeSelectValue(filters.status) || undefined,
      plugin_type: normalizeSelectValue(filters.plugin_type) || undefined,
      billing_mode: normalizeSelectValue(filters.billing_mode) || undefined,
      publisher_id: normalizeSelectValue(filters.publisher_id) || undefined,
    })
    plugins.value = response.data?.data || []
    pagination.value = response.data?.pagination || pagination.value
  } catch (error: any) {
    plugins.value = []
    notifyError(error?.response?.data?.msg || error?.message || '加载在线插件中心失败')
  } finally {
    pluginLoading.value = false
  }
}

const loadDetail = async (pluginID: string) => {
  if (!pluginID) return
  detailLoading.value = true
  selectedPluginID.value = pluginID
  try {
    const response = await adminAPI.getPluginMarketCenterPlugin(pluginID)
    detail.value = response.data?.data || null
  } catch (error: any) {
    detail.value = null
    notifyError(error?.response?.data?.msg || error?.message || '加载插件详情失败')
  } finally {
    detailLoading.value = false
  }
}

const resetPublisherForm = () => {
  editingPublisherID.value = null
  publisherForm.publisher_code = ''
  publisherForm.name = ''
  publisherForm.contact_email = ''
  publisherForm.status = 'active'
  publisherForm.is_official = false
  publisherForm.meta_text = '{}'
}

const openPublisherDialog = (item?: AdminOnlinePluginPublisher) => {
  resetPublisherForm()
  if (item) {
    editingPublisherID.value = item.id
    publisherForm.publisher_code = item.publisher_code
    publisherForm.name = item.name
    publisherForm.contact_email = item.contact_email || ''
    publisherForm.status = item.status || 'active'
    publisherForm.is_official = !!item.is_official
    publisherForm.meta_text = stringifyObject(item.meta)
  }
  publisherDialogOpen.value = true
}

const submitPublisher = async () => {
  saving.value = true
  try {
    const payload = {
      publisher_code: publisherForm.publisher_code,
      name: publisherForm.name,
      contact_email: publisherForm.contact_email,
      status: publisherForm.status,
      is_official: publisherForm.is_official,
      meta: parseObjectText(publisherForm.meta_text, '发布者 Meta'),
    }
    if (editingPublisherID.value) {
      await adminAPI.updatePluginMarketCenterPublisher(editingPublisherID.value, payload)
      notifySuccess('发布者已更新')
    } else {
      await adminAPI.createPluginMarketCenterPublisher(payload)
      notifySuccess('发布者已创建')
    }
    publisherDialogOpen.value = false
    await Promise.all([loadPublishers(), loadPlugins(pagination.value.page)])
  } catch (error: any) {
    notifyError(error?.response?.data?.msg || error?.message || '保存发布者失败')
  } finally {
    saving.value = false
  }
}

const deletePublisher = async (item: AdminOnlinePluginPublisher) => {
  if (!window.confirm(`确认删除发布者「${item.name}」吗？`)) return
  deletingKey.value = `publisher:${item.id}`
  try {
    await adminAPI.deletePluginMarketCenterPublisher(item.id)
    notifySuccess('发布者已删除')
    await Promise.all([loadPublishers(), loadPlugins(pagination.value.page)])
  } catch (error: any) {
    notifyError(error?.response?.data?.msg || error?.message || '删除发布者失败')
  } finally {
    deletingKey.value = ''
  }
}

const resetPluginForm = () => {
  editingPluginID.value = ''
  pluginForm.plugin_id = ''
  pluginForm.slug = ''
  pluginForm.publisher_id = publishers.value[0] ? String(publishers.value[0].id) : ''
  pluginForm.name = ''
  pluginForm.summary = ''
  pluginForm.description = ''
  pluginForm.plugin_type = 'feature'
  pluginForm.billing_mode = 'free'
  pluginForm.license_mode = 'free'
  pluginForm.status = 'draft'
  pluginForm.is_official = false
  pluginForm.is_public = true
  pluginForm.icon_url = ''
  pluginForm.cover_url = ''
  pluginForm.homepage_url = ''
  pluginForm.source_url = ''
  pluginForm.tags_text = ''
  pluginForm.meta_text = '{}'
}

const openPluginDialog = (item?: AdminOnlinePluginSummary | AdminOnlinePluginDetail | null) => {
  resetPluginForm()
  const plugin = item && 'plugin' in item ? item.plugin : null
  if (plugin) {
    editingPluginID.value = plugin.plugin_id
    pluginForm.plugin_id = plugin.plugin_id
    pluginForm.slug = plugin.slug
    pluginForm.publisher_id = String(plugin.publisher_id)
    pluginForm.name = plugin.name
    pluginForm.summary = plugin.summary || ''
    pluginForm.description = plugin.description || ''
    pluginForm.plugin_type = plugin.plugin_type || 'feature'
    pluginForm.billing_mode = plugin.billing_mode || 'free'
    pluginForm.license_mode = plugin.license_mode || 'free'
    pluginForm.status = plugin.status || 'draft'
    pluginForm.is_official = !!plugin.is_official
    pluginForm.is_public = !!plugin.is_public
    pluginForm.icon_url = plugin.icon_url || ''
    pluginForm.cover_url = plugin.cover_url || ''
    pluginForm.homepage_url = plugin.homepage_url || ''
    pluginForm.source_url = plugin.source_url || ''
    pluginForm.tags_text = stringifyStringList(plugin.tags)
    pluginForm.meta_text = stringifyObject(plugin.meta)
  }
  pluginDialogOpen.value = true
}

const submitPlugin = async () => {
  saving.value = true
  try {
    const payload = {
      plugin_id: pluginForm.plugin_id,
      slug: pluginForm.slug,
      publisher_id: Number(pluginForm.publisher_id || 0),
      name: pluginForm.name,
      summary: pluginForm.summary,
      description: pluginForm.description,
      plugin_type: pluginForm.plugin_type,
      billing_mode: pluginForm.billing_mode,
      license_mode: pluginForm.license_mode,
      status: pluginForm.status,
      is_official: pluginForm.is_official,
      is_public: pluginForm.is_public,
      icon_url: pluginForm.icon_url,
      cover_url: pluginForm.cover_url,
      homepage_url: pluginForm.homepage_url,
      source_url: pluginForm.source_url,
      tags: parseStringList(pluginForm.tags_text),
      meta: parseObjectText(pluginForm.meta_text, '插件 Meta'),
    }
    const targetPluginID = editingPluginID.value || payload.plugin_id
    if (editingPluginID.value) {
      await adminAPI.updatePluginMarketCenterPlugin(editingPluginID.value, payload)
      notifySuccess('在线插件已更新')
    } else {
      await adminAPI.createPluginMarketCenterPlugin(payload)
      notifySuccess('在线插件已创建')
    }
    pluginDialogOpen.value = false
    await Promise.all([loadPublishers(), loadPlugins(editingPluginID.value ? pagination.value.page : 1)])
    await loadDetail(targetPluginID)
  } catch (error: any) {
    notifyError(error?.response?.data?.msg || error?.message || '保存在线插件失败')
  } finally {
    saving.value = false
  }
}

const deletePlugin = async (item: AdminOnlinePluginSummary | AdminOnlinePluginDetail) => {
  const plugin = item.plugin
  if (!window.confirm(`确认删除插件「${plugin.name}」吗？版本与套餐也会一起删除。`)) return
  deletingKey.value = `plugin:${plugin.plugin_id}`
  try {
    await adminAPI.deletePluginMarketCenterPlugin(plugin.plugin_id)
    notifySuccess('在线插件已删除')
    if (selectedPluginID.value === plugin.plugin_id) {
      detail.value = null
      selectedPluginID.value = ''
    }
    await loadPlugins(pagination.value.page)
  } catch (error: any) {
    notifyError(error?.response?.data?.msg || error?.message || '删除在线插件失败')
  } finally {
    deletingKey.value = ''
  }
}

const resetVersionForm = () => {
  editingVersionID.value = null
  versionForm.version = ''
  versionForm.release_channel = 'stable'
  versionForm.package_storage_key = ''
  versionForm.package_download_url = ''
  versionForm.checksum_sha256 = ''
  versionForm.package_size_bytes = '0'
  versionForm.host_api_version = ''
  versionForm.build_target = ''
  versionForm.go_version = ''
  versionForm.permissions_text = ''
  versionForm.config_schema_text = '{}'
  versionForm.changelog_md = ''
  versionForm.review_status = 'draft'
  versionForm.published_at = ''
  versionForm.meta_text = '{}'
}

const openVersionDialog = (item?: AdminOnlinePluginVersion) => {
  if (!currentPlugin.value) {
    notifyError('请先选择一个插件')
    return
  }
  resetVersionForm()
  if (item) {
    editingVersionID.value = item.id
    versionForm.version = item.version
    versionForm.release_channel = item.release_channel || 'stable'
    versionForm.package_storage_key = item.package_storage_key || ''
    versionForm.package_download_url = item.package_download_url || ''
    versionForm.checksum_sha256 = item.checksum_sha256 || ''
    versionForm.package_size_bytes = String(item.package_size_bytes || 0)
    versionForm.host_api_version = item.host_api_version || ''
    versionForm.build_target = item.build_target || ''
    versionForm.go_version = item.go_version || ''
    versionForm.permissions_text = stringifyStringList(item.permissions)
    versionForm.config_schema_text = stringifyObject(item.config_schema)
    versionForm.changelog_md = item.changelog_md || ''
    versionForm.review_status = item.review_status || 'draft'
    versionForm.published_at = item.published_at || ''
    versionForm.meta_text = stringifyObject(item.meta)
  }
  versionDialogOpen.value = true
}

const submitVersion = async () => {
  if (!currentPlugin.value) return
  saving.value = true
  try {
    const payload = {
      version: versionForm.version,
      release_channel: versionForm.release_channel,
      package_storage_key: versionForm.package_storage_key,
      package_download_url: versionForm.package_download_url,
      checksum_sha256: versionForm.checksum_sha256,
      package_size_bytes: Number(versionForm.package_size_bytes || 0),
      host_api_version: versionForm.host_api_version,
      build_target: versionForm.build_target,
      go_version: versionForm.go_version,
      permissions: parseStringList(versionForm.permissions_text),
      config_schema: parseObjectText(versionForm.config_schema_text, '版本配置 Schema'),
      changelog_md: versionForm.changelog_md,
      review_status: versionForm.review_status,
      published_at: versionForm.published_at.trim() || undefined,
      meta: parseObjectText(versionForm.meta_text, '版本 Meta'),
    }
    if (editingVersionID.value) {
      await adminAPI.updatePluginMarketCenterVersion(editingVersionID.value, payload)
      notifySuccess('版本已更新')
    } else {
      await adminAPI.createPluginMarketCenterVersion(currentPlugin.value.plugin_id, payload)
      notifySuccess('版本已创建')
    }
    versionDialogOpen.value = false
    await Promise.all([loadDetail(currentPlugin.value.plugin_id), loadPlugins(pagination.value.page)])
  } catch (error: any) {
    notifyError(error?.response?.data?.msg || error?.message || '保存版本失败')
  } finally {
    saving.value = false
  }
}

const deleteVersion = async (item: AdminOnlinePluginVersion) => {
  if (!currentPlugin.value || !window.confirm(`确认删除版本「${item.version}」吗？`)) return
  deletingKey.value = `version:${item.id}`
  try {
    await adminAPI.deletePluginMarketCenterVersion(item.id)
    notifySuccess('版本已删除')
    await Promise.all([loadDetail(currentPlugin.value.plugin_id), loadPlugins(pagination.value.page)])
  } catch (error: any) {
    notifyError(error?.response?.data?.msg || error?.message || '删除版本失败')
  } finally {
    deletingKey.value = ''
  }
}

const resetPlanForm = () => {
  editingPlanID.value = null
  planForm.plan_code = ''
  planForm.plan_name = ''
  planForm.billing_mode = 'free'
  planForm.license_mode = 'free'
  planForm.price_amount = '0'
  planForm.price_currency = 'CNY'
  planForm.duration_days = ''
  planForm.max_sites = '1'
  planForm.max_activations = '1'
  planForm.status = 'active'
  planForm.sort_order = '0'
  planForm.feature_flags_text = '{}'
  planForm.meta_text = '{}'
}

const openPlanDialog = (item?: AdminOnlinePluginPlan) => {
  if (!currentPlugin.value) {
    notifyError('请先选择一个插件')
    return
  }
  resetPlanForm()
  if (item) {
    editingPlanID.value = item.id
    planForm.plan_code = item.plan_code
    planForm.plan_name = item.plan_name
    planForm.billing_mode = item.billing_mode || 'free'
    planForm.license_mode = item.license_mode || 'free'
    planForm.price_amount = item.price_amount || '0'
    planForm.price_currency = item.price_currency || 'CNY'
    planForm.duration_days = item.duration_days ? String(item.duration_days) : ''
    planForm.max_sites = String(item.max_sites || 1)
    planForm.max_activations = String(item.max_activations || 1)
    planForm.status = item.status || 'active'
    planForm.sort_order = String(item.sort_order || 0)
    planForm.feature_flags_text = stringifyObject(item.feature_flags)
    planForm.meta_text = stringifyObject(item.meta)
  }
  planDialogOpen.value = true
}

const submitPlan = async () => {
  if (!currentPlugin.value) return
  saving.value = true
  try {
    const payload = {
      plan_code: planForm.plan_code,
      plan_name: planForm.plan_name,
      billing_mode: planForm.billing_mode,
      license_mode: planForm.license_mode,
      price_amount: planForm.price_amount,
      price_currency: planForm.price_currency,
      duration_days: planForm.duration_days.trim() ? Number(planForm.duration_days) : undefined,
      max_sites: Number(planForm.max_sites || 1),
      max_activations: Number(planForm.max_activations || 1),
      status: planForm.status,
      sort_order: Number(planForm.sort_order || 0),
      feature_flags: parseObjectText(planForm.feature_flags_text, '套餐功能标记'),
      meta: parseObjectText(planForm.meta_text, '套餐 Meta'),
    }
    if (editingPlanID.value) {
      await adminAPI.updatePluginMarketCenterPlan(editingPlanID.value, payload)
      notifySuccess('套餐已更新')
    } else {
      await adminAPI.createPluginMarketCenterPlan(currentPlugin.value.plugin_id, payload)
      notifySuccess('套餐已创建')
    }
    planDialogOpen.value = false
    await loadDetail(currentPlugin.value.plugin_id)
  } catch (error: any) {
    notifyError(error?.response?.data?.msg || error?.message || '保存套餐失败')
  } finally {
    saving.value = false
  }
}

const deletePlan = async (item: AdminOnlinePluginPlan) => {
  if (!currentPlugin.value || !window.confirm(`确认删除套餐「${item.plan_name}」吗？`)) return
  deletingKey.value = `plan:${item.id}`
  try {
    await adminAPI.deletePluginMarketCenterPlan(item.id)
    notifySuccess('套餐已删除')
    await loadDetail(currentPlugin.value.plugin_id)
  } catch (error: any) {
    notifyError(error?.response?.data?.msg || error?.message || '删除套餐失败')
  } finally {
    deletingKey.value = ''
  }
}

const publisherName = (summary: AdminOnlinePluginSummary) => summary.publisher?.name || '-'
const statusBadgeVariant = (value?: string) => (value === 'published' || value === 'active' ? 'default' : 'outline')

onMounted(async () => {
  await loadPublishers()
  await loadPlugins(1)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">在线插件中心</h1>
        <p class="text-sm text-muted-foreground">管理官方插件市场的发布者、插件主记录、版本包与收费套餐，为后续 `app.vipmax.shop` 与 `key.vipmax.shop` 打底。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" @click="openPublisherDialog()">新增发布者</Button>
        <Button @click="openPluginDialog()">新增插件</Button>
      </div>
    </div>

    <Card>
      <CardHeader class="flex flex-row items-center justify-between">
        <CardTitle>发布者</CardTitle>
        <div class="text-sm text-muted-foreground">共 {{ publishers.length }} 个</div>
      </CardHeader>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>编码</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>联系邮箱</TableHead>
              <TableHead>状态</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="publisherLoading">
              <TableCell colspan="5" class="py-6 text-center text-muted-foreground">正在加载发布者...</TableCell>
            </TableRow>
            <TableRow v-else-if="publishers.length === 0">
              <TableCell colspan="5" class="py-6 text-center text-muted-foreground">还没有发布者，先创建一个官方或第三方发布者。</TableCell>
            </TableRow>
            <TableRow v-for="item in publishers" :key="item.id">
              <TableCell>{{ item.publisher_code }}</TableCell>
              <TableCell>
                <div class="flex items-center gap-2">
                  <span>{{ item.name }}</span>
                  <Badge v-if="item.is_official">官方</Badge>
                </div>
              </TableCell>
              <TableCell>{{ item.contact_email || '-' }}</TableCell>
              <TableCell><Badge :variant="statusBadgeVariant(item.status)">{{ item.status }}</Badge></TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-2">
                  <Button size="sm" variant="outline" @click="openPublisherDialog(item)">编辑</Button>
                  <Button size="sm" variant="outline" :disabled="deletingKey === `publisher:${item.id}`" @click="deletePublisher(item)">删除</Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>插件筛选</CardTitle></CardHeader>
      <CardContent class="grid gap-3 lg:grid-cols-5">
        <Input v-model="filters.keyword" placeholder="按插件 ID / 名称 / slug 搜索" @keyup.enter="loadPlugins(1)" />
        <Select v-model="filters.publisher_id" @update:modelValue="loadPlugins(1)">
          <SelectTrigger><SelectValue placeholder="全部发布者" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部发布者</SelectItem>
            <SelectItem v-for="item in publishers" :key="item.id" :value="String(item.id)">{{ item.name }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="filters.status" @update:modelValue="loadPlugins(1)">
          <SelectTrigger><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="pending_review">待审核</SelectItem>
            <SelectItem value="published">已发布</SelectItem>
            <SelectItem value="hidden">隐藏</SelectItem>
            <SelectItem value="archived">归档</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="filters.plugin_type" @update:modelValue="loadPlugins(1)">
          <SelectTrigger><SelectValue placeholder="全部类型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部类型</SelectItem>
            <SelectItem value="feature">功能</SelectItem>
            <SelectItem value="payment">支付</SelectItem>
            <SelectItem value="theme">模板</SelectItem>
          </SelectContent>
        </Select>
        <div class="flex gap-2">
          <Select v-model="filters.billing_mode" @update:modelValue="loadPlugins(1)">
            <SelectTrigger><SelectValue placeholder="全部计费" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部计费</SelectItem>
              <SelectItem value="free">免费</SelectItem>
              <SelectItem value="annual">年付</SelectItem>
              <SelectItem value="perpetual">买断</SelectItem>
            </SelectContent>
          </Select>
          <Button @click="loadPlugins(1)">搜索</Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="flex flex-row items-center justify-between">
        <CardTitle>插件列表</CardTitle>
        <div class="text-sm text-muted-foreground">共 {{ pagination.total }} 条记录</div>
      </CardHeader>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>插件</TableHead>
              <TableHead>发布者</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>计费</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最新版本</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="pluginLoading">
              <TableCell colspan="7" class="py-8 text-center text-muted-foreground">正在加载插件...</TableCell>
            </TableRow>
            <TableRow v-else-if="plugins.length === 0">
              <TableCell colspan="7" class="py-8 text-center text-muted-foreground">还没有插件数据，先新增一个插件主记录。</TableCell>
            </TableRow>
            <TableRow
              v-for="item in plugins"
              :key="item.plugin.plugin_id"
              class="cursor-pointer"
              :class="selectedPluginID === item.plugin.plugin_id ? 'bg-muted/40' : ''"
              @click="loadDetail(item.plugin.plugin_id)"
            >
              <TableCell>
                <div class="space-y-1">
                  <div class="font-medium">{{ item.plugin.name }}</div>
                  <div class="text-xs text-muted-foreground">{{ item.plugin.plugin_id }}</div>
                </div>
              </TableCell>
              <TableCell>{{ publisherName(item) }}</TableCell>
              <TableCell>{{ item.plugin.plugin_type }}</TableCell>
              <TableCell>{{ item.plugin.billing_mode }}</TableCell>
              <TableCell>
                <div class="flex items-center gap-2">
                  <Badge :variant="statusBadgeVariant(item.plugin.status)">{{ item.plugin.status }}</Badge>
                  <Badge v-if="item.plugin.is_official" variant="outline">官方</Badge>
                  <Badge v-if="item.plugin.is_public" variant="outline">公开</Badge>
                </div>
              </TableCell>
              <TableCell>{{ item.latest_version?.version || '-' }}</TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-2">
                  <Button size="sm" variant="outline" @click.stop="openPluginDialog(item)">编辑</Button>
                  <Button size="sm" variant="outline" :disabled="deletingKey === `plugin:${item.plugin.plugin_id}`" @click.stop="deletePlugin(item)">删除</Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <div class="flex items-center justify-between text-sm text-muted-foreground">
      <div>当前第 {{ pagination.page }} / {{ pagination.total_page }} 页</div>
      <div class="flex gap-2">
        <Button size="sm" variant="outline" :disabled="pagination.page <= 1" @click="loadPlugins(pagination.page - 1)">上一页</Button>
        <Button size="sm" variant="outline" :disabled="pagination.page >= pagination.total_page" @click="loadPlugins(pagination.page + 1)">下一页</Button>
      </div>
    </div>

    <Card v-if="selectedPluginID">
      <CardHeader class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>插件详情</CardTitle>
          <p class="mt-1 text-sm text-muted-foreground">{{ currentPlugin?.name || selectedPluginID }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" @click="openPluginDialog(detail)">编辑插件</Button>
          <Button variant="outline" @click="openVersionDialog()">新增版本</Button>
          <Button variant="outline" @click="openPlanDialog()">新增套餐</Button>
        </div>
      </CardHeader>
      <CardContent v-if="detailLoading" class="py-10 text-center text-sm text-muted-foreground">正在加载详情...</CardContent>
      <CardContent v-else-if="detail" class="space-y-6">
        <div class="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle class="text-base">基础信息</CardTitle></CardHeader>
            <CardContent class="space-y-2 text-sm">
              <div><span class="text-muted-foreground">插件 ID：</span>{{ detail.plugin.plugin_id }}</div>
              <div><span class="text-muted-foreground">Slug：</span>{{ detail.plugin.slug }}</div>
              <div><span class="text-muted-foreground">发布者：</span>{{ detail.publisher?.name || '-' }}</div>
              <div><span class="text-muted-foreground">类型：</span>{{ detail.plugin.plugin_type }}</div>
              <div><span class="text-muted-foreground">计费：</span>{{ detail.plugin.billing_mode }}</div>
              <div><span class="text-muted-foreground">授权：</span>{{ detail.plugin.license_mode }}</div>
              <div><span class="text-muted-foreground">状态：</span>{{ detail.plugin.status }}</div>
              <div class="text-muted-foreground">摘要：{{ detail.plugin.summary || '暂无摘要' }}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle class="text-base">对外展示</CardTitle></CardHeader>
            <CardContent class="space-y-2 text-sm">
              <div><span class="text-muted-foreground">首页：</span>{{ detail.plugin.homepage_url || '-' }}</div>
              <div><span class="text-muted-foreground">源码：</span>{{ detail.plugin.source_url || '-' }}</div>
              <div><span class="text-muted-foreground">图标：</span>{{ detail.plugin.icon_url || '-' }}</div>
              <div><span class="text-muted-foreground">封面：</span>{{ detail.plugin.cover_url || '-' }}</div>
              <div class="flex flex-wrap gap-2">
                <Badge v-for="tag in detail.plugin.tags || []" :key="tag" variant="outline">{{ tag }}</Badge>
                <span v-if="!detail.plugin.tags?.length" class="text-muted-foreground">无标签</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle class="text-base">当前发布态</CardTitle></CardHeader>
            <CardContent class="space-y-2 text-sm">
              <div><span class="text-muted-foreground">最新版本：</span>{{ detail.latest_version?.version || '-' }}</div>
              <div><span class="text-muted-foreground">公开市场：</span>{{ detail.plugin.is_public ? '是' : '否' }}</div>
              <div><span class="text-muted-foreground">官方插件：</span>{{ detail.plugin.is_official ? '是' : '否' }}</div>
              <div><span class="text-muted-foreground">版本数：</span>{{ detail.versions.length }}</div>
              <div><span class="text-muted-foreground">套餐数：</span>{{ detail.plans.length }}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle class="text-base">版本</CardTitle></CardHeader>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>版本</TableHead>
                  <TableHead>渠道</TableHead>
                  <TableHead>审核</TableHead>
                  <TableHead>下载地址</TableHead>
                  <TableHead class="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="detail.versions.length === 0">
                  <TableCell colspan="5" class="py-6 text-center text-muted-foreground">还没有版本记录</TableCell>
                </TableRow>
                <TableRow v-for="item in detail.versions" :key="item.id">
                  <TableCell>{{ item.version }}</TableCell>
                  <TableCell>{{ item.release_channel }}</TableCell>
                  <TableCell><Badge :variant="statusBadgeVariant(item.review_status)">{{ item.review_status }}</Badge></TableCell>
                  <TableCell class="max-w-[420px] truncate">{{ item.package_download_url || '-' }}</TableCell>
                  <TableCell class="text-right">
                    <div class="flex justify-end gap-2">
                      <Button size="sm" variant="outline" @click="openVersionDialog(item)">编辑</Button>
                      <Button size="sm" variant="outline" :disabled="deletingKey === `version:${item.id}`" @click="deleteVersion(item)">删除</Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle class="text-base">套餐</CardTitle></CardHeader>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>套餐</TableHead>
                  <TableHead>计费</TableHead>
                  <TableHead>价格</TableHead>
                  <TableHead>授权限制</TableHead>
                  <TableHead class="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="detail.plans.length === 0">
                  <TableCell colspan="5" class="py-6 text-center text-muted-foreground">还没有套餐记录</TableCell>
                </TableRow>
                <TableRow v-for="item in detail.plans" :key="item.id">
                  <TableCell>
                    <div class="space-y-1">
                      <div class="font-medium">{{ item.plan_name }}</div>
                      <div class="text-xs text-muted-foreground">{{ item.plan_code }}</div>
                    </div>
                  </TableCell>
                  <TableCell>{{ item.billing_mode }}</TableCell>
                  <TableCell>{{ item.price_amount }} {{ item.price_currency }}</TableCell>
                  <TableCell>站点 {{ item.max_sites }} / 激活 {{ item.max_activations }}</TableCell>
                  <TableCell class="text-right">
                    <div class="flex justify-end gap-2">
                      <Button size="sm" variant="outline" @click="openPlanDialog(item)">编辑</Button>
                      <Button size="sm" variant="outline" :disabled="deletingKey === `plan:${item.id}`" @click="deletePlan(item)">删除</Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </CardContent>
    </Card>

    <Dialog v-model:open="publisherDialogOpen">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-2xl p-4 sm:p-6">
        <DialogHeader><DialogTitle>{{ editingPublisherID ? '编辑发布者' : '新增发布者' }}</DialogTitle></DialogHeader>
        <div class="grid gap-4">
          <div class="grid gap-2">
            <Label>发布者编码</Label>
            <Input v-model="publisherForm.publisher_code" placeholder="official-team" />
          </div>
          <div class="grid gap-2">
            <Label>名称</Label>
            <Input v-model="publisherForm.name" placeholder="官方团队" />
          </div>
          <div class="grid gap-2">
            <Label>联系邮箱</Label>
            <Input v-model="publisherForm.contact_email" placeholder="team@example.com" />
          </div>
          <div class="grid gap-2">
            <Label>状态</Label>
            <Select v-model="publisherForm.status">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="disabled">disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="publisherForm.is_official" type="checkbox" />
            标记为官方发布者
          </label>
          <div class="grid gap-2">
            <Label>Meta JSON</Label>
            <Textarea v-model="publisherForm.meta_text" rows="8" class="font-mono text-xs" />
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="publisherDialogOpen = false">取消</Button>
            <Button :disabled="saving" @click="submitPublisher">{{ saving ? '保存中...' : '保存' }}</Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>

    <Dialog v-model:open="pluginDialogOpen">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-4xl p-4 sm:p-6">
        <DialogHeader><DialogTitle>{{ editingPluginID ? '编辑在线插件' : '新增在线插件' }}</DialogTitle></DialogHeader>
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="grid gap-2">
            <Label>插件 ID</Label>
            <Input v-model="pluginForm.plugin_id" placeholder="telegram-suite" />
          </div>
          <div class="grid gap-2">
            <Label>Slug</Label>
            <Input v-model="pluginForm.slug" placeholder="telegram-suite" />
          </div>
          <div class="grid gap-2">
            <Label>发布者</Label>
            <Select v-model="pluginForm.publisher_id">
              <SelectTrigger><SelectValue placeholder="选择发布者" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="item in publishers" :key="item.id" :value="String(item.id)">{{ item.name }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>名称</Label>
            <Input v-model="pluginForm.name" placeholder="Telegram Suite" />
          </div>
          <div class="grid gap-2">
            <Label>插件类型</Label>
            <Select v-model="pluginForm.plugin_type">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="feature">feature</SelectItem>
                <SelectItem value="payment">payment</SelectItem>
                <SelectItem value="theme">theme</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>状态</Label>
            <Select v-model="pluginForm.status">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="pending_review">pending_review</SelectItem>
                <SelectItem value="published">published</SelectItem>
                <SelectItem value="hidden">hidden</SelectItem>
                <SelectItem value="archived">archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>计费模式</Label>
            <Select v-model="pluginForm.billing_mode">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">free</SelectItem>
                <SelectItem value="annual">annual</SelectItem>
                <SelectItem value="perpetual">perpetual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>授权模式</Label>
            <Select v-model="pluginForm.license_mode">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">free</SelectItem>
                <SelectItem value="annual">annual</SelectItem>
                <SelectItem value="perpetual">perpetual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>摘要</Label>
            <Textarea v-model="pluginForm.summary" rows="2" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>描述</Label>
            <Textarea v-model="pluginForm.description" rows="4" />
          </div>
          <div class="grid gap-2">
            <Label>图标 URL</Label>
            <Input v-model="pluginForm.icon_url" />
          </div>
          <div class="grid gap-2">
            <Label>封面 URL</Label>
            <Input v-model="pluginForm.cover_url" />
          </div>
          <div class="grid gap-2">
            <Label>首页 URL</Label>
            <Input v-model="pluginForm.homepage_url" />
          </div>
          <div class="grid gap-2">
            <Label>源码 URL</Label>
            <Input v-model="pluginForm.source_url" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>标签（逗号或换行分隔）</Label>
            <Textarea v-model="pluginForm.tags_text" rows="3" />
          </div>
          <div class="flex flex-wrap gap-4 lg:col-span-2 text-sm">
            <label class="flex items-center gap-2">
              <input v-model="pluginForm.is_official" type="checkbox" />
              官方插件
            </label>
            <label class="flex items-center gap-2">
              <input v-model="pluginForm.is_public" type="checkbox" />
              公开展示
            </label>
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>Meta JSON</Label>
            <Textarea v-model="pluginForm.meta_text" rows="8" class="font-mono text-xs" />
          </div>
          <div class="flex justify-end gap-2 lg:col-span-2">
            <Button variant="outline" @click="pluginDialogOpen = false">取消</Button>
            <Button :disabled="saving" @click="submitPlugin">{{ saving ? '保存中...' : '保存' }}</Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>

    <Dialog v-model:open="versionDialogOpen">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-4xl p-4 sm:p-6">
        <DialogHeader><DialogTitle>{{ editingVersionID ? '编辑版本' : '新增版本' }}</DialogTitle></DialogHeader>
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="grid gap-2">
            <Label>版本号</Label>
            <Input v-model="versionForm.version" placeholder="1.0.0" />
          </div>
          <div class="grid gap-2">
            <Label>发布渠道</Label>
            <Select v-model="versionForm.release_channel">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stable">stable</SelectItem>
                <SelectItem value="beta">beta</SelectItem>
                <SelectItem value="alpha">alpha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>宿主协议版本</Label>
            <Input v-model="versionForm.host_api_version" placeholder="v1" />
          </div>
          <div class="grid gap-2">
            <Label>构建目标</Label>
            <Input v-model="versionForm.build_target" placeholder="linux-amd64" />
          </div>
          <div class="grid gap-2">
            <Label>Go 版本</Label>
            <Input v-model="versionForm.go_version" placeholder="go1.24.0" />
          </div>
          <div class="grid gap-2">
            <Label>包大小（字节）</Label>
            <Input v-model="versionForm.package_size_bytes" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>下载地址</Label>
            <Input v-model="versionForm.package_download_url" placeholder="https://app.vipmax.shop/packages/telegram-suite-1.0.0.zip" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>存储键</Label>
            <Input v-model="versionForm.package_storage_key" placeholder="packages/telegram-suite/1.0.0.zip" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>SHA256</Label>
            <Input v-model="versionForm.checksum_sha256" placeholder="sha256 值" />
          </div>
          <div class="grid gap-2">
            <Label>审核状态</Label>
            <Select v-model="versionForm.review_status">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="pending_review">pending_review</SelectItem>
                <SelectItem value="approved">approved</SelectItem>
                <SelectItem value="rejected">rejected</SelectItem>
                <SelectItem value="published">published</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>发布时间（RFC3339）</Label>
            <Input v-model="versionForm.published_at" placeholder="2026-04-13T18:00:00Z" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>权限声明（逗号或换行分隔）</Label>
            <Textarea v-model="versionForm.permissions_text" rows="3" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>配置 Schema JSON</Label>
            <Textarea v-model="versionForm.config_schema_text" rows="8" class="font-mono text-xs" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>更新日志</Label>
            <Textarea v-model="versionForm.changelog_md" rows="5" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>Meta JSON</Label>
            <Textarea v-model="versionForm.meta_text" rows="8" class="font-mono text-xs" />
          </div>
          <div class="flex justify-end gap-2 lg:col-span-2">
            <Button variant="outline" @click="versionDialogOpen = false">取消</Button>
            <Button :disabled="saving" @click="submitVersion">{{ saving ? '保存中...' : '保存' }}</Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>

    <Dialog v-model:open="planDialogOpen">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-3xl p-4 sm:p-6">
        <DialogHeader><DialogTitle>{{ editingPlanID ? '编辑套餐' : '新增套餐' }}</DialogTitle></DialogHeader>
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="grid gap-2">
            <Label>套餐编码</Label>
            <Input v-model="planForm.plan_code" placeholder="annual-basic" />
          </div>
          <div class="grid gap-2">
            <Label>套餐名称</Label>
            <Input v-model="planForm.plan_name" placeholder="年付基础版" />
          </div>
          <div class="grid gap-2">
            <Label>计费模式</Label>
            <Select v-model="planForm.billing_mode">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">free</SelectItem>
                <SelectItem value="annual">annual</SelectItem>
                <SelectItem value="perpetual">perpetual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>授权模式</Label>
            <Select v-model="planForm.license_mode">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">free</SelectItem>
                <SelectItem value="annual">annual</SelectItem>
                <SelectItem value="perpetual">perpetual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>价格</Label>
            <Input v-model="planForm.price_amount" placeholder="99.00" />
          </div>
          <div class="grid gap-2">
            <Label>币种</Label>
            <Input v-model="planForm.price_currency" placeholder="CNY" />
          </div>
          <div class="grid gap-2">
            <Label>有效天数</Label>
            <Input v-model="planForm.duration_days" placeholder="365，买断可留空" />
          </div>
          <div class="grid gap-2">
            <Label>状态</Label>
            <Select v-model="planForm.status">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="disabled">disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>最大站点数</Label>
            <Input v-model="planForm.max_sites" />
          </div>
          <div class="grid gap-2">
            <Label>最大激活数</Label>
            <Input v-model="planForm.max_activations" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>排序值</Label>
            <Input v-model="planForm.sort_order" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>功能标记 JSON</Label>
            <Textarea v-model="planForm.feature_flags_text" rows="8" class="font-mono text-xs" />
          </div>
          <div class="grid gap-2 lg:col-span-2">
            <Label>Meta JSON</Label>
            <Textarea v-model="planForm.meta_text" rows="8" class="font-mono text-xs" />
          </div>
          <div class="flex justify-end gap-2 lg:col-span-2">
            <Button variant="outline" @click="planDialogOpen = false">取消</Button>
            <Button :disabled="saving" @click="submitPlan">{{ saving ? '保存中...' : '保存' }}</Button>
          </div>
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
