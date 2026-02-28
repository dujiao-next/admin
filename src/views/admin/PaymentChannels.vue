<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import IdCell from '@/components/IdCell.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogScrollContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { confirmAction } from '@/utils/confirm'

const loading = ref(true)
const channels = ref<any[]>([])
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0,
  total_page: 1,
})
const jumpPage = ref('')
const filters = reactive({
  providerType: '__all__',
  channelType: '__all__',
})
const normalizeFilterValue = (value: string) => (value === '__all__' ? '' : value)

const route = useRoute()
const showModal = ref(false)
const isEditing = ref(false)
const error = ref('')
const editingId = ref<number | null>(null)
const showAdvanced = ref(false)
const { t } = useI18n()
const configJsonPlaceholder = '{ "key": "value" }'
const form = reactive({
  name: '',
  provider_type: 'epay',
  channel_type: 'alipay',
  interaction_mode: 'qr',
  fee_rate: '0',
  config_json: '',
  is_active: true,
  sort_order: 10,
})
const epayConfig = reactive({
  epay_version: 'v2',
  gateway_url: '',
  merchant_id: '',
  merchant_key: '',
  private_key: '',
  platform_public_key: '',
  notify_url: '',
  return_url: '',
})

const paypalConfig = reactive({
  client_id: '',
  client_secret: '',
  base_url: 'https://api-m.sandbox.paypal.com',
  return_url: '',
  cancel_url: '',
  webhook_id: '',
  brand_name: '',
  locale: '',
})

const stripeConfig = reactive({
  secret_key: '',
  publishable_key: '',
  webhook_secret: '',
  success_url: '',
  cancel_url: '',
  api_base_url: 'https://api.stripe.com',
  payment_method_types: 'card',
})

const alipayConfig = reactive({
  app_id: '',
  private_key: '',
  alipay_public_key: '',
  gateway_url: 'https://openapi.alipay.com/gateway.do',
  notify_url: '',
  return_url: '',
  sign_type: 'RSA2',
  app_cert_sn: '',
  alipay_root_cert_sn: '',
})

const wechatConfig = reactive({
  appid: '',
  mchid: '',
  merchant_serial_no: '',
  merchant_private_key: '',
  api_v3_key: '',
  notify_url: '',
  h5_redirect_url: '',
  h5_type: 'WAP',
  h5_wap_url: '',
  h5_wap_name: '',
})

const epusdtConfig = reactive({
  gateway_url: '',
  auth_token: '',
  trade_type: 'usdt.trc20',
  fiat: 'CNY',
  notify_url: '',
  return_url: '',
})

const tokenpayConfig = reactive({
  gateway_url: '',
  notify_secret: '',
  currency: '',
  notify_url: '',
  redirect_url: '',
  base_currency: 'CNY',
})

const epayChannelOptions = [
  { value: 'wechat', label: 'admin.paymentChannels.channelTypes.wechat' },
  { value: 'alipay', label: 'admin.paymentChannels.channelTypes.alipay' },
  { value: 'qqpay', label: 'admin.paymentChannels.channelTypes.qqpay' },
]

const officialChannelOptions = [
  { value: 'paypal', label: 'admin.paymentChannels.channelTypes.paypal' },
  { value: 'stripe', label: 'admin.paymentChannels.channelTypes.stripe' },
  { value: 'alipay', label: 'admin.paymentChannels.channelTypes.alipay' },
  { value: 'wechat', label: 'admin.paymentChannels.channelTypes.wechat' },
]

const epusdtChannelOptions = [
  { value: 'usdt-trc20', label: 'admin.paymentChannels.channelTypes.usdtTrc20' },
  { value: 'usdc-trc20', label: 'admin.paymentChannels.channelTypes.usdcTrc20' },
  { value: 'trx', label: 'admin.paymentChannels.channelTypes.trx' },
]

const channelOptions = [
  ...epayChannelOptions,
  ...officialChannelOptions,
]

const formChannelOptions = computed(() => {
  if (form.provider_type === 'epay') {
    return epayChannelOptions
  }
  if (form.provider_type === 'official') {
    return officialChannelOptions
  }
  if (form.provider_type === 'epusdt') {
    return epusdtChannelOptions
  }
  return channelOptions
})

const interactionModeOptions = computed(() => {
  if (form.provider_type === 'epay') {
    return [
      { value: 'qr', label: 'admin.paymentChannels.interactionModes.qr' },
      { value: 'redirect', label: 'admin.paymentChannels.interactionModes.redirect' },
    ]
  }
  if (form.provider_type === 'epusdt') {
    return [
      { value: 'redirect', label: 'admin.paymentChannels.interactionModes.redirect' },
    ]
  }
  if (form.provider_type === 'tokenpay') {
    return [
      { value: 'qr', label: 'admin.paymentChannels.interactionModes.qr' },
      { value: 'redirect', label: 'admin.paymentChannels.interactionModes.redirect' },
    ]
  }
  if (form.provider_type === 'official' && form.channel_type === 'paypal') {
    return [{ value: 'redirect', label: 'admin.paymentChannels.interactionModes.redirect' }]
  }
  if (form.provider_type === 'official' && form.channel_type === 'stripe') {
    return [{ value: 'redirect', label: 'admin.paymentChannels.interactionModes.redirect' }]
  }
  if (form.provider_type === 'official' && form.channel_type === 'alipay') {
    return [
      { value: 'qr', label: 'admin.paymentChannels.interactionModes.qr' },
      { value: 'wap', label: 'admin.paymentChannels.interactionModes.wap' },
      { value: 'page', label: 'admin.paymentChannels.interactionModes.page' },
    ]
  }
  if (form.provider_type === 'official' && form.channel_type === 'wechat') {
    return [
      { value: 'qr', label: 'admin.paymentChannels.interactionModes.qr' },
      { value: 'redirect', label: 'admin.paymentChannels.interactionModes.redirect' },
    ]
  }
  return [
    { value: 'qr', label: 'admin.paymentChannels.interactionModes.qr' },
    { value: 'redirect', label: 'admin.paymentChannels.interactionModes.redirect' },
  ]
})

