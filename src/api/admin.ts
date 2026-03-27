import { api, type ApiResponse } from './client'
import type {
  AdminCategory,
  AdminProduct,
  AdminOrder,
  AdminFulfillment,
  AdminCardSecret,
  AdminCardSecretBatch,
  AdminCoupon,
  AdminGiftCard,
  AdminGiftCardBatch,
  AdminMemberLevel,
  AdminMemberLevelPrice,
  AdminPromotion,
  AdminBanner,
  AdminPost,
  AdminPaymentChannel,
  AdminPayment,
  AdminUser,
  AdminUserLoginLog,
  AdminNotificationLog,
  AdminSiteConnection,
  AdminProductMapping,
  AdminProcurementOrder,
  AdminReconciliationJob,
  AdminReconciliationItem,
  AdminApiCredential,
  AdminDashboardOverview,
  AdminDashboardTrendPoint,
  AdminDashboardRanking,
  AdminDashboardInventoryAlert,
  AdminAffiliateUser,
  AdminAffiliateCommission,
  AdminAffiliateWithdraw,
  AdminTelegramBotRuntimeStatus,
  AdminTelegramBroadcast,
  AdminTelegramBroadcastUser,
  AdRenderResponse,
} from './types'

export interface CaptchaPayload {
  captcha_id?: string
  captcha_code?: string
  turnstile_token?: string
}

export interface AdminLoginRequest {
  username: string
  password: string
  captcha_payload?: CaptchaPayload
}

export interface AdminLoginResponse {
  token: string
  user: {
    id: number
    username: string
  }
  expires_at: string
}

export interface AdminAuthzPolicy {
  subject: string
  object: string
  action: string
}

export interface AdminAuthzMeResponse {
  admin_id: number
  is_super: boolean
  roles: string[]
  policies: AdminAuthzPolicy[]
}

export interface AdminAuthzAdmin {
  id: number
  username: string
  is_super: boolean
  last_login_at?: string
  created_at?: string
  roles?: string[]
}

export interface AuthzCreateAdminRequest {
  username: string
  password: string
  is_super?: boolean
}

export interface AuthzUpdateAdminRequest {
  username?: string
  password?: string
  is_super?: boolean
}

export interface AdminAuthzAuditLog {
  id: number
  operator_admin_id: number
  operator_username: string
  target_admin_id?: number
  target_username: string
  action: string
  role: string
  object: string
  method: string
  request_id: string
  detail: Record<string, unknown>
  created_at: string
}

export interface AdminPermissionCatalogItem {
  module: string
  method: string
  object: string
  permission: string
}

export interface AdminWalletAccount {
  id: number
  user_id: number
  balance: string
  created_at: string
  updated_at: string
}

export interface AdminWalletTransaction {
  id: number
  user_id: number
  order_id?: number | null
  type: string
  direction: string
  amount: string
  balance_before: string
  balance_after: string
  currency: string
  reference: string
  remark: string
  created_at: string
  updated_at: string
}

export interface AdminWalletRechargeUser {
  id: number
  email: string
  display_name: string
}

export interface AdminWalletRecharge {
  id: number
  recharge_no: string
  user_id: number
  payment_id: number
  channel_id: number
  provider_type: string
  channel_type: string
  interaction_mode: string
  amount: string
  payable_amount: string
  fee_rate: string
  fee_amount: string
  currency: string
  status: string
  remark?: string
  paid_at?: string
  created_at: string
  updated_at: string
  channel_name?: string
  payment_status?: string
  user?: AdminWalletRechargeUser
}

export interface AdminAdjustWalletPayload {
  amount: string
  operation?: 'add' | 'subtract'
  currency?: string
  remark?: string
}

export interface AdminRefundToWalletPayload {
  amount: string
  remark?: string
}

export interface AdminBatchCardSecretStatusPayload {
  ids?: number[]
  batch_id?: number
  filter?: AdminCardSecretQueryPayload
  status: 'available' | 'reserved' | 'used'
}

export interface AdminBatchCardSecretDeletePayload {
  ids?: number[]
  batch_id?: number
  filter?: AdminCardSecretQueryPayload
}

export interface AdminExportCardSecretsPayload {
  ids?: number[]
  batch_id?: number
  filter?: AdminCardSecretQueryPayload
  format: 'txt' | 'csv'
}

