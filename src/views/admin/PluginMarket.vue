<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { adminAPI } from '@/api/admin'
import type { AdminPluginMarketItem, AdminPluginRegistry } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogScrollContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { notifyError, notifySuccess } from '@/utils/notify'

const loading = ref(false)
const refreshing = ref(false)
const registries = ref<AdminPluginRegistry[]>([])
const items = ref<AdminPluginMarketItem[]>([])
const pagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailItem = ref<AdminPluginMarketItem | null>(null)
const detailVersions = ref<AdminPluginMarketItem[]>([])
const installLoading = ref('')
const filters = reactive({ registry_id: '__all__', keyword: '', type: '__all__' })

const normalizeSelectValue = (value: string) => (value === '__all__' ? '' : value)

const loadRegistries = async () => {
  try {
    const response = await adminAPI.getPluginRegistries()
    registries.value = response.data?.data || []
  } catch (err: any) {
    registries.value = []
    notifyError(err?.response?.data?.msg || err?.message || '加载插件库失败')
  }
}

const fetchItems = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getPluginMarketItems({
      page,
      page_size: pagination.value.page_size,
      registry_id: normalizeSelectValue(filters.registry_id) || undefined,
      keyword: filters.keyword.trim() || undefined,
      type: normalizeSelectValue(filters.type) || undefined,
    })
    items.value = response.data?.data || []
    pagination.value = response.data?.pagination || pagination.value
  } catch (err: any) {
    items.value = []
    notifyError(err?.response?.data?.msg || err?.message || '加载在线插件失败')
  } finally {
    loading.value = false
  }
}

const refreshMarket = async () => {
  refreshing.value = true
  try {
    await adminAPI.refreshPluginMarket()
    notifySuccess('在线插件库已刷新')
    await Promise.all([loadRegistries(), fetchItems(1)])
  } catch (err: any) {
    notifyError(err?.response?.data?.msg || err?.message || '刷新在线插件库失败')
  } finally {
    refreshing.value = false
  }
}

const openDetail = async (item: AdminPluginMarketItem) => {
  detailLoading.value = true
  try {
    const response = await adminAPI.getPluginMarketItem(item.plugin_id, { registry_id: item.registry_id })
    detailItem.value = response.data?.data?.item || null
    detailVersions.value = response.data?.data?.versions || []
    detailOpen.value = true
  } catch (err: any) {
    notifyError(err?.response?.data?.msg || err?.message || '加载插件详情失败')
  } finally {
    detailLoading.value = false
  }
}

const installItem = async (item: AdminPluginMarketItem, version?: string) => {
  const versionValue = version || item.version
  installLoading.value = `${item.registry_id}:${item.plugin_id}:${versionValue}`
  try {
    await adminAPI.installPluginMarketItem(item.plugin_id, { registry_id: item.registry_id, version: versionValue })
    notifySuccess('插件已导入并安装完成')
  } catch (err: any) {
    notifyError(err?.response?.data?.msg || err?.message || '在线安装失败')
  } finally {
    installLoading.value = ''
  }
}

const typeLabel = (value?: string) => {
  const map: Record<string, string> = { theme: '模板', payment: '支付', feature: '功能' }
  return map[value || ''] || value || '-'
}