const fetchChannels = async (page = 1) => {
  loading.value = true
  try {
    const response = await adminAPI.getPaymentChannels({
      page,
      page_size: pagination.value.page_size,
      provider_type: normalizeFilterValue(filters.providerType) || undefined,
      channel_type: normalizeFilterValue(filters.channelType) || undefined,
    })
    channels.value = (response.data.data as any[]) || []
    pagination.value = response.data.pagination || pagination.value
  } catch (error) {
    channels.value = []
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  fetchChannels(1)
}

const refresh = () => {
  fetchChannels(pagination.value.page)
}

const changePage = (page: number) => {
  if (page < 1 || page > pagination.value.total_page) return
  fetchChannels(page)
}

const jumpToPage = () => {
  if (!jumpPage.value) return
  const raw = Number(jumpPage.value)
  if (Number.isNaN(raw)) return
  const target = Math.min(Math.max(Math.floor(raw), 1), pagination.value.total_page)
  if (target === pagination.value.page) return
  changePage(target)
}

const providerTypeLabel = (value?: string) => {
  const map: Record<string, string> = {
    official: t('admin.paymentChannels.providerTypes.official'),
    epay: t('admin.paymentChannels.providerTypes.epay'),
    epusdt: t('admin.paymentChannels.providerTypes.epusdt'),
    tokenpay: t('admin.paymentChannels.providerTypes.tokenpay'),
  }
  return map[value || ''] || value || '-'
}

const channelTypeLabel = (value?: string) => {
  const map: Record<string, string> = {
    wechat: t('admin.paymentChannels.channelTypes.wechat'),
    alipay: t('admin.paymentChannels.channelTypes.alipay'),
    qqpay: t('admin.paymentChannels.channelTypes.qqpay'),
    paypal: t('admin.paymentChannels.channelTypes.paypal'),
    stripe: t('admin.paymentChannels.channelTypes.stripe'),
    usdt: t('admin.paymentChannels.channelTypes.usdt'),
    'usdt-trc20': t('admin.paymentChannels.channelTypes.usdtTrc20'),
    'usdc-trc20': t('admin.paymentChannels.channelTypes.usdcTrc20'),
    trx: t('admin.paymentChannels.channelTypes.trx'),
  }
  return map[value || ''] || value || '-'
}

const interactionModeLabel = (value?: string) => {
  const map: Record<string, string> = {
    qr: t('admin.paymentChannels.interactionModes.qr'),
    redirect: t('admin.paymentChannels.interactionModes.redirect'),
    wap: t('admin.paymentChannels.interactionModes.wap'),
    page: t('admin.paymentChannels.interactionModes.page'),
  }
  return map[value || ''] || value || '-'
}

const formatFeeRate = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return '-'
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return '-'
  return `${parsed.toFixed(2)}%`
}

const openCreateModal = () => {
  isEditing.value = false
  editingId.value = null
  error.value = ''
  form.name = ''
  form.provider_type = 'epay'
  form.channel_type = 'alipay'
  form.interaction_mode = 'qr'
  form.fee_rate = '0'
  form.config_json = ''
  form.is_active = true
  form.sort_order = 10
  showAdvanced.value = false
  resetEpayConfig()
  resetPaypalConfig()
  resetStripeConfig()
  resetAlipayConfig()
  resetWechatConfig()
  resetEpusdtConfig()
  resetTokenpayConfig()
  showModal.value = true
}

