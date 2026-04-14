<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { adminAPI } from '@/api/admin'
import type {
  AdminPluginLicense,
  AdminPluginLicenseDetail,
  AdminPluginLicenseSummary,
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

const loading = ref(false)
const saving = ref(false)
const detailLoading = ref(false)

const licenses = ref<AdminPluginLicenseSummary[]>([])
const detail = ref<AdminPluginLicenseDetail | null>(null)
const selectedLicenseID = ref('')
const dialogOpen = ref(false)
const editingLicenseID = ref('')
const pagination = ref({ page: 1, page_size: 20, total: 0, total_page: 1 })

const filters = reactive({
  keyword: '',
  plugin_id: '',
  status: '__all__',
  license_mode: '__all__',
})

const form = reactive({
  plugin_id: '',
  plan_code: '',
  customer_id: '0',
  order_id: '0',
  license_id: '',
  license_key: '',
  license_mode: 'annual',
  status: 'pending',
  bound_domain: '',
  bound_server_ip: '',
  expire_at: '',
  grace_deadline_at: '',
  feature_flags_text: '{}',
  meta_text: '{}',
})

const currentLicense = computed(() => detail.value?.license || null)

const normalizeSelectValue = (value: string) => (value === '__all__' ? '' : value)

const stringifyObject = (value: Record<string, unknown> | undefined) => JSON.stringify(value || {}, null, 2)

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

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : '-')

const statusBadgeVariant = (value?: string) => {
  switch (value) {
    case 'active':
      return 'default'
    case 'grace':
      return 'secondary'
    case 'revoked':
    case 'expired':
    case 'suspended':
    case 'mismatch':
      return 'destructive'
    default:
      return 'outline'
  }
}

const enforcementBadgeVariant = (value?: string) => {
  switch (value) {
    case 'ok':
      return 'default'
    case 'warn':
      return 'secondary'
    default:
      return 'destructive'
  }
}

const loadLicenses = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getPluginLicenseCenterLicenses({
      page,
      page_size: pagination.value.page_size,
      keyword: filters.keyword.trim() || undefined,
      plugin_id: filters.plugin_id.trim() || undefined,
      status: normalizeSelectValue(filters.status) || undefined,
      license_mode: normalizeSelectValue(filters.license_mode) || undefined,
    })
    licenses.value = response.data?.data || []
    pagination.value = response.data?.pagination || pagination.value
  } catch (error: any) {
    licenses.value = []
    notifyError(error?.response?.data?.msg || error?.message || '加载在线授权中心失败')
  } finally {
    loading.value = false
  }
}

const loadDetail = async (licenseID: string) => {
  if (!licenseID) return
  detailLoading.value = true
  selectedLicenseID.value = licenseID
  try {
    const response = await adminAPI.getPluginLicenseCenterLicense(licenseID)
    detail.value = response.data?.data || null
  } catch (error: any) {
    detail.value = null
    notifyError(error?.response?.data?.msg || error?.message || '加载授权详情失败')
  } finally {
    detailLoading.value = false
  }
}

const resetForm = () => {
  editingLicenseID.value = ''
  form.plugin_id = ''
  form.plan_code = ''
  form.customer_id = '0'
  form.order_id = '0'
  form.license_id = ''
  form.license_key = ''
  form.license_mode = 'annual'
  form.status = 'pending'
  form.bound_domain = ''
  form.bound_server_ip = ''
  form.expire_at = ''
  form.grace_deadline_at = ''
  form.feature_flags_text = '{}'
  form.meta_text = '{}'
}

const fillForm = (item: AdminPluginLicense) => {
  editingLicenseID.value = item.license_id
  form.plugin_id = item.plugin_id || ''
  form.plan_code = detail.value?.plan?.plan_code || ''
  form.customer_id = String(item.customer_id || 0)
  form.order_id = String(item.order_id || 0)
  form.license_id = item.license_id || ''
  form.license_key = item.license_key || ''
  form.license_mode = item.license_mode || 'annual'
  form.status = item.status || 'pending'
  form.bound_domain = item.bound_domain || ''
  form.bound_server_ip = item.bound_server_ip || ''
  form.expire_at = item.expire_at || ''
  form.grace_deadline_at = item.grace_deadline_at || ''
  form.feature_flags_text = stringifyObject(item.feature_flags)
  form.meta_text = stringifyObject(item.meta)
}

const openCreateDialog = () => {
  resetForm()
  dialogOpen.value = true
}

const openEditDialog = async (licenseID: string) => {
  if (!licenseID) return
  if (!detail.value || detail.value.license.license_id !== licenseID) {
    await loadDetail(licenseID)
  }
  if (!detail.value?.license) return
  resetForm()
  fillForm(detail.value.license)
  dialogOpen.value = true
}