export interface AdminCardSecretQueryPayload {
  product_id?: number
  sku_id?: number
  batch_id?: number
  status?: string
  secret?: string
  batch_no?: string
}

export type AdminGiftCardStatus = 'active' | 'redeemed' | 'disabled'

export interface AdminGenerateGiftCardsPayload {
  name: string
  quantity: number
  amount: string
  expires_at?: string
}

export interface AdminUpdateGiftCardPayload {
  name?: string
  status?: Exclude<AdminGiftCardStatus, 'redeemed'>
  expires_at?: string
}

export interface AdminBatchGiftCardStatusPayload {
  ids: number[]
  status: 'active' | 'disabled'
}

export interface AdminExportGiftCardsPayload {
  ids: number[]
  format: 'txt' | 'csv'
}

export interface AdminAffiliateSetting {
  enabled: boolean
  commission_rate: number
  confirm_days: number
  min_withdraw_amount: number
  withdraw_channels: string[]
}

export const adminAPI = {
  login: (data: AdminLoginRequest) => api.post<ApiResponse<AdminLoginResponse>>('/admin/login', data),
  getAuthzMe: () => api.get<ApiResponse<AdminAuthzMeResponse>>('/admin/authz/me'),
  listAuthzRoles: () => api.get<ApiResponse<string[]>>('/admin/authz/roles'),
  listAuthzAdmins: () => api.get<ApiResponse<AdminAuthzAdmin[]>>("/admin/authz/admins"),
  createAuthzAdmin: (data: AuthzCreateAdminRequest) => api.post<ApiResponse<AdminAuthzAdmin>>("/admin/authz/admins", data),
  updateAuthzAdmin: (id: number, data: AuthzUpdateAdminRequest) => api.put<ApiResponse<AdminAuthzAdmin>>(`/admin/authz/admins/${id}`, data),
  deleteAuthzAdmin: (id: number) => api.delete<ApiResponse>(`/admin/authz/admins/${id}`),
  listAuthzAuditLogs: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminAuthzAuditLog[]>>("/admin/authz/audit-logs", { params }),
  listAuthzPermissionCatalog: () => api.get<ApiResponse<AdminPermissionCatalogItem[]>>("/admin/authz/permissions/catalog"),
  createAuthzRole: (data: { role: string }) => api.post<ApiResponse>('/admin/authz/roles', data),
  deleteAuthzRole: (role: string) => api.delete<ApiResponse>(`/admin/authz/roles/${encodeURIComponent(role)}`),
  getAuthzRolePolicies: (role: string) => api.get<ApiResponse<AdminAuthzPolicy[]>>(`/admin/authz/roles/${encodeURIComponent(role)}/policies`),
  grantAuthzPolicy: (data: { role: string; object: string; action: string }) => api.post<ApiResponse>('/admin/authz/policies', data),
  revokeAuthzPolicy: (data: { role: string; object: string; action: string }) => api.delete<ApiResponse>('/admin/authz/policies', { data }),
  getAuthzAdminRoles: (id: number) => api.get<ApiResponse<string[]>>(`/admin/authz/admins/${id}/roles`),
  setAuthzAdminRoles: (id: number, data: { roles: string[] }) => api.put<ApiResponse>(`/admin/authz/admins/${id}/roles`, data),
  upload: (formData: FormData, scene = 'common') => {
    const payload = new FormData()
    formData.forEach((value, key) => {
      payload.append(key, value)
    })
    payload.append('scene', scene)
    return api.post<ApiResponse>('/admin/upload', payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  getProducts: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminProduct[]>>('/admin/products', { params }),
  getProduct: (id: number) => api.get<ApiResponse<AdminProduct>>(`/admin/products/${id}`),
  createProduct: (data: Partial<AdminProduct>) => api.post<ApiResponse<AdminProduct>>('/admin/products', data),
  updateProduct: (id: number, data: Partial<AdminProduct>) => api.put<ApiResponse<AdminProduct>>(`/admin/products/${id}`, data),
  patchProduct: (id: number, data: { is_active?: boolean; sort_order?: number; category_id?: number }) => api.patch<ApiResponse<AdminProduct>>(`/admin/products/${id}`, data),
  deleteProduct: (id: number) => api.delete<ApiResponse>(`/admin/products/${id}`),
  getCategories: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminCategory[]>>('/admin/categories', { params }),
  createCategory: (data: Partial<AdminCategory>) => api.post<ApiResponse<AdminCategory>>('/admin/categories', data),
  updateCategory: (id: number, data: Partial<AdminCategory>) => api.put<ApiResponse<AdminCategory>>(`/admin/categories/${id}`, data),
  deleteCategory: (id: number) => api.delete<ApiResponse>(`/admin/categories/${id}`),
  getPosts: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminPost[]>>('/admin/posts', { params }),
  getPost: (id: number) => api.get<ApiResponse<AdminPost>>(`/admin/posts/${id}`),
  createPost: (data: Partial<AdminPost>) => api.post<ApiResponse<AdminPost>>('/admin/posts', data),
  updatePost: (id: number, data: Partial<AdminPost>) => api.put<ApiResponse<AdminPost>>(`/admin/posts/${id}`, data),
  deletePost: (id: number) => api.delete<ApiResponse>(`/admin/posts/${id}`),
  getBanners: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminBanner[]>>('/admin/banners', { params }),
  getBanner: (id: number) => api.get<ApiResponse<AdminBanner>>(`/admin/banners/${id}`),
  createBanner: (data: Partial<AdminBanner>) => api.post<ApiResponse<AdminBanner>>('/admin/banners', data),
  updateBanner: (id: number, data: Partial<AdminBanner>) => api.put<ApiResponse<AdminBanner>>(`/admin/banners/${id}`, data),
  deleteBanner: (id: number) => api.delete<ApiResponse>(`/admin/banners/${id}`),
  getSettings: (params?: Record<string, unknown>) => api.get<ApiResponse<Record<string, unknown>>>('/admin/settings', { params }),
  updateSettings: (data: Record<string, unknown>) => api.put<ApiResponse>('/admin/settings', data),
  getSMTPSettings: () => api.get<ApiResponse<Record<string, unknown>>>('/admin/settings/smtp'),
  updateSMTPSettings: (data: Record<string, unknown>) => api.put<ApiResponse>('/admin/settings/smtp', data),
  testSMTPSettings: (data: Record<string, unknown>) => api.post<ApiResponse>('/admin/settings/smtp/test', data),
  getCaptchaSettings: () => api.get<ApiResponse<Record<string, unknown>>>('/admin/settings/captcha'),
  updateCaptchaSettings: (data: Record<string, unknown>) => api.put<ApiResponse>('/admin/settings/captcha', data),
  getTelegramAuthSettings: () => api.get<ApiResponse<Record<string, unknown>>>('/admin/settings/telegram-auth'),
  updateTelegramAuthSettings: (data: Record<string, unknown>) => api.put<ApiResponse>('/admin/settings/telegram-auth', data),
  getOrderEmailTemplateSettings: () => api.get<ApiResponse<Record<string, unknown>>>('/admin/settings/order-email-template'),
  updateOrderEmailTemplateSettings: (data: Record<string, unknown>) => api.put<ApiResponse>('/admin/settings/order-email-template', data),
  resetOrderEmailTemplateSettings: () => api.post<ApiResponse>('/admin/settings/order-email-template/reset'),
  getNotificationCenterSettings: () => api.get<ApiResponse<Record<string, unknown>>>('/admin/settings/notification-center'),
  updateNotificationCenterSettings: (data: Record<string, unknown>) => api.put<ApiResponse>('/admin/settings/notification-center', data),
  listNotificationLogs: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminNotificationLog[]>>('/admin/settings/notification-center/logs', { params }),
  testNotificationCenterSettings: (data: Record<string, unknown>) => api.post<ApiResponse>('/admin/settings/notification-center/test', data),
  getAffiliateSettings: () => api.get<ApiResponse<AdminAffiliateSetting>>('/admin/settings/affiliate'),
  updateAffiliateSettings: (data: AdminAffiliateSetting) => api.put<ApiResponse<AdminAffiliateSetting>>('/admin/settings/affiliate', data),
  getPublicConfig: () => api.get<ApiResponse<Record<string, unknown>>>('/public/config'),
  getImageCaptcha: () => api.get<ApiResponse<{ captcha_id: string; captcha_image: string }>>('/public/captcha/image'),
  getDashboardOverview: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminDashboardOverview>>('/admin/dashboard/overview', { params }),
  getDashboardTrends: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminDashboardTrendPoint[]>>('/admin/dashboard/trends', { params }),
  getDashboardRankings: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminDashboardRanking[]>>('/admin/dashboard/rankings', { params }),
  getDashboardInventoryAlerts: () => api.get<ApiResponse<AdminDashboardInventoryAlert[]>>('/admin/dashboard/inventory-alerts'),
  updatePassword: (data: { old_password: string; new_password: string }) => api.put<ApiResponse>('/admin/password', data),
  getOrders: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminOrder[]>>('/admin/orders', { params }),
  getOrder: (id: number) => api.get<ApiResponse<AdminOrder>>(`/admin/orders/${id}`),
  updateOrderStatus: (id: number, data: { status: string }) => api.patch<ApiResponse<AdminOrder>>(`/admin/orders/${id}`, data),
  createFulfillment: (data: Partial<AdminFulfillment>) => api.post<ApiResponse<AdminFulfillment>>('/admin/fulfillments', data),
  getPayments: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminPayment[]>>('/admin/payments', { params }),
  getPayment: (id: number) => api.get<ApiResponse<AdminPayment>>(`/admin/payments/${id}`),
  exportPayments: (params?: Record<string, unknown>) => api.get('/admin/payments/export', { params, responseType: 'blob' }),
  createPaymentChannel: (data: Partial<AdminPaymentChannel>) => api.post<ApiResponse<AdminPaymentChannel>>('/admin/payment-channels', data),
  getPaymentChannels: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminPaymentChannel[]>>('/admin/payment-channels', { params }),
  getPaymentChannel: (id: number) => api.get<ApiResponse<AdminPaymentChannel>>(`/admin/payment-channels/${id}`),
  updatePaymentChannel: (id: number, data: Partial<AdminPaymentChannel>) => api.put<ApiResponse<AdminPaymentChannel>>(`/admin/payment-channels/${id}`, data),
  deletePaymentChannel: (id: number) => api.delete<ApiResponse>(`/admin/payment-channels/${id}`),
  getUsers: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminUser[]>>('/admin/users', { params }),
  getUserLoginLogs: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminUserLoginLog[]>>('/admin/user-login-logs', { params }),
  getUser: (id: number) => api.get<ApiResponse<AdminUser>>(`/admin/users/${id}`),
  getUserWallet: (id: number) => api.get<ApiResponse<{ user: AdminUser; account: AdminWalletAccount }>>(`/admin/users/${id}/wallet`),
  getUserWalletTransactions: (id: number, params?: Record<string, unknown>) =>
    api.get<ApiResponse<AdminWalletTransaction[]>>(`/admin/users/${id}/wallet/transactions`, { params }),
  getWalletRecharges: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<AdminWalletRecharge[]>>('/admin/wallet/recharges', { params }),
  adjustUserWallet: (id: number, data: AdminAdjustWalletPayload) =>
    api.post<ApiResponse<{ account: AdminWalletAccount; transaction: AdminWalletTransaction }>>(`/admin/users/${id}/wallet/adjust`, data),
  updateUser: (id: number, data: Partial<AdminUser>) => api.put<ApiResponse<AdminUser>>(`/admin/users/${id}`, data),
  batchUpdateUserStatus: (data: { user_ids: number[]; status: string }) => api.put<ApiResponse>('/admin/users/batch-status', data),
  getUserCouponUsages: (id: number, params?: Record<string, unknown>) => api.get<ApiResponse>(`/admin/users/${id}/coupon-usages`, { params }),
  getAffiliateUsers: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminAffiliateUser[]>>('/admin/affiliates/users', { params }),
  updateAffiliateUserStatus: (id: number, data: { status: string }) =>
    api.patch<ApiResponse>(`/admin/affiliates/users/${id}/status`, data),
  batchUpdateAffiliateUserStatus: (data: { profile_ids: number[]; status: string }) =>
    api.patch<ApiResponse>('/admin/affiliates/users/batch-status', data),
  getAffiliateCommissions: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminAffiliateCommission[]>>('/admin/affiliates/commissions', { params }),
  getAffiliateWithdraws: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminAffiliateWithdraw[]>>('/admin/affiliates/withdraws', { params }),
  rejectAffiliateWithdraw: (id: number, data: { reason?: string }) => api.post<ApiResponse>(`/admin/affiliates/withdraws/${id}/reject`, data),
  payAffiliateWithdraw: (id: number) => api.post<ApiResponse>(`/admin/affiliates/withdraws/${id}/pay`, {}),
  refundOrderToWallet: (id: number, data: AdminRefundToWalletPayload) =>
    api.post<ApiResponse<{ order: AdminOrder; transaction: AdminWalletTransaction }>>(`/admin/orders/${id}/refund-to-wallet`, data),
  createCoupon: (data: Partial<AdminCoupon>) => api.post<ApiResponse<AdminCoupon>>('/admin/coupons', data),
  getCoupons: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminCoupon[]>>('/admin/coupons', { params }),
  updateCoupon: (id: number, data: Partial<AdminCoupon>) => api.put<ApiResponse<AdminCoupon>>(`/admin/coupons/${id}`, data),
  deleteCoupon: (id: number) => api.delete<ApiResponse>(`/admin/coupons/${id}`),
  generateGiftCards: (data: AdminGenerateGiftCardsPayload) =>
    api.post<ApiResponse<{ batch: AdminGiftCardBatch; created: number }>>('/admin/gift-cards/generate', data),
  getGiftCards: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminGiftCard[]>>('/admin/gift-cards', { params }),
  updateGiftCard: (id: number, data: AdminUpdateGiftCardPayload) => api.put<ApiResponse>(`/admin/gift-cards/${id}`, data),
  deleteGiftCard: (id: number) => api.delete<ApiResponse>(`/admin/gift-cards/${id}`),
  batchUpdateGiftCardStatus: (data: AdminBatchGiftCardStatusPayload) =>
    api.patch<ApiResponse<{ affected: number }>>('/admin/gift-cards/batch-status', data),
  exportGiftCards: (data: AdminExportGiftCardsPayload) =>
    api.post('/admin/gift-cards/export', data, { responseType: 'blob' }),
  createPromotion: (data: Partial<AdminPromotion>) => api.post<ApiResponse<AdminPromotion>>('/admin/promotions', data),
  getPromotions: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminPromotion[]>>('/admin/promotions', { params }),
  updatePromotion: (id: number, data: Partial<AdminPromotion>) => api.put<ApiResponse<AdminPromotion>>(`/admin/promotions/${id}`, data),
  deletePromotion: (id: number) => api.delete<ApiResponse>(`/admin/promotions/${id}`),

  // 会员等级
  getMemberLevels: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminMemberLevel[]>>('/admin/member-levels', { params }),
  createMemberLevel: (data: Partial<AdminMemberLevel>) => api.post<ApiResponse<AdminMemberLevel>>('/admin/member-levels', data),
  updateMemberLevel: (id: number, data: Partial<AdminMemberLevel>) => api.put<ApiResponse<AdminMemberLevel>>(`/admin/member-levels/${id}`, data),
  deleteMemberLevel: (id: number) => api.delete<ApiResponse>(`/admin/member-levels/${id}`),
  getMemberLevelPrices: (productId: number) => api.get<ApiResponse<AdminMemberLevelPrice[]>>('/admin/member-level-prices', { params: { product_id: productId } }),
  batchUpsertMemberLevelPrices: (data: { prices: Partial<AdminMemberLevelPrice>[] }) => api.post<ApiResponse>('/admin/member-level-prices/batch', data),
  deleteMemberLevelPrice: (id: number) => api.delete<ApiResponse>(`/admin/member-level-prices/${id}`),
  setUserMemberLevel: (userId: number, memberLevelId: number) => api.put<ApiResponse>(`/admin/users/${userId}/member-level`, { member_level_id: memberLevelId }),
  backfillMemberLevels: () => api.post<ApiResponse<{ affected: number }>>('/admin/member-levels/backfill'),
  createCardSecretBatch: (data: { product_id: number; sku_id?: number; name?: string; secrets: string[]; is_selectable?: boolean; batch_no?: string; note?: string }) => api.post<ApiResponse<AdminCardSecretBatch>>('/admin/card-secrets/batch', data),
  importCardSecretCSV: (formData: FormData) =>
    api.post<ApiResponse>('/admin/card-secrets/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  getCardSecrets: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminCardSecret[]>>('/admin/card-secrets', { params }),
  updateCardSecret: (id: number, data: Partial<AdminCardSecret>) => api.put<ApiResponse<AdminCardSecret>>(`/admin/card-secrets/${id}`, data),
  batchUpdateCardSecretStatus: (data: AdminBatchCardSecretStatusPayload) =>
    api.patch<ApiResponse<{ affected: number }>>('/admin/card-secrets/batch-status', data),
  batchDeleteCardSecrets: (data: AdminBatchCardSecretDeletePayload) =>
    api.post<ApiResponse<{ affected: number }>>('/admin/card-secrets/batch-delete', data),
  exportCardSecrets: (data: AdminExportCardSecretsPayload) =>
    api.post('/admin/card-secrets/export', data, { responseType: 'blob' }),
  getCardSecretStats: (params?: Record<string, unknown>) => api.get<ApiResponse<Record<string, unknown>>>('/admin/card-secrets/stats', { params }),
  getCardSecretBatches: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminCardSecretBatch[]>>('/admin/card-secrets/batches', { params }),
  getCardSecretTemplate: () => api.get<ApiResponse<string>>('/admin/card-secrets/template'),
  // Site Connections
  getSiteConnections: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminSiteConnection[]>>('/admin/site-connections', { params }),
  getSiteConnection: (id: number) => api.get<ApiResponse<AdminSiteConnection>>(`/admin/site-connections/${id}`),
  createSiteConnection: (data: Partial<AdminSiteConnection>) => api.post<ApiResponse<AdminSiteConnection>>('/admin/site-connections', data),
  updateSiteConnection: (id: number, data: Partial<AdminSiteConnection>) => api.put<ApiResponse<AdminSiteConnection>>(`/admin/site-connections/${id}`, data),
  deleteSiteConnection: (id: number) => api.delete<ApiResponse>(`/admin/site-connections/${id}`),
  pingSiteConnection: (id: number) => api.post<ApiResponse>(`/admin/site-connections/${id}/ping`),
  updateSiteConnectionStatus: (id: number, data: { is_active?: boolean; status?: string }) => api.put<ApiResponse>(`/admin/site-connections/${id}/status`, data),
  reapplyConnectionMarkup: (id: number) => api.post<ApiResponse>(`/admin/site-connections/${id}/reapply-markup`),
  // Product Mappings
  getProductMappings: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminProductMapping[]>>('/admin/product-mappings', { params }),
  getProductMapping: (id: number) => api.get<ApiResponse<AdminProductMapping>>(`/admin/product-mappings/${id}`),
  importUpstreamProduct: (data: Record<string, unknown>) => api.post<ApiResponse<AdminProductMapping>>('/admin/product-mappings/import', data),
  batchImportUpstreamProducts: (data: Record<string, unknown>) => api.post<ApiResponse>('/admin/product-mappings/batch-import', data),
  syncProductMapping: (id: number) => api.post<ApiResponse>(`/admin/product-mappings/${id}/sync`),
  updateProductMappingStatus: (id: number, data: { is_active: boolean }) => api.put<ApiResponse>(`/admin/product-mappings/${id}/status`, data),
  deleteProductMapping: (id: number) => api.delete<ApiResponse>(`/admin/product-mappings/${id}`),
  getUpstreamProducts: (params?: Record<string, unknown>) => api.get<ApiResponse>('/admin/upstream-products', { params }),
  // Procurement Orders
  getProcurementOrders: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminProcurementOrder[]>>('/admin/procurement-orders', { params }),
  getProcurementOrder: (id: number) => api.get<ApiResponse<AdminProcurementOrder>>(`/admin/procurement-orders/${id}`),
  retryProcurementOrder: (id: number) => api.post<ApiResponse>(`/admin/procurement-orders/${id}/retry`),
  cancelProcurementOrder: (id: number) => api.post<ApiResponse>(`/admin/procurement-orders/${id}/cancel`),

  // 对账管理
  runReconciliation: (data: { connection_id: number; type: string; time_range_start: string; time_range_end: string }) => api.post<ApiResponse<AdminReconciliationJob>>('/admin/reconciliation/run', data),
  getReconciliationJobs: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminReconciliationJob[]>>('/admin/reconciliation/jobs', { params }),
  getReconciliationJob: (id: number, params?: Record<string, unknown>) => api.get<ApiResponse<AdminReconciliationJob & { items?: AdminReconciliationItem[] }>>(`/admin/reconciliation/jobs/${id}`, { params }),
  resolveReconciliationItem: (id: number, data: { resolution?: string; remark?: string }) => api.put<ApiResponse<AdminReconciliationItem>>(`/admin/reconciliation/items/${id}/resolve`, data),

  // API 凭证管理
  getApiCredentials: (params?: Record<string, unknown>) => api.get<ApiResponse<AdminApiCredential[]>>('/admin/api-credentials', { params }),
  getApiCredential: (id: number) => api.get<ApiResponse<AdminApiCredential>>(`/admin/api-credentials/${id}`),
  approveApiCredential: (id: number) => api.post<ApiResponse>(`/admin/api-credentials/${id}/approve`),
  rejectApiCredential: (id: number, data: { reason: string }) => api.post<ApiResponse>(`/admin/api-credentials/${id}/reject`, data),
  updateApiCredentialStatus: (id: number, data: { is_active: boolean }) => api.put<ApiResponse>(`/admin/api-credentials/${id}/status`, data),
  deleteApiCredential: (id: number) => api.delete<ApiResponse>(`/admin/api-credentials/${id}`),

  // Channel Clients (Bot Clients)
  getChannelClients: () => api.get<ApiResponse>('/admin/channel-clients'),
  createChannelClient: (data: { name: string; channel_type: string; description?: string; bot_token?: string; callback_url?: string }) => api.post<ApiResponse>('/admin/channel-clients', data),
  getChannelClient: (id: number) => api.get<ApiResponse>(`/admin/channel-clients/${id}`),
  updateChannelClient: (id: number, data: { name?: string; description?: string; bot_token?: string; callback_url?: string }) => api.put<ApiResponse>(`/admin/channel-clients/${id}`, data),
  updateChannelClientStatus: (id: number, data: { status: number }) => api.put<ApiResponse>(`/admin/channel-clients/${id}/status`, data),
  resetChannelClientSecret: (id: number) => api.post<ApiResponse>(`/admin/channel-clients/${id}/reset-secret`),
  deleteChannelClient: (id: number) => api.delete<ApiResponse>(`/admin/channel-clients/${id}`),

  // Telegram Bot Settings
  getTelegramBotSettings: () => api.get<ApiResponse>('/admin/settings/telegram-bot'),
  updateTelegramBotSettings: (data: Record<string, unknown>) => api.put<ApiResponse>('/admin/settings/telegram-bot', data),
  getTelegramBotRuntimeStatus: () => api.get<ApiResponse<AdminTelegramBotRuntimeStatus>>('/admin/settings/telegram-bot/runtime-status'),
  getTelegramBroadcasts: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<AdminTelegramBroadcast[]>>('/admin/telegram-bot/broadcasts', { params }),
  createTelegramBroadcast: (data: {
    title: string
    recipient_type: string
    user_ids?: number[]
    filters?: Record<string, unknown>
    attachment_url?: string
    attachment_name?: string
    message_html: string
  }) => api.post<ApiResponse<AdminTelegramBroadcast>>('/admin/telegram-bot/broadcasts', data),
  deleteTelegramBroadcast: (id: number) => api.delete<ApiResponse>(`/admin/telegram-bot/broadcasts/${id}`),
  getTelegramBroadcastUsers: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<AdminTelegramBroadcastUser[]>>('/admin/telegram-bot/users', { params }),

  // 广告代理
  renderAdSlot: (slotCode: string, params?: Record<string, string>) =>
    api.get<ApiResponse<AdRenderResponse>>(`/admin/ads/render/${slotCode}`, { params }),
  reportAdImpression: (data: { tenant: string; client: string; slot_code: string; items: { ad_id: number; impression_token: string }[] }) =>
    api.post<ApiResponse>('/admin/ads/impression', data),
}