const openEditModal = (channel: any) => {
  isEditing.value = true
  editingId.value = channel.id
  error.value = ''
  form.name = channel.name
  form.provider_type = channel.provider_type
  form.channel_type = channel.channel_type
  form.interaction_mode = channel.interaction_mode
  form.fee_rate = channel.fee_rate !== undefined && channel.fee_rate !== null ? String(channel.fee_rate) : '0'
  form.config_json = channel.config_json ? JSON.stringify(channel.config_json, null, 2) : ''
  form.is_active = !!channel.is_active
  form.sort_order = channel.sort_order || 0
  showAdvanced.value = false
  if (channel.config_json && typeof channel.config_json === 'object') {
    applyEpayConfig(channel.config_json)
    applyPaypalConfig(channel.config_json)
    applyStripeConfig(channel.config_json)
    applyAlipayConfig(channel.config_json)
    applyWechatConfig(channel.config_json)
    applyEpusdtConfig(channel.config_json)
    applyTokenpayConfig(channel.config_json)
  } else {
    resetEpayConfig()
    resetPaypalConfig()
    resetStripeConfig()
    resetAlipayConfig()
    resetWechatConfig()
    resetEpusdtConfig()
    resetTokenpayConfig()
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const handleSubmit = async () => {
  error.value = ''
  let configJson: Record<string, any> = {}
  if (form.config_json && form.config_json.trim() !== '') {
    try {
      const parsed = JSON.parse(form.config_json)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        configJson = parsed
      }
    } catch (err) {
      error.value = t('admin.paymentChannels.errors.invalidConfig')
      return
    }
  }

  if (form.provider_type === 'epay') {
    if (epayConfig.epay_version === 'v1') {
      delete configJson.private_key
      delete configJson.platform_public_key
    } else {
      delete configJson.merchant_key
    }
    configJson = {
      ...configJson,
      ...buildEpayConfig(),
    }
  } else if (form.provider_type === 'official' && form.channel_type === 'paypal') {
    configJson = {
      ...configJson,
      ...buildPaypalConfig(),
    }
  } else if (form.provider_type === 'official' && form.channel_type === 'stripe') {
    configJson = {
      ...configJson,
      ...buildStripeConfig(),
    }
  } else if (form.provider_type === 'official' && form.channel_type === 'alipay') {
    configJson = {
      ...configJson,
      ...buildAlipayConfig(),
    }
  } else if (form.provider_type === 'official' && form.channel_type === 'wechat') {
    configJson = {
      ...configJson,
      ...buildWechatConfig(),
    }
  } else if (form.provider_type === 'epusdt') {
    configJson = {
      ...configJson,
      ...buildEpusdtConfig(),
    }
  } else if (form.provider_type === 'tokenpay') {
    configJson = {
      ...configJson,
      ...buildTokenpayConfig(),
    }
  }

  const payload = {
    name: form.name,
    provider_type: form.provider_type,
    channel_type:
      form.provider_type === 'tokenpay'
        ? 'usdt'
        : form.provider_type === 'epusdt'
          ? 'usdt-trc20'
          : form.channel_type,
    interaction_mode: form.interaction_mode,
    fee_rate: String(form.fee_rate || '0').trim(),
    config_json: configJson,
    is_active: form.is_active,
    sort_order: form.sort_order,
  }

  if (isEditing.value && editingId.value) {
    await adminAPI.updatePaymentChannel(editingId.value, payload)
  } else {
    await adminAPI.createPaymentChannel(payload)
  }
  closeModal()
  fetchChannels(pagination.value.page)
}

const handleDelete = async (channel: any) => {
  const confirmed = await confirmAction({ description: t('admin.paymentChannels.confirmDelete', { name: channel.name }), confirmText: t('admin.common.delete'), variant: 'destructive' })
  if (!confirmed) return
  await adminAPI.deletePaymentChannel(channel.id)
  fetchChannels(pagination.value.page)
}

onMounted(() => {
  fetchChannels()
  openEditById(route.query.channel_id)
})

watch(
  () => route.query.channel_id,
  (value) => {
    if (value) {
      openEditById(value)
    }
  }
)

const pickDefaultInteractionMode = () => {
  const options = interactionModeOptions.value
  if (options.length === 0) {
    return 'qr'
  }
  return options[0]?.value || 'qr'
}

watch(
  () => form.provider_type,
  (value) => {
    if (value === 'epay') {
      const allowed = epayChannelOptions.map((option) => option.value)
      if (!allowed.includes(form.channel_type)) {
        form.channel_type = allowed[0] || 'wechat'
      }
    } else if (value === 'official') {
      const allowed = officialChannelOptions.map((option) => option.value)
      if (!allowed.includes(form.channel_type)) {
        form.channel_type = allowed[0] || 'paypal'
      }
    } else if (value === 'epusdt') {
      const allowed = epusdtChannelOptions.map((option) => option.value)
      if (!allowed.includes(form.channel_type)) {
        form.channel_type = allowed[0] || 'usdt-trc20'
      }
    } else if (value === 'tokenpay') {
      form.channel_type = 'usdt'
    }
    form.interaction_mode = pickDefaultInteractionMode()
  }
)

watch(
  () => form.channel_type,
  () => {
    const allowed = interactionModeOptions.value.map((item) => item.value)
    if (!allowed.includes(form.interaction_mode)) {
      form.interaction_mode = pickDefaultInteractionMode()
    }
    
  }
)

const resetEpayConfig = () => {
  epayConfig.epay_version = 'v2'
  epayConfig.gateway_url = ''
  epayConfig.merchant_id = ''
  epayConfig.merchant_key = ''
  epayConfig.private_key = ''
  epayConfig.platform_public_key = ''
  epayConfig.notify_url = ''
  epayConfig.return_url = ''
}

const applyEpayConfig = (raw: Record<string, any>) => {
  const version = String(raw.epay_version || '').toLowerCase()
  epayConfig.epay_version = version === 'v1' ? 'v1' : 'v2'
  epayConfig.gateway_url = String(raw.gateway_url || '')
  epayConfig.merchant_id = String(raw.merchant_id || '')
  epayConfig.merchant_key = String(raw.merchant_key || '')
  epayConfig.private_key = String(raw.private_key || '')
  epayConfig.platform_public_key = String(raw.platform_public_key || '')
  epayConfig.notify_url = String(raw.notify_url || '')
  epayConfig.return_url = String(raw.return_url || '')
}

const resetPaypalConfig = () => {
  paypalConfig.client_id = ''
  paypalConfig.client_secret = ''
  paypalConfig.base_url = 'https://api-m.sandbox.paypal.com'
  paypalConfig.return_url = ''
  paypalConfig.cancel_url = ''
  paypalConfig.webhook_id = ''
  paypalConfig.brand_name = ''
  paypalConfig.locale = ''
}

const applyPaypalConfig = (raw: Record<string, any>) => {
  paypalConfig.client_id = String(raw.client_id || '')
  paypalConfig.client_secret = String(raw.client_secret || '')
  paypalConfig.base_url = String(raw.base_url || 'https://api-m.sandbox.paypal.com')
  paypalConfig.return_url = String(raw.return_url || '')
  paypalConfig.cancel_url = String(raw.cancel_url || '')
  paypalConfig.webhook_id = String(raw.webhook_id || '')
  paypalConfig.brand_name = String(raw.brand_name || '')
  paypalConfig.locale = String(raw.locale || '')
}

const buildEpayConfig = () => {
  const config: Record<string, any> = {}
  const setIfNotEmpty = (key: string, value: string) => {
    const trimmed = String(value || '').trim()
    if (trimmed !== '') {
      config[key] = trimmed
    }
  }
  setIfNotEmpty('epay_version', epayConfig.epay_version)
  setIfNotEmpty('gateway_url', epayConfig.gateway_url)
  setIfNotEmpty('merchant_id', epayConfig.merchant_id)
  setIfNotEmpty('notify_url', epayConfig.notify_url)
  setIfNotEmpty('return_url', epayConfig.return_url)
  if (epayConfig.epay_version === 'v1') {
    setIfNotEmpty('merchant_key', epayConfig.merchant_key)
  } else {
    setIfNotEmpty('private_key', epayConfig.private_key)
    setIfNotEmpty('platform_public_key', epayConfig.platform_public_key)
  }
  return config
}

const buildPaypalConfig = () => {
  const config: Record<string, any> = {}
  const setIfNotEmpty = (key: string, value: string) => {
    const trimmed = String(value || '').trim()
    if (trimmed !== '') {
      config[key] = trimmed
    }
  }
  setIfNotEmpty('client_id', paypalConfig.client_id)
  setIfNotEmpty('client_secret', paypalConfig.client_secret)
  setIfNotEmpty('base_url', paypalConfig.base_url)
  setIfNotEmpty('return_url', paypalConfig.return_url)
  setIfNotEmpty('cancel_url', paypalConfig.cancel_url)
  setIfNotEmpty('webhook_id', paypalConfig.webhook_id)
  setIfNotEmpty('brand_name', paypalConfig.brand_name)
  setIfNotEmpty('locale', paypalConfig.locale)
  return config
}

const resetStripeConfig = () => {
  stripeConfig.secret_key = ''
  stripeConfig.publishable_key = ''
  stripeConfig.webhook_secret = ''
  stripeConfig.success_url = ''
  stripeConfig.cancel_url = ''
  stripeConfig.api_base_url = 'https://api.stripe.com'
  stripeConfig.payment_method_types = 'card'
}

const applyStripeConfig = (raw: Record<string, any>) => {
  stripeConfig.secret_key = String(raw.secret_key || '')
  stripeConfig.publishable_key = String(raw.publishable_key || '')
  stripeConfig.webhook_secret = String(raw.webhook_secret || '')
  stripeConfig.success_url = String(raw.success_url || '')
  stripeConfig.cancel_url = String(raw.cancel_url || '')
  stripeConfig.api_base_url = String(raw.api_base_url || 'https://api.stripe.com')
  const methodTypes = Array.isArray(raw.payment_method_types)
    ? raw.payment_method_types.map((item: any) => String(item || '').trim()).filter(Boolean)
    : []
  stripeConfig.payment_method_types = methodTypes.length > 0 ? methodTypes.join(',') : 'card'
}

const buildStripeConfig = () => {
  const config: Record<string, any> = {}
  const setIfNotEmpty = (key: string, value: string) => {
    const trimmed = String(value || '').trim()
    if (trimmed !== '') {
      config[key] = trimmed
    }
  }
  setIfNotEmpty('secret_key', stripeConfig.secret_key)
  setIfNotEmpty('publishable_key', stripeConfig.publishable_key)
  setIfNotEmpty('webhook_secret', stripeConfig.webhook_secret)
  setIfNotEmpty('success_url', stripeConfig.success_url)
  setIfNotEmpty('cancel_url', stripeConfig.cancel_url)
  setIfNotEmpty('api_base_url', stripeConfig.api_base_url)
  const methodTypes = String(stripeConfig.payment_method_types || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (methodTypes.length > 0) {
    config.payment_method_types = methodTypes
  }
  return config
}

const resetAlipayConfig = () => {
  alipayConfig.app_id = ''
  alipayConfig.private_key = ''
  alipayConfig.alipay_public_key = ''
  alipayConfig.gateway_url = 'https://openapi.alipay.com/gateway.do'
  alipayConfig.notify_url = ''
  alipayConfig.return_url = ''
  alipayConfig.sign_type = 'RSA2'
  alipayConfig.app_cert_sn = ''
  alipayConfig.alipay_root_cert_sn = ''
}

const applyAlipayConfig = (raw: Record<string, any>) => {
  alipayConfig.app_id = String(raw.app_id || '')
  alipayConfig.private_key = String(raw.private_key || '')
  alipayConfig.alipay_public_key = String(raw.alipay_public_key || '')
  alipayConfig.gateway_url = String(raw.gateway_url || 'https://openapi.alipay.com/gateway.do')
  alipayConfig.notify_url = String(raw.notify_url || '')
  alipayConfig.return_url = String(raw.return_url || '')
  alipayConfig.sign_type = String(raw.sign_type || 'RSA2').toUpperCase()
  alipayConfig.app_cert_sn = String(raw.app_cert_sn || '')
  alipayConfig.alipay_root_cert_sn = String(raw.alipay_root_cert_sn || '')
}

const buildAlipayConfig = () => {
  const config: Record<string, any> = {}
  const setIfNotEmpty = (key: string, value: string) => {
    const trimmed = String(value || '').trim()
    if (trimmed !== '') {
      config[key] = trimmed
    }
  }
  setIfNotEmpty('app_id', alipayConfig.app_id)
  setIfNotEmpty('private_key', alipayConfig.private_key)
  setIfNotEmpty('alipay_public_key', alipayConfig.alipay_public_key)
  setIfNotEmpty('gateway_url', alipayConfig.gateway_url)
  setIfNotEmpty('notify_url', alipayConfig.notify_url)
  setIfNotEmpty('return_url', alipayConfig.return_url)
  setIfNotEmpty('sign_type', alipayConfig.sign_type)
  setIfNotEmpty('app_cert_sn', alipayConfig.app_cert_sn)
  setIfNotEmpty('alipay_root_cert_sn', alipayConfig.alipay_root_cert_sn)
  return config
}

const resetWechatConfig = () => {
  wechatConfig.appid = ''
  wechatConfig.mchid = ''
  wechatConfig.merchant_serial_no = ''
  wechatConfig.merchant_private_key = ''
  wechatConfig.api_v3_key = ''
  wechatConfig.notify_url = ''
  wechatConfig.h5_redirect_url = ''
  wechatConfig.h5_type = 'WAP'
  wechatConfig.h5_wap_url = ''
  wechatConfig.h5_wap_name = ''
}

const applyWechatConfig = (raw: Record<string, any>) => {
  wechatConfig.appid = String(raw.appid || '')
  wechatConfig.mchid = String(raw.mchid || '')
  wechatConfig.merchant_serial_no = String(raw.merchant_serial_no || '')
  wechatConfig.merchant_private_key = String(raw.merchant_private_key || '')
  wechatConfig.api_v3_key = String(raw.api_v3_key || '')
  wechatConfig.notify_url = String(raw.notify_url || '')
  wechatConfig.h5_redirect_url = String(raw.h5_redirect_url || '')
  wechatConfig.h5_type = String(raw.h5_type || 'WAP').toUpperCase()
  wechatConfig.h5_wap_url = String(raw.h5_wap_url || '')
  wechatConfig.h5_wap_name = String(raw.h5_wap_name || '')
}

const buildWechatConfig = () => {
  const config: Record<string, any> = {}
  const setIfNotEmpty = (key: string, value: string) => {
    const trimmed = String(value || '').trim()
    if (trimmed !== '') {
      config[key] = trimmed
    }
  }
  setIfNotEmpty('appid', wechatConfig.appid)
  setIfNotEmpty('mchid', wechatConfig.mchid)
  setIfNotEmpty('merchant_serial_no', wechatConfig.merchant_serial_no)
  setIfNotEmpty('merchant_private_key', wechatConfig.merchant_private_key)
  setIfNotEmpty('api_v3_key', wechatConfig.api_v3_key)
  setIfNotEmpty('notify_url', wechatConfig.notify_url)
  setIfNotEmpty('h5_redirect_url', wechatConfig.h5_redirect_url)
  setIfNotEmpty('h5_type', wechatConfig.h5_type)
  setIfNotEmpty('h5_wap_url', wechatConfig.h5_wap_url)
  setIfNotEmpty('h5_wap_name', wechatConfig.h5_wap_name)
  return config
}

const resetEpusdtConfig = () => {
  epusdtConfig.gateway_url = ''
  epusdtConfig.auth_token = ''
  epusdtConfig.trade_type = 'usdt.trc20'
  epusdtConfig.fiat = 'CNY'
  epusdtConfig.notify_url = 'https://api.yourdomain.com/api/v1/payments/callback'
  epusdtConfig.return_url = 'https://yourdomain.com/pay'
}

const applyEpusdtConfig = (raw: Record<string, any>) => {
  epusdtConfig.gateway_url = String(raw.gateway_url || '')
  epusdtConfig.auth_token = String(raw.auth_token || '')
  epusdtConfig.trade_type = String(raw.trade_type || 'usdt.trc20')
  epusdtConfig.fiat = String(raw.fiat || 'CNY')
  epusdtConfig.notify_url = String(raw.notify_url || '')
  epusdtConfig.return_url = String(raw.return_url || '')
}

const buildEpusdtConfig = () => {
  const config: Record<string, any> = {}
  
  // 必填字段
  config.gateway_url = String(epusdtConfig.gateway_url || '').trim()
  config.auth_token = String(epusdtConfig.auth_token || '').trim()
  
  // notify_url 和 return_url：确保始终有值
  const notifyUrl = String(epusdtConfig.notify_url || '').trim()
  const returnUrl = String(epusdtConfig.return_url || '').trim()
  
  config.notify_url = notifyUrl || 'https://api.yourdomain.com/api/v1/payments/callback'
  config.return_url = returnUrl || 'https://yourdomain.com/pay'
  
  // 可选字段
  const tradeType = String(epusdtConfig.trade_type || '').trim()
  if (tradeType !== '') {
    config.trade_type = tradeType
  }
  const fiat = String(epusdtConfig.fiat || '').trim()
  if (fiat !== '') {
    config.fiat = fiat
  }
  
  return config
}

const resetTokenpayConfig = () => {
  tokenpayConfig.gateway_url = ''
  tokenpayConfig.notify_secret = ''
  tokenpayConfig.currency = 'USDT'
  tokenpayConfig.notify_url = 'https://api.yourdomain.com/api/v1/payments/callback'
  tokenpayConfig.redirect_url = 'https://yourdomain.com/pay'
  tokenpayConfig.base_currency = 'CNY'
}

const applyTokenpayConfig = (raw: Record<string, any>) => {
  tokenpayConfig.gateway_url = String(raw.gateway_url || '')
  tokenpayConfig.notify_secret = String(raw.notify_secret || '')
  tokenpayConfig.currency = String(raw.currency || 'USDT')
  tokenpayConfig.notify_url = String(raw.notify_url || '')
  tokenpayConfig.redirect_url = String(raw.redirect_url || '')
  tokenpayConfig.base_currency = String(raw.base_currency || 'CNY')
}

const buildTokenpayConfig = () => {
  const config: Record<string, any> = {}
  const setIfNotEmpty = (key: string, value: string) => {
    const trimmed = String(value || '').trim()
    if (trimmed !== '') {
      config[key] = trimmed
    }
  }
  setIfNotEmpty('gateway_url', tokenpayConfig.gateway_url)
  setIfNotEmpty('notify_secret', tokenpayConfig.notify_secret)
  setIfNotEmpty('currency', tokenpayConfig.currency)
  setIfNotEmpty('notify_url', tokenpayConfig.notify_url)
  setIfNotEmpty('redirect_url', tokenpayConfig.redirect_url)
  setIfNotEmpty('base_currency', tokenpayConfig.base_currency)
  return config
}

const openEditById = async (rawId: unknown) => {
  const id = Number(rawId)
  if (!Number.isFinite(id) || id <= 0) return
  try {
    const response = await adminAPI.getPaymentChannel(id)
    openEditModal(response.data.data)
  } catch (err: any) {
    error.value = err?.message || t('admin.paymentChannels.errors.fetchFailed')
    showModal.value = true
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{{ t('admin.paymentChannels.title') }}</h1>
      <Button class="gap-2" @click="openCreateModal">
        <span>{{ t('admin.paymentChannels.create') }}</span>
      </Button>
    </div>

    <div class="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="w-full md:w-56">
          <Select v-model="filters.providerType" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
            <SelectValue :placeholder="t('admin.paymentChannels.filterProviderAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.paymentChannels.filterProviderAll') }}</SelectItem>
              <SelectItem value="official">{{ t('admin.paymentChannels.providerTypes.official') }}</SelectItem>
              <SelectItem value="epay">{{ t('admin.paymentChannels.providerTypes.epay') }}</SelectItem>
              <SelectItem value="epusdt">{{ t('admin.paymentChannels.providerTypes.epusdt') }}</SelectItem>
              <SelectItem value="tokenpay">{{ t('admin.paymentChannels.providerTypes.tokenpay') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-full md:w-56">
          <Select v-model="filters.channelType" @update:modelValue="handleSearch">
            <SelectTrigger class="h-9 w-full">
            <SelectValue :placeholder="t('admin.paymentChannels.filterChannelAll')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{{ t('admin.paymentChannels.filterChannelAll') }}</SelectItem>
              <SelectItem value="wechat">{{ t('admin.paymentChannels.channelTypes.wechat') }}</SelectItem>
              <SelectItem value="alipay">{{ t('admin.paymentChannels.channelTypes.alipay') }}</SelectItem>
              <SelectItem value="qqpay">{{ t('admin.paymentChannels.channelTypes.qqpay') }}</SelectItem>
              <SelectItem value="paypal">{{ t('admin.paymentChannels.channelTypes.paypal') }}</SelectItem>
              <SelectItem value="stripe">{{ t('admin.paymentChannels.channelTypes.stripe') }}</SelectItem>
              <SelectItem value="usdt">{{ t('admin.paymentChannels.channelTypes.usdt') }}</SelectItem>
              <SelectItem value="usdt-trc20">{{ t('admin.paymentChannels.channelTypes.usdtTrc20') }}</SelectItem>
              <SelectItem value="usdc-trc20">{{ t('admin.paymentChannels.channelTypes.usdcTrc20') }}</SelectItem>
              <SelectItem value="trx">{{ t('admin.paymentChannels.channelTypes.trx') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex-1"></div>
        <Button size="sm" variant="outline" @click="refresh">{{ t('admin.common.refresh') }}</Button>
      </div>
    </div>

    <div class="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader class="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
          <TableRow>
            <TableHead class="px-6 py-3">{{ t('admin.paymentChannels.table.id') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.paymentChannels.table.name') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.paymentChannels.table.type') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.paymentChannels.table.interaction') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.paymentChannels.table.feeRate') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.paymentChannels.table.status') }}</TableHead>
            <TableHead class="px-6 py-3">{{ t('admin.paymentChannels.table.sort') }}</TableHead>
            <TableHead class="px-6 py-3 text-right">{{ t('admin.paymentChannels.table.action') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody class="divide-y divide-border">
          <TableRow v-if="loading">
            <TableCell colspan="8" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.common.loading') }}</TableCell>
          </TableRow>
          <TableRow v-else-if="channels.length === 0">
            <TableCell colspan="8" class="px-6 py-8 text-center text-muted-foreground">{{ t('admin.paymentChannels.empty') }}</TableCell>
          </TableRow>
          <TableRow v-for="channel in channels" :key="channel.id" class="hover:bg-muted/30 group">
            <TableCell class="px-6 py-4">
              <IdCell :value="channel.id" />
            </TableCell>
            <TableCell class="px-6 py-4">
              <div class="font-medium text-foreground">{{ channel.name }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">
              <div>{{ providerTypeLabel(channel.provider_type) }}</div>
              <div class="text-muted-foreground">{{ channelTypeLabel(channel.channel_type) }}</div>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ interactionModeLabel(channel.interaction_mode) }}</TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ formatFeeRate(channel.fee_rate) }}</TableCell>
            <TableCell class="px-6 py-4">
              <span class="inline-flex rounded-full border px-2.5 py-1 text-xs" :class="channel.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-muted-foreground border-border bg-muted/30'">
                {{ channel.is_active ? t('admin.common.enabled') : t('admin.common.disabled') }}
              </span>
            </TableCell>
            <TableCell class="px-6 py-4 text-xs text-muted-foreground">{{ channel.sort_order }}</TableCell>
            <TableCell class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="outline" @click="openEditModal(channel)">
                  {{ t('admin.common.edit') }}
                </Button>
                <Button size="sm" variant="destructive" @click="handleDelete(channel)">
                  {{ t('admin.common.delete') }}
                </Button>
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
          <DialogTitle>{{ isEditing ? t('admin.paymentChannels.modal.editTitle') : t('admin.paymentChannels.modal.createTitle') }}</DialogTitle>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.name') }}</label>
              <Input v-model="form.name" required :placeholder="t('admin.paymentChannels.modal.namePlaceholder')" />
            </div>
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.providerType') }}</label>
              <Select v-model="form.provider_type">
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.paymentChannels.providerTypes.official')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="official">{{ t('admin.paymentChannels.providerTypes.official') }}</SelectItem>
                  <SelectItem value="epay">{{ t('admin.paymentChannels.providerTypes.epay') }}</SelectItem>
                  <SelectItem value="epusdt">{{ t('admin.paymentChannels.providerTypes.epusdt') }}</SelectItem>
                  <SelectItem value="tokenpay">{{ t('admin.paymentChannels.providerTypes.tokenpay') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="form.provider_type !== 'tokenpay' && form.provider_type !== 'epusdt'">
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.channelType') }}</label>
              <Select v-model="form.channel_type">
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.paymentChannels.channelTypes.wechat')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="option in formChannelOptions" :key="option.value" :value="option.value">
                    {{ t(option.label) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.interactionMode') }}</label>
              <Select v-model="form.interaction_mode">
                <SelectTrigger class="h-9 w-full">
                  <SelectValue :placeholder="t('admin.paymentChannels.interactionModes.qr')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="option in interactionModeOptions" :key="option.value" :value="option.value">
                    {{ t(option.label) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.feeRate') }}</label>
              <Input v-model="form.fee_rate" type="number" step="0.01" min="0" max="100" :placeholder="t('admin.paymentChannels.modal.feeRatePlaceholder')" />
            </div>
            <div>
              <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.sortOrder') }}</label>
              <Input v-model.number="form.sort_order" type="number" placeholder="10" />
            </div>
            <div class="flex items-center gap-2 mt-6">
              <input v-model="form.is_active" type="checkbox" class="h-4 w-4 accent-primary" />
              <span class="text-xs text-muted-foreground">{{ t('admin.common.enabled') }}</span>
            </div>
          </div>

          <div v-if="form.provider_type === 'epay'" class="rounded-xl border border-border bg-muted/20 p-4">
            <div class="text-sm font-semibold text-foreground mb-3">{{ t('admin.paymentChannels.modal.epaySection') }}</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.epayVersion') }}</label>
                <Select v-model="epayConfig.epay_version">
                  <SelectTrigger class="h-9 w-full">
                    <SelectValue placeholder="v1" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v1">v1</SelectItem>
                    <SelectItem value="v2">v2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.gatewayUrl') }}</label>
                <Input v-model="epayConfig.gateway_url" :placeholder="t('admin.paymentChannels.modal.gatewayUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.merchantId') }}</label>
                <Input v-model="epayConfig.merchant_id" :placeholder="t('admin.paymentChannels.modal.merchantIdPlaceholder')" />
              </div>
              <div v-if="epayConfig.epay_version === 'v1'">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.merchantKey') }}</label>
                <Input v-model="epayConfig.merchant_key" :placeholder="t('admin.paymentChannels.modal.merchantKeyPlaceholder')" />
              </div>
              <div v-else class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.privateKey') }}</label>
                <Textarea v-model="epayConfig.private_key" rows="4" :placeholder="t('admin.paymentChannels.modal.privateKeyPlaceholder')" />
              </div>
              <div v-if="epayConfig.epay_version === 'v2'" class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.platformPublicKey') }}</label>
                <Textarea v-model="epayConfig.platform_public_key" rows="4" :placeholder="t('admin.paymentChannels.modal.platformPublicKeyPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.notifyUrl') }}</label>
                <Input v-model="epayConfig.notify_url" :placeholder="t('admin.paymentChannels.modal.notifyUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.returnUrl') }}</label>
                <Input v-model="epayConfig.return_url" :placeholder="t('admin.paymentChannels.modal.returnUrlPlaceholder')" />
              </div>
            </div>
            <div class="mt-3 text-xs text-muted-foreground">{{ t('admin.paymentChannels.modal.epayHint') }}</div>
          </div>

          <div v-if="form.provider_type === 'official' && form.channel_type === 'paypal'" class="rounded-xl border border-border bg-muted/20 p-4">
            <div class="text-sm font-semibold text-foreground mb-3">{{ t('admin.paymentChannels.modal.paypalSection') }}</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.paypalClientId') }}</label>
                <Input v-model="paypalConfig.client_id" :placeholder="t('admin.paymentChannels.modal.paypalClientIdPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.paypalClientSecret') }}</label>
                <Input v-model="paypalConfig.client_secret" :placeholder="t('admin.paymentChannels.modal.paypalClientSecretPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.paypalBaseUrl') }}</label>
                <Input v-model="paypalConfig.base_url" :placeholder="t('admin.paymentChannels.modal.paypalBaseUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.returnUrl') }}</label>
                <Input v-model="paypalConfig.return_url" :placeholder="t('admin.paymentChannels.modal.returnUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.paypalCancelUrl') }}</label>
                <Input v-model="paypalConfig.cancel_url" :placeholder="t('admin.paymentChannels.modal.paypalCancelUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.paypalWebhookId') }}</label>
                <Input v-model="paypalConfig.webhook_id" :placeholder="t('admin.paymentChannels.modal.paypalWebhookIdPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.paypalBrandName') }}</label>
                <Input v-model="paypalConfig.brand_name" :placeholder="t('admin.paymentChannels.modal.paypalBrandNamePlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.paypalLocale') }}</label>
                <Input v-model="paypalConfig.locale" :placeholder="t('admin.paymentChannels.modal.paypalLocalePlaceholder')" />
              </div>
            </div>
            <div class="mt-3 text-xs text-muted-foreground">{{ t('admin.paymentChannels.modal.paypalHint') }}</div>
          </div>

          <div v-if="form.provider_type === 'official' && form.channel_type === 'stripe'" class="rounded-xl border border-border bg-muted/20 p-4">
            <div class="text-sm font-semibold text-foreground mb-3">{{ t('admin.paymentChannels.modal.stripeSection') }}</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.stripeSecretKey') }}</label>
                <Input v-model="stripeConfig.secret_key" :placeholder="t('admin.paymentChannels.modal.stripeSecretKeyPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.stripePublishableKey') }}</label>
                <Input v-model="stripeConfig.publishable_key" :placeholder="t('admin.paymentChannels.modal.stripePublishableKeyPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.stripeWebhookSecret') }}</label>
                <Input v-model="stripeConfig.webhook_secret" :placeholder="t('admin.paymentChannels.modal.stripeWebhookSecretPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.stripeSuccessUrl') }}</label>
                <Input v-model="stripeConfig.success_url" :placeholder="t('admin.paymentChannels.modal.stripeSuccessUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.stripeCancelUrl') }}</label>
                <Input v-model="stripeConfig.cancel_url" :placeholder="t('admin.paymentChannels.modal.stripeCancelUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.stripeApiBaseUrl') }}</label>
                <Input v-model="stripeConfig.api_base_url" :placeholder="t('admin.paymentChannels.modal.stripeApiBaseUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.stripePaymentMethodTypes') }}</label>
                <Input v-model="stripeConfig.payment_method_types" :placeholder="t('admin.paymentChannels.modal.stripePaymentMethodTypesPlaceholder')" />
              </div>
            </div>
            <div class="mt-3 text-xs text-muted-foreground">{{ t('admin.paymentChannels.modal.stripeHint') }}</div>
          </div>


          <div v-if="form.provider_type === 'official' && form.channel_type === 'wechat'" class="rounded-xl border border-border bg-muted/20 p-4">
            <div class="text-sm font-semibold text-foreground mb-3">{{ t('admin.paymentChannels.modal.wechatSection') }}</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.wechatAppId') }}</label>
                <Input v-model="wechatConfig.appid" :placeholder="t('admin.paymentChannels.modal.wechatAppIdPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.wechatMerchantId') }}</label>
                <Input v-model="wechatConfig.mchid" :placeholder="t('admin.paymentChannels.modal.wechatMerchantIdPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.wechatMerchantSerialNo') }}</label>
                <Input v-model="wechatConfig.merchant_serial_no" :placeholder="t('admin.paymentChannels.modal.wechatMerchantSerialNoPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.wechatApiV3Key') }}</label>
                <Input v-model="wechatConfig.api_v3_key" :placeholder="t('admin.paymentChannels.modal.wechatApiV3KeyPlaceholder')" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.wechatMerchantPrivateKey') }}</label>
                <Textarea v-model="wechatConfig.merchant_private_key" rows="4" :placeholder="t('admin.paymentChannels.modal.wechatMerchantPrivateKeyPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.wechatNotifyUrl') }}</label>
                <Input v-model="wechatConfig.notify_url" :placeholder="t('admin.paymentChannels.modal.wechatNotifyUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.wechatH5RedirectUrl') }}</label>
                <Input v-model="wechatConfig.h5_redirect_url" :placeholder="t('admin.paymentChannels.modal.wechatH5RedirectUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.wechatH5Type') }}</label>
                <Input v-model="wechatConfig.h5_type" :placeholder="t('admin.paymentChannels.modal.wechatH5TypePlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.wechatH5WapUrl') }}</label>
                <Input v-model="wechatConfig.h5_wap_url" :placeholder="t('admin.paymentChannels.modal.wechatH5WapUrlPlaceholder')" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.wechatH5WapName') }}</label>
                <Input v-model="wechatConfig.h5_wap_name" :placeholder="t('admin.paymentChannels.modal.wechatH5WapNamePlaceholder')" />
              </div>
            </div>
            <div class="mt-3 text-xs text-muted-foreground">{{ t('admin.paymentChannels.modal.wechatHint') }}</div>
          </div>

          <div v-if="form.provider_type === 'official' && form.channel_type === 'alipay'" class="rounded-xl border border-border bg-muted/20 p-4">
            <div class="text-sm font-semibold text-foreground mb-3">{{ t('admin.paymentChannels.modal.alipaySection') }}</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.alipayAppId') }}</label>
                <Input v-model="alipayConfig.app_id" :placeholder="t('admin.paymentChannels.modal.alipayAppIdPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.alipaySignType') }}</label>
                <Input v-model="alipayConfig.sign_type" :placeholder="t('admin.paymentChannels.modal.alipaySignTypePlaceholder')" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.alipayPrivateKey') }}</label>
                <Textarea v-model="alipayConfig.private_key" rows="4" :placeholder="t('admin.paymentChannels.modal.alipayPrivateKeyPlaceholder')" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.alipayPublicKey') }}</label>
                <Textarea v-model="alipayConfig.alipay_public_key" rows="4" :placeholder="t('admin.paymentChannels.modal.alipayPublicKeyPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.alipayGatewayUrl') }}</label>
                <Input v-model="alipayConfig.gateway_url" :placeholder="t('admin.paymentChannels.modal.alipayGatewayUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.alipayNotifyUrl') }}</label>
                <Input v-model="alipayConfig.notify_url" :placeholder="t('admin.paymentChannels.modal.alipayNotifyUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.alipayReturnUrl') }}</label>
                <Input v-model="alipayConfig.return_url" :placeholder="t('admin.paymentChannels.modal.alipayReturnUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.alipayAppCertSn') }}</label>
                <Input v-model="alipayConfig.app_cert_sn" :placeholder="t('admin.paymentChannels.modal.alipayAppCertSnPlaceholder')" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.alipayRootCertSn') }}</label>
                <Input v-model="alipayConfig.alipay_root_cert_sn" :placeholder="t('admin.paymentChannels.modal.alipayRootCertSnPlaceholder')" />
              </div>
            </div>
            <div class="mt-3 text-xs text-muted-foreground">{{ t('admin.paymentChannels.modal.alipayHint') }}</div>
          </div>

          <div v-if="form.provider_type === 'epusdt'" class="rounded-xl border border-border bg-muted/20 p-4">
            <div class="text-sm font-semibold text-foreground mb-3">{{ t('admin.paymentChannels.modal.epusdtSection') }}</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.epusdtGatewayUrl') }}</label>
                <Input v-model="epusdtConfig.gateway_url" :placeholder="t('admin.paymentChannels.modal.epusdtGatewayUrlPlaceholder')" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.epusdtAuthToken') }}</label>
                <Input v-model="epusdtConfig.auth_token" :placeholder="t('admin.paymentChannels.modal.epusdtAuthTokenPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.epusdtTradeType') }}</label>
                <Input v-model="epusdtConfig.trade_type" :placeholder="t('admin.paymentChannels.modal.epusdtTradeTypePlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.epusdtFiat') }}</label>
                <Input v-model="epusdtConfig.fiat" :placeholder="t('admin.paymentChannels.modal.epusdtFiatPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.epusdtNotifyUrl') }}</label>
                <Input v-model="epusdtConfig.notify_url" :placeholder="t('admin.paymentChannels.modal.epusdtNotifyUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.epusdtReturnUrl') }}</label>
                <Input v-model="epusdtConfig.return_url" :placeholder="t('admin.paymentChannels.modal.epusdtReturnUrlPlaceholder')" />
              </div>
            </div>
            <div class="mt-3 text-xs text-muted-foreground">{{ t('admin.paymentChannels.modal.epusdtHint') }}</div>
          </div>

          <div v-if="form.provider_type === 'tokenpay'" class="rounded-xl border border-border bg-muted/20 p-4">
            <div class="text-sm font-semibold text-foreground mb-3">{{ t('admin.paymentChannels.modal.tokenpaySection') }}</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.tokenpayGatewayUrl') }}</label>
                <Input v-model="tokenpayConfig.gateway_url" :placeholder="t('admin.paymentChannels.modal.tokenpayGatewayUrlPlaceholder')" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.tokenpayNotifySecret') }}</label>
                <Input v-model="tokenpayConfig.notify_secret" :placeholder="t('admin.paymentChannels.modal.tokenpayNotifySecretPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.tokenpayCurrency') }}</label>
                <Input v-model="tokenpayConfig.currency" :placeholder="t('admin.paymentChannels.modal.tokenpayCurrencyPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.tokenpayBaseCurrency') }}</label>
                <Input v-model="tokenpayConfig.base_currency" :placeholder="t('admin.paymentChannels.modal.tokenpayBaseCurrencyPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.tokenpayNotifyUrl') }}</label>
                <Input v-model="tokenpayConfig.notify_url" :placeholder="t('admin.paymentChannels.modal.tokenpayNotifyUrlPlaceholder')" />
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1.5">{{ t('admin.paymentChannels.modal.tokenpayRedirectUrl') }}</label>
                <Input v-model="tokenpayConfig.redirect_url" :placeholder="t('admin.paymentChannels.modal.tokenpayRedirectUrlPlaceholder')" />
              </div>
            </div>
            <div class="mt-3 text-xs text-muted-foreground">{{ t('admin.paymentChannels.modal.tokenpayHint') }}</div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block text-xs font-medium text-muted-foreground">{{ t('admin.paymentChannels.modal.configJson') }}</label>
              <button type="button" class="text-xs text-muted-foreground hover:text-foreground" @click="showAdvanced = !showAdvanced">
                {{ showAdvanced ? t('admin.paymentChannels.modal.advancedHide') : t('admin.paymentChannels.modal.advancedShow') }}
              </button>
            </div>
            <Textarea v-if="showAdvanced" v-model="form.config_json" rows="8" class="font-mono text-xs" :placeholder="configJsonPlaceholder" />
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