const submitForm = async () => {
  if (!form.plugin_id.trim()) {
    notifyError('插件 ID 不能为空')
    return
  }
  saving.value = true
  try {
    const payload = {
      plugin_id: form.plugin_id.trim(),
      plan_code: form.plan_code.trim() || undefined,
      customer_id: Number(form.customer_id || '0'),
      order_id: Number(form.order_id || '0'),
      license_id: form.license_id.trim() || undefined,
      license_key: form.license_key.trim() || undefined,
      license_mode: form.license_mode,
      status: form.status,
      bound_domain: form.bound_domain.trim() || undefined,
      bound_server_ip: form.bound_server_ip.trim() || undefined,
      expire_at: form.expire_at.trim() || '',
      grace_deadline_at: form.grace_deadline_at.trim() || '',
      feature_flags: parseObjectText(form.feature_flags_text, '功能标记'),
      meta: parseObjectText(form.meta_text, '扩展元数据'),
    }
    if (editingLicenseID.value) {
      await adminAPI.updatePluginLicenseCenterLicense(editingLicenseID.value, payload)
      notifySuccess('插件授权已更新')
    } else {
      await adminAPI.createPluginLicenseCenterLicense(payload)
      notifySuccess('插件授权已创建')
    }
    dialogOpen.value = false
    await loadLicenses(pagination.value.page)
    if (selectedLicenseID.value) {
      await loadDetail(selectedLicenseID.value)
    }
  } catch (error: any) {
    notifyError(error?.response?.data?.msg || error?.message || '保存插件授权失败')
  } finally {
    saving.value = false
  }
}

const selectLicense = (item: AdminPluginLicenseSummary) => {
  if (item.license?.license_id) {
    loadDetail(item.license.license_id)
  }
}

