export interface ApiResponse<T = unknown> {
  status_code: number
  msg: string
  data: T
  pagination?: {
    page: number
    page_size: number
    total: number
    total_page: number
  }
}

// --- Localized JSON (multi-language content) ---
export type LocalizedText = Record<string, string>

// --- Category ---
export interface AdminCategory {
  id: number
  parent_id: number
  slug: string
  name: LocalizedText
  icon: string
  sort_order: number
  created_at: string
}

// --- Product ---
export interface AdminProductSKU {
  id: number
  product_id: number
  sku_code: string
  spec_values: Record<string, string>
  price_amount: number
  cost_price_amount: number
  manual_stock_total: number
  manual_stock_locked: number
  manual_stock_sold: number
  auto_stock_available: number
  auto_stock_total: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AdminProduct {
  id: number
  category_id: number
  slug: string
  seo_meta: Record<string, LocalizedText>
  title: LocalizedText
  description: LocalizedText
  content: LocalizedText
  price_amount: number
  cost_price_amount: number
  images: string[]
  tags: string[]
  purchase_type: string
  min_purchase_quantity: number
  max_purchase_quantity: number
  fulfillment_type: string
  manual_form_schema: Record<string, unknown> | null
  manual_stock_total: number
  manual_stock_locked: number
  manual_stock_sold: number
  payment_channel_ids: string
  is_affiliate_enabled: boolean
  auto_stock_available: number
  auto_stock_total: number
  auto_stock_locked: number
  auto_stock_sold: number
  is_mapped: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  category?: AdminCategory
  skus?: AdminProductSKU[]
}

export interface AdminNotificationLog {
  id: number
  event_type: string
  biz_type: string
  biz_id: number
  channel: string
  recipient: string
  locale: string
  title: string
  body: string
  status: string
  error_message: string
  is_test: boolean
  variables?: Record<string, unknown>
  created_at: string
}

// --- Order ---
export interface AdminOrderItem {
  id: number
  order_id: number
  product_id: number
  sku_id: number
  title: LocalizedText
  sku_snapshot?: {
    sku_id?: number
    sku_code?: string
    spec_values?: unknown
    image?: string
    [key: string]: unknown
  }
  quantity: number
  unit_price: number
  cost_price: number
  total_price: number
  fulfillment_type: string
  created_at: string
  promotion_id?: number
  promotion_name?: string
  tags?: string[]
  manual_form_schema_snapshot?: Record<string, unknown>
  manual_form_submission?: Record<string, unknown>
  coupon_discount_amount?: number
  promotion_discount_amount?: number
  member_discount_amount?: number
}

export interface AdminFulfillment {
  id: number
  order_id: number
  type: string
  status: string
  content: string
  created_at: string
  updated_at: string
  payload?: string
  payload_line_count?: number
  delivery_data?: Record<string, unknown>
}

export interface AdminOrder {
  id: number
  order_no: string
  parent_id?: number
  user_id: number
  guest_email?: string
  guest_locale?: string
  status: string
  currency: string
  original_amount: number
  discount_amount: number
  promotion_discount_amount: number
  member_discount_amount?: number
  total_amount: number
  wallet_paid_amount: number
  online_paid_amount: number
  refunded_amount: number
  coupon_id?: number
  coupon_code?: string
  promotion_id?: number
  affiliate_profile_id?: number
  affiliate_code?: string
  client_ip?: string
  expires_at?: string
  paid_at?: string
  canceled_at?: string
  created_at: string
  updated_at: string
  items?: AdminOrderItem[]
  fulfillment?: AdminFulfillment
  children?: AdminOrder[]
  payments?: AdminPayment[]
  user_display_name?: string
  user_email?: string
}

export interface AdminUserOAuthIdentity {
  id: number
  provider: string
  provider_user_id: string
  username?: string
  avatar_url?: string
  auth_at?: string
  created_at: string
}

// --- CardSecret ---
export interface AdminCardSecretBatch {
  id: number
  product_id: number
  sku_id: number
  name: string
  batch_no?: string
  source?: string
  note?: string
  total_count: number
  available_count: number
  reserved_count: number
  used_count: number
  created_at: string
}

export interface AdminCardSecret {
  id: number
  product_id: number
  sku_id: number
  batch_id?: number
  secret: string
  status: string
  order_id?: number
  reserved_at?: string
  used_at?: string
  created_at: string
  updated_at: string
  batch?: AdminCardSecretBatch
}

// --- Coupon ---
export interface AdminCoupon {
  id: number
  code: string
  type: string
  value: number
  min_amount: number
  max_discount: number
  usage_limit: number
  used_count: number
  per_user_limit: number
  payment_roles?: string[]
  member_levels?: number[]
  scope_type: string
  scope_ref_ids: number[] | string
  starts_at?: string
  ends_at?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- GiftCard ---
export interface AdminGiftCard {
  id: number
  batch_id?: number
  name: string
  code: string
  amount: number | string
  currency: string
  status: string
  expires_at?: string
  redeemed_at?: string
  redeemed_user_id?: number
  wallet_txn_id?: number
  created_at: string
  updated_at: string
}

export interface AdminGiftCardBatch {
  id: number
  name: string
  batch_no?: string
  total_count: number
  amount: number
  currency: string
  created_at: string
}

// --- MemberLevel ---
export interface AdminMemberLevel {
  id: number
  name: LocalizedText
  slug: string
  icon: string
  discount_rate: number
  recharge_threshold: number
  spend_threshold: number
  is_default: boolean
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AdminMemberLevelPrice {
  id: number
  member_level_id: number
  product_id: number
  sku_id: number
  price_amount: number
  created_at: string
  updated_at: string
}

// --- Promotion ---
export interface AdminPromotion {
  id: number
  name: string
  scope_type: string
  scope_ref_id: number
  type: string
  value: number
  min_amount: number
  starts_at?: string
  ends_at?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// --- Banner ---
// --- Media ---
export interface AdminMedia {
  id: number
  name: string
  filename: string
  path: string
  mime_type: string
  size: number
  scene: string
  width: number
  height: number
  created_at: string
}

export interface AdminBanner {
  id: number
  name: string
  position: string
  title: LocalizedText
  subtitle: LocalizedText
  image: string
  mobile_image: string
  link_type: string
  link_value: string
  open_in_new_tab: boolean
  is_active: boolean
  start_at?: string
  end_at?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AdminTelegramBotRuntimeStatus {
  connected: boolean
  last_seen_at?: string
  bot_version?: string
  webhook_status?: string
  machine_code?: string
  license_status?: string
  license_expires_at?: string
  warnings?: string[]
  config_version: number
  last_config_sync_at?: string
}

export interface AdminTelegramBroadcast {
  id: number
  title: string
  recipient_type: string
  filters?: Record<string, unknown>
  recipient_count: number
  success_count: number
  failed_count: number
  status: string
  message_html: string
  attachment_url?: string
  attachment_name?: string
  started_at?: string
  completed_at?: string
  last_error?: string
  created_at: string
  updated_at: string
}

export interface AdminTelegramBroadcastUser {
  user_id: number
  display_name: string
  user_email: string
  telegram_username: string
  telegram_user_id: string
  bound_at: string
  user_created_at: string
}

// --- Post ---
export interface AdminPost {
  id: number
  slug: string
  type: string
  title: LocalizedText
  summary: LocalizedText
  content: LocalizedText
  thumbnail: string
  is_published: boolean
  published_at?: string
  created_at: string
}

// --- PaymentChannel ---
export interface AdminPaymentChannel {
  id: number
  name: string
  provider_type: string
  channel_type: string
  interaction_mode: string
  fee_rate: number | string
  fixed_fee?: number | string
  min_amount?: number | string
  max_amount?: number | string
  hide_amount_out_range?: boolean
  payment_types?: string[]
  payment_roles?: string[]
  member_levels?: number[]
  config_json: Record<string, unknown>
  icon: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// --- Payment ---
export interface AdminPayment {
  id: number
  payment_no: string
  order_id: number
  channel_id: number
  provider_type: string
  channel_type: string
  interaction_mode: string
  amount: number
  payable_amount: number
  fee_rate: number | string
  fixed_fee?: number | string
  fee_amount: number
  currency: string
  status: string
  provider_trade_no?: string
  paid_at?: string
  expired_at?: string
  created_at: string
  updated_at: string
  order_no?: string
  channel_name?: string
  recharge_no?: string
  recharge_user_id?: number
  recharge_status?: string
  provider_ref?: string
  pay_url?: string
  qr_code?: string
  provider_payload?: Record<string, unknown>
}

// --- OrderRefund ---
export interface AdminOrderRefund {
  id: number
  user_id: number
  guest_email?: string
  guest_locale?: string
  order_id: number
  order_no?: string
  type: string
  refund_type_label?: string
  amount: string
  currency: string
  remark?: string
  items?: AdminOrderItem[]
  user_email?: string
  user_display_name?: string
  created_at: string
  updated_at: string
}

// --- User ---
export interface AdminUser {
  id: number
  email: string
  display_name: string
  nickname?: string
  locale: string
  status: string
  member_level_id?: number
  total_recharged?: number | string
  total_spent?: number | string
  wallet_balance?: number | string
  admin_note?: string
  email_verified_at?: string
  last_login_at?: string
  created_at: string
  updated_at: string
  oauth_identities?: AdminUserOAuthIdentity[]
  [key: string]: unknown
}

// --- UserLoginLog ---
export interface AdminUserLoginLog {
  id: number
  user_id: number
  email: string
  client_ip: string
  user_agent: string
  login_source?: string
  status: string
  fail_reason?: string
  created_at: string
}

// --- SiteConnection ---
export interface AdminSiteConnection {
  id: number
  name: string
  type: string
  base_url: string
  api_key: string
  api_secret?: string
  protocol?: string
  callback_url?: string
  retry_max?: number
  retry_intervals?: string
  status?: string
  is_active: boolean
  last_ping_at?: string
  last_ping_status?: string
  exchange_rate?: number
  price_markup_percent?: number
  price_rounding_mode?: string
  auto_sync_price?: boolean
  created_at: string
  updated_at: string
}

// --- ProductMapping ---
export interface AdminProductMapping {
  id: number
  connection_id: number
  local_product_id: number
  upstream_product_id: number
  upstream_sku_id: number
  upstream_product_name: string
  upstream_sku_name: string
  upstream_price: number
  upstream_currency: string
  is_active: boolean
  last_sync_at?: string
  created_at: string
  updated_at: string
  connection_name?: string
  local_product_title?: string
  last_synced_at?: string
  product?: { id: number; title?: LocalizedText; skus?: AdminProductSKU[] }
  [key: string]: unknown
}

// --- ProcurementOrder ---
export interface AdminProcurementOrder {
  id: number
  connection_id: number
  local_order_id: number
  local_order_no: string
  upstream_order_no?: string
  status: string
  upstream_amount: number
  upstream_currency: string
  local_sell_amount: number
  local_sell_currency: string
  error_message?: string
  retry_count: number
  next_retry_at?: string
  trace_id: string
  upstream_payload?: string
  upstream_payload_line_count?: number
  created_at: string
  updated_at: string
  connection_name?: string
  connection?: { id: number; name: string; type?: string; base_url?: string }
  upstream_refund_records?: Array<Record<string, unknown>>
  upstream_refunded_amount?: string
  [key: string]: unknown
}

// --- Reconciliation ---
export interface AdminReconciliationJob {
  id: number
  connection_id: number
  type: string
  status: string
  time_range_start: string
  time_range_end: string
  total_items: number
  matched_items: number
  mismatched_items: number
  mismatched_count?: number
  total_count?: number
  matched_count?: number
  missing_items: number
  created_at: string
  updated_at: string
  started_at?: string
  finished_at?: string
  result_json?: string
  connection_name?: string
  connection?: { name?: string; [key: string]: unknown }
  [key: string]: unknown
}

export interface AdminReconciliationItem {
  id: number
  job_id: number
  type: string
  local_order_no?: string
  upstream_order_no?: string
  local_amount?: number
  upstream_amount?: number
  local_status?: string
  upstream_status?: string
  mismatch_type?: string
  status: string
  resolution?: string
  resolved?: boolean
  remark?: string
  resolved_by?: string
  resolved_at?: string
  created_at: string
}

// --- ApiCredential ---
export interface AdminApiCredential {
  id: number
  user_id: number
  name: string
  api_key: string
  status: string
  is_active: boolean
  permissions: string[]
  ip_whitelist: string[]
  rate_limit: number
  last_used_at?: string
  approved_at?: string
  reject_reason?: string
  created_at: string
  updated_at: string
  user_email?: string
  user?: { id: number; email: string; display_name?: string }
}

// --- Dashboard ---
export interface AdminDashboardOverview {
  total_orders: number
  total_revenue: number
  total_users: number
  total_products: number
  today_orders: number
  today_revenue: number
  today_users: number
  pending_orders: number
}

export interface AdminDashboardTrendPoint {
  date: string
  orders: number
  revenue: number
  users: number
}

export interface AdminDashboardRanking {
  product_id: number
  product_title: string
  total_orders: number
  total_revenue: number
}

export interface AdminDashboardInventoryAlert {
  product_id: number
  sku_id?: number
  product_title: Record<string, string>
  sku_code?: string
  sku_spec_values?: Record<string, string>
  fulfillment_type: string
  alert_type: string
  available_stock: number
}

// --- Ad Proxy ---
export interface AdRenderSlotDTO {
  code: string
  scene: string
  layout: string
  render_mode: string
  max_items: number
}

export interface AdRenderItemDTO {
  id: number
  advertiser_name: string
  title: string
  subtitle: string
  cta_label: string
  badge: string
  image: string
  mobile_image: string
  icon: string
  link_type: string
  open_in_new_tab: boolean
  theme: string
  dismissible: boolean
  click_url: string
  impression_token: string
}

export interface AdRenderResponse {
  slot: AdRenderSlotDTO
  items: AdRenderItemDTO[]
}

// --- Affiliate ---
export interface AdminAffiliateUser {
  id: number
  user_id: number
  code: string
  status: string
  total_earnings: number
  pending_earnings: number
  confirmed_earnings: number
  withdrawn_earnings: number
  total_referrals: number
  created_at: string
  updated_at: string
  user_email?: string
  user_display_name?: string
}

export interface AdminAffiliateCommission {
  id: number
  affiliate_profile_id: number
  order_id: number
  order_no: string
  amount: number
  rate: number
  base_amount?: number
  rate_percent?: number
  commission_amount?: number
  status: string
  confirmed_at?: string
  confirm_at?: string
  available_at?: string
  created_at: string
  updated_at: string
  affiliate_code?: string
  user_email?: string
  affiliate_profile?: { id: number; user_id: number; code: string; user_email?: string; user_display_name?: string; user?: { id: number; email: string; display_name?: string } }
  order?: { id: number; order_no: string; total_amount?: number }
}

export interface AdminAffiliateWithdraw {
  id: number
  affiliate_profile_id: number
  amount: number
  channel: string
  account_info: string
  account?: string
  status: string
  reject_reason?: string
  paid_at?: string
  processed_at?: string
  processor?: { username?: string; [key: string]: unknown } | string
  created_at: string
  updated_at: string
  affiliate_code?: string
  user_email?: string
  affiliate_profile?: { id: number; user_id: number; code: string; user_email?: string; user_display_name?: string; user?: { id: number; email: string; display_name?: string } }
}