onMounted(async () => {
  await loadRegistries()
  await fetchItems(1)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">在线插件库</h1>
        <p class="text-sm text-muted-foreground">浏览官方库与公共市场中的插件元数据，并一键导入到当前系统。</p>
      </div>
      <Button variant="outline" :disabled="refreshing" @click="refreshMarket">{{ refreshing ? '刷新中...' : '刷新插件库' }}</Button>
    </div>

    <Card>
      <CardHeader><CardTitle>注册表状态</CardTitle></CardHeader>
      <CardContent class="grid gap-3 lg:grid-cols-2">
        <div v-for="registry in registries" :key="registry.id" class="rounded-xl border p-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <div class="font-medium">{{ registry.name }}</div>
            <Badge :variant="registry.last_sync_status === 'ok' ? 'default' : 'outline'">{{ registry.last_sync_status || 'idle' }}</Badge>
          </div>
          <div class="mt-2 text-muted-foreground">{{ registry.description }}</div>
          <div class="mt-2 text-xs text-muted-foreground">最近同步：{{ registry.last_sync_at || '未同步' }}</div>
          <div class="mt-1 text-xs text-muted-foreground">{{ registry.last_sync_message || '-' }}</div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>筛选条件</CardTitle></CardHeader>
      <CardContent class="flex flex-col gap-3 lg:flex-row">
        <Select v-model="filters.registry_id" @update:modelValue="fetchItems(1)">
          <SelectTrigger class="w-full lg:w-52"><SelectValue placeholder="全部来源" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部来源</SelectItem>
            <SelectItem v-for="registry in registries" :key="registry.id" :value="registry.id">{{ registry.name }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="filters.type" @update:modelValue="fetchItems(1)">
          <SelectTrigger class="w-full lg:w-40"><SelectValue placeholder="全部类型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部类型</SelectItem>
            <SelectItem value="theme">模板</SelectItem>
            <SelectItem value="payment">支付</SelectItem>
            <SelectItem value="feature">功能</SelectItem>
          </SelectContent>
        </Select>
        <Input v-model="filters.keyword" placeholder="按插件 ID / 名称 / 作者搜索" @keyup.enter="fetchItems(1)" />
        <Button @click="fetchItems(1)">搜索</Button>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>插件</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>版本</TableHead>
              <TableHead>审核</TableHead>
              <TableHead class="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell colspan="6" class="py-8 text-center text-muted-foreground">正在加载在线插件列表...</TableCell>
            </TableRow>
            <TableRow v-else-if="items.length === 0">
              <TableCell colspan="6" class="py-8 text-center text-muted-foreground">在线插件库暂时没有数据</TableCell>
            </TableRow>
            <TableRow v-for="item in items" :key="`${item.registry_id}-${item.plugin_id}-${item.version}`">
              <TableCell>
                <div class="space-y-1">
                  <div class="font-medium">{{ item.name }}</div>
                  <div class="text-xs text-muted-foreground">{{ item.plugin_id }}</div>
                  <div class="text-xs text-muted-foreground">作者：{{ item.author || '-' }}</div>
                </div>
              </TableCell>
              <TableCell>{{ registries.find((registry) => registry.id === item.registry_id)?.name || item.registry_id }}</TableCell>
              <TableCell>{{ typeLabel(item.type) }}</TableCell>
              <TableCell>{{ item.version }}</TableCell>
              <TableCell><Badge variant="outline">{{ item.review_status || 'approved' }}</Badge></TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-2">
                  <Button size="sm" variant="outline" @click="openDetail(item)">详情</Button>
                  <Button size="sm" :disabled="installLoading === `${item.registry_id}:${item.plugin_id}:${item.version}`" @click="installItem(item)">安装</Button>
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
        <Button size="sm" variant="outline" :disabled="pagination.page <= 1" @click="fetchItems(pagination.page - 1)">上一页</Button>
        <Button size="sm" variant="outline" :disabled="pagination.page >= pagination.total_page" @click="fetchItems(pagination.page + 1)">下一页</Button>
      </div>
    </div>

    <Dialog v-model:open="detailOpen">
      <DialogScrollContent class="w-[calc(100vw-1rem)] max-w-5xl p-4 sm:p-6">
        <DialogHeader><DialogTitle>在线插件详情</DialogTitle></DialogHeader>
        <div v-if="detailLoading" class="py-10 text-center text-sm text-muted-foreground">正在加载插件详情...</div>
        <div v-else-if="detailItem" class="space-y-6">
          <div class="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle class="text-base">基础信息</CardTitle></CardHeader>
              <CardContent class="space-y-2 text-sm">
                <div><span class="text-muted-foreground">插件：</span>{{ detailItem.name }}（{{ detailItem.plugin_id }}）</div>
                <div><span class="text-muted-foreground">作者：</span>{{ detailItem.author || '-' }}</div>
                <div><span class="text-muted-foreground">类型：</span>{{ typeLabel(detailItem.type) }}</div>
                <div><span class="text-muted-foreground">版本：</span>{{ detailItem.version }}</div>
                <div><span class="text-muted-foreground">宿主协议：</span>{{ detailItem.host_api_version || '-' }}</div>
                <div><span class="text-muted-foreground">Go 版本：</span>{{ detailItem.go_version || '-' }}</div>
                <div><span class="text-muted-foreground">构建目标：</span>{{ detailItem.build_target || '-' }}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle class="text-base">权限与校验</CardTitle></CardHeader>
              <CardContent class="space-y-2 text-sm">
                <div class="flex flex-wrap gap-2">
                  <Badge v-for="permission in detailItem.permissions || []" :key="permission" variant="outline">{{ permission }}</Badge>
                  <span v-if="!detailItem.permissions?.length" class="text-muted-foreground">未声明权限</span>
                </div>
                <div><span class="text-muted-foreground">审核状态：</span>{{ detailItem.review_status || 'approved' }}</div>
                <div class="break-all"><span class="text-muted-foreground">SHA256：</span>{{ detailItem.checksum || '-' }}</div>
                <div class="break-all"><span class="text-muted-foreground">下载地址：</span>{{ detailItem.download_url || '-' }}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle class="text-base">安装操作</CardTitle></CardHeader>
              <CardContent class="space-y-3 text-sm">
                <div class="text-muted-foreground">在线安装会下载插件包、执行结构校验、初始化插件独立数据库，并写入本地插件中心。</div>
                <Button :disabled="installLoading === `${detailItem.registry_id}:${detailItem.plugin_id}:${detailItem.version}`" @click="installItem(detailItem)">安装当前版本</Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle class="text-base">版本列表</CardTitle></CardHeader>
            <CardContent class="space-y-3">
              <div v-for="version in detailVersions" :key="`${version.registry_id}-${version.plugin_id}-${version.version}`" class="rounded-lg border p-4 text-sm">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div class="font-medium">{{ version.version }}</div>
                    <div class="text-xs text-muted-foreground">{{ version.summary || version.description || '暂无说明' }}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <Badge variant="outline">{{ version.review_status || 'approved' }}</Badge>
                    <Button size="sm" :disabled="installLoading === `${version.registry_id}:${version.plugin_id}:${version.version}`" @click="installItem(version, version.version)">安装此版本</Button>
                  </div>
                </div>
                <div v-if="version.changelog" class="mt-3 rounded bg-muted p-3 text-xs whitespace-pre-wrap">{{ version.changelog }}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