onMounted(async () => {
  await loadLicenses()
  if (licenses.value[0]?.license?.license_id) {
    await loadDetail(licenses.value[0].license.license_id)
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">在线授权中心</h1>
        <p class="text-sm text-muted-foreground">管理插件许可证、绑定关系、激活实例与最近心跳。</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="loadLicenses(pagination.page)" :disabled="loading">刷新列表</Button>
        <Button @click="openCreateDialog">新增授权</Button>
      </div>
    </div>

    <Card>
      <CardHeader><CardTitle>授权筛选</CardTitle></CardHeader>
      <CardContent class="grid gap-3 md:grid-cols-4">
        <Input v-model="filters.keyword" placeholder="搜索授权 ID / License Key / 插件 ID / 域名" @keyup.enter="loadLicenses()" />
        <Input v-model="filters.plugin_id" placeholder="插件 ID，如 telegram-suite" @keyup.enter="loadLicenses()" />
        <Select v-model="filters.status">
          <SelectTrigger><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            <SelectItem value="pending">pending</SelectItem>
            <SelectItem value="active">active</SelectItem>
            <SelectItem value="grace">grace</SelectItem>
            <SelectItem value="expired">expired</SelectItem>
            <SelectItem value="revoked">revoked</SelectItem>
            <SelectItem value="suspended">suspended</SelectItem>
          </SelectContent>
        </Select>
        <div class="flex gap-2">
          <Select v-model="filters.license_mode">
            <SelectTrigger><SelectValue placeholder="全部授权模式" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部授权模式</SelectItem>
              <SelectItem value="free">free</SelectItem>
              <SelectItem value="annual">annual</SelectItem>
              <SelectItem value="perpetual">perpetual</SelectItem>
            </SelectContent>
          </Select>
          <Button class="shrink-0" @click="loadLicenses()">查询</Button>
        </div>
      </CardContent>
    </Card>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <Card>
        <CardHeader><CardTitle>授权列表</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>授权</TableHead>
                <TableHead>插件</TableHead>
                <TableHead>绑定</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>活跃实例</TableHead>
                <TableHead class="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading">
                <TableCell colspan="6" class="py-8 text-center text-muted-foreground">正在加载授权列表...</TableCell>
              </TableRow>
              <TableRow v-else-if="!licenses.length">
                <TableCell colspan="6" class="py-8 text-center text-muted-foreground">暂时还没有授权数据</TableCell>
              </TableRow>
              <TableRow
                v-for="item in licenses"
                :key="item.license.license_id"
                class="cursor-pointer"
                :class="selectedLicenseID === item.license.license_id ? 'bg-muted/50' : ''"
                @click="selectLicense(item)"
              >
                <TableCell>
                  <div class="font-medium">{{ item.license.license_id }}</div>
                  <div class="text-xs text-muted-foreground break-all">{{ item.license.license_key }}</div>
                </TableCell>
                <TableCell>
                  <div>{{ item.plugin?.name || item.license.plugin_id }}</div>
                  <div class="text-xs text-muted-foreground">{{ item.plan?.plan_code || '未指定方案' }}</div>
                </TableCell>
                <TableCell>
                  <div class="text-sm">{{ item.license.bound_domain || '-' }}</div>
                  <div class="text-xs text-muted-foreground">{{ item.license.bound_server_ip || '-' }}</div>
                </TableCell>
                <TableCell>
                  <Badge :variant="statusBadgeVariant(item.license.status)">{{ item.license.status }}</Badge>
                </TableCell>
                <TableCell>
                  <div class="text-sm">{{ item.active_activation?.install_id || '-' }}</div>
                  <div class="text-xs text-muted-foreground">{{ item.active_activation?.last_heartbeat_at ? formatDate(item.active_activation?.last_heartbeat_at) : '暂无心跳' }}</div>
                </TableCell>
                <TableCell class="text-right">
                  <Button size="sm" variant="outline" @click.stop="openEditDialog(item.license.license_id)">编辑</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div class="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {{ pagination.total }} 条，当前第 {{ pagination.page }} / {{ pagination.total_page || 1 }} 页</span>
            <div class="flex gap-2">
              <Button size="sm" variant="outline" :disabled="pagination.page <= 1 || loading" @click="loadLicenses(pagination.page - 1)">上一页</Button>
              <Button size="sm" variant="outline" :disabled="pagination.page >= pagination.total_page || loading" @click="loadLicenses(pagination.page + 1)">下一页</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between">
          <CardTitle>授权详情</CardTitle>
          <Button v-if="currentLicense" size="sm" variant="outline" @click="openEditDialog(currentLicense.license_id)">编辑当前授权</Button>
        </CardHeader>
        <CardContent class="space-y-6">
          <div v-if="detailLoading" class="py-10 text-center text-muted-foreground">正在加载授权详情...</div>
          <div v-else-if="!detail?.license" class="py-10 text-center text-muted-foreground">请选择一条授权查看详情</div>
          <template v-else>
            <div class="grid gap-3 md:grid-cols-2">
              <div><span class="text-muted-foreground">授权 ID：</span>{{ detail.license.license_id }}</div>
              <div><span class="text-muted-foreground">插件：</span>{{ detail.plugin?.name || detail.license.plugin_id }}</div>
              <div><span class="text-muted-foreground">License Key：</span><span class="break-all">{{ detail.license.license_key }}</span></div>
              <div><span class="text-muted-foreground">方案：</span>{{ detail.plan?.plan_name || detail.plan?.plan_code || '未指定方案' }}</div>
              <div><span class="text-muted-foreground">授权模式：</span>{{ detail.license.license_mode }}</div>
              <div><span class="text-muted-foreground">状态：</span><Badge :variant="statusBadgeVariant(detail.license.status)">{{ detail.license.status }}</Badge></div>
              <div><span class="text-muted-foreground">绑定域名：</span>{{ detail.license.bound_domain || '-' }}</div>
              <div><span class="text-muted-foreground">绑定 IP：</span>{{ detail.license.bound_server_ip || '-' }}</div>
              <div><span class="text-muted-foreground">签发时间：</span>{{ formatDate(detail.license.issued_at) }}</div>
              <div><span class="text-muted-foreground">激活时间：</span>{{ formatDate(detail.license.activated_at) }}</div>
              <div><span class="text-muted-foreground">到期时间：</span>{{ formatDate(detail.license.expire_at) }}</div>
              <div><span class="text-muted-foreground">最近校验：</span>{{ formatDate(detail.license.last_validated_at) }}</div>
            </div>

            <div class="space-y-3">
              <div class="text-sm font-medium">功能标记</div>
              <pre class="overflow-auto rounded-md bg-muted p-3 text-xs">{{ JSON.stringify(detail.license.feature_flags || {}, null, 2) }}</pre>
            </div>

            <div class="space-y-3">
              <div class="text-sm font-medium">激活实例</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>安装实例</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>绑定确认</TableHead>
                    <TableHead>最近心跳</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!detail.activations.length">
                    <TableCell colspan="4" class="py-6 text-center text-muted-foreground">暂无激活实例</TableCell>
                  </TableRow>
                  <TableRow v-for="item in detail.activations" :key="item.id">
                    <TableCell>
                      <div class="font-medium">{{ item.install_id || '-' }}</div>
                      <div class="text-xs text-muted-foreground">{{ item.reported_domain || '-' }} / {{ item.reported_ip || '-' }}</div>
                    </TableCell>
                    <TableCell><Badge :variant="statusBadgeVariant(item.status)">{{ item.status }}</Badge></TableCell>
                    <TableCell>
                      <div>{{ item.validated_domain || '-' }}</div>
                      <div class="text-xs text-muted-foreground">{{ item.validated_server_ip || '-' }}</div>
                    </TableCell>
                    <TableCell>{{ formatDate(item.last_heartbeat_at || item.last_seen_at) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div class="space-y-3">
              <div class="text-sm font-medium">最近心跳</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>上报</TableHead>
                    <TableHead>判定</TableHead>
                    <TableHead>动作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="!detail.recent_heartbeats.length">
                    <TableCell colspan="4" class="py-6 text-center text-muted-foreground">暂无心跳记录</TableCell>
                  </TableRow>
                  <TableRow v-for="item in detail.recent_heartbeats" :key="item.id">
                    <TableCell>{{ formatDate(item.created_at) }}</TableCell>
                    <TableCell>
                      <div>{{ item.reported_domain || '-' }}</div>
                      <div class="text-xs text-muted-foreground">{{ item.reported_ip || '-' }} / {{ item.reported_version || '-' }}</div>
                    </TableCell>
                    <TableCell>
                      <div><Badge :variant="statusBadgeVariant(item.license_status)">{{ item.license_status }}</Badge></div>
                      <div class="mt-1 text-xs text-muted-foreground">{{ item.message || '-' }}</div>
                    </TableCell>
                    <TableCell>
                      <div><Badge :variant="enforcementBadgeVariant(item.enforcement_action)">{{ item.enforcement_action }}</Badge></div>
                      <div class="mt-1 text-xs text-muted-foreground">域名 {{ item.matched_domain ? '匹配' : '不匹配' }} / IP {{ item.matched_server_ip ? '匹配' : '不匹配' }}</div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </template>
        </CardContent>
      </Card>
    </div>

    <Dialog v-model:open="dialogOpen">
      <DialogScrollContent class="sm:max-w-3xl">
        <DialogHeader><DialogTitle>{{ editingLicenseID ? '编辑插件授权' : '新增插件授权' }}</DialogTitle></DialogHeader>
        <div class="grid gap-4 py-2 md:grid-cols-2">
          <div class="space-y-2">
            <Label>插件 ID</Label>
            <Input v-model="form.plugin_id" placeholder="telegram-suite" />
          </div>
          <div class="space-y-2">
            <Label>方案代码</Label>
            <Input v-model="form.plan_code" placeholder="annual-basic / perpetual-basic" />
          </div>
          <div class="space-y-2">
            <Label>授权 ID</Label>
            <Input v-model="form.license_id" placeholder="留空自动生成" />
          </div>
          <div class="space-y-2">
            <Label>License Key</Label>
            <Input v-model="form.license_key" placeholder="留空自动生成" />
          </div>
          <div class="space-y-2">
            <Label>授权模式</Label>
            <Select v-model="form.license_mode">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">free</SelectItem>
                <SelectItem value="annual">annual</SelectItem>
                <SelectItem value="perpetual">perpetual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>授权状态</Label>
            <Select v-model="form.status">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="grace">grace</SelectItem>
                <SelectItem value="expired">expired</SelectItem>
                <SelectItem value="revoked">revoked</SelectItem>
                <SelectItem value="suspended">suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>客户 ID</Label>
            <Input v-model="form.customer_id" type="number" min="0" />
          </div>
          <div class="space-y-2">
            <Label>订单 ID</Label>
            <Input v-model="form.order_id" type="number" min="0" />
          </div>
          <div class="space-y-2">
            <Label>绑定域名</Label>
            <Input v-model="form.bound_domain" placeholder="shop.example.com" />
          </div>
          <div class="space-y-2">
            <Label>绑定服务器 IP</Label>
            <Input v-model="form.bound_server_ip" placeholder="1.2.3.4" />
          </div>
          <div class="space-y-2">
            <Label>到期时间（RFC3339）</Label>
            <Input v-model="form.expire_at" placeholder="2026-12-31T00:00:00Z" />
          </div>
          <div class="space-y-2">
            <Label>宽限截止时间（RFC3339）</Label>
            <Input v-model="form.grace_deadline_at" placeholder="2027-01-15T00:00:00Z" />
          </div>
          <div class="space-y-2 md:col-span-2">
            <Label>功能标记 JSON</Label>
            <Textarea v-model="form.feature_flags_text" rows="6" />
          </div>
          <div class="space-y-2 md:col-span-2">
            <Label>扩展元数据 JSON</Label>
            <Textarea v-model="form.meta_text" rows="6" />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" @click="dialogOpen = false" :disabled="saving">取消</Button>
          <Button @click="submitForm" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</Button>
        </div>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
