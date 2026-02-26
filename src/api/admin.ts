import { api, type ApiResponse } from './client'

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
  ids: number[]
  status: 'available' | 'reserved' | 'used'
}

export interface AdminBatchCardSecretDeletePayload {
  ids: number[]
}

export interface AdminExportCardSecretsPayload {
  ids: number[]
  format: 'txt' | 'csv'
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

export const adminAPI = {
  login: (data: AdminLoginRequest) => api.post<ApiResponse<AdminLoginResponse>>('/admin/login', data),
  getAuthzMe: () => api.get<ApiResponse<AdminAuthzMeResponse>>('/admin/authz/me'),
  listAuthzRoles: () => api.get<ApiResponse<string[]>>('/admin/authz/roles'),
  listAuthzAdmins: () => api.get<ApiResponse<AdminAuthzAdmin[]>>("/admin/authz/admins"),
  createAuthzAdmin: (data: AuthzCreateAdminRequest) => api.post<ApiResponse<AdminAuthzAdmin>>("/admin/authz/admins", data),
  updateAuthzAdmin: (id: number, data: AuthzUpdateAdminRequest) => api.put<ApiResponse<AdminAuthzAdmin>>(`/admin/authz/admins/${id}`, data),
  deleteAuthzAdmin: (id: number) => api.delete<ApiResponse>(`/admin/authz/admins/${id}`),
  listAuthzAuditLogs: (params?: any) => api.get<ApiResponse<AdminAuthzAuditLog[]>>("/admin/authz/audit-logs", { params }),
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
  getProducts: (params?: any) => api.get<ApiResponse>('/admin/products', { params }),
  getProduct: (id: number) => api.get<ApiResponse>(`/admin/products/${id}`),
  createProduct: (data: any) => api.post<ApiResponse>('/admin/products', data),
  updateProduct: (id: number, data: any) => api.put<ApiResponse>(`/admin/products/${id}`, data),
  deleteProduct: (id: number) => api.delete<ApiResponse>(`/admin/products/${id}`),
  getCategories: (params?: any) => api.get<ApiResponse>('/admin/categories', { params }),
  createCategory: (data: any) => api.post<ApiResponse>('/admin/categories', data),
  updateCategory: (id: number, data: any) => api.put<ApiResponse>(`/admin/categories/${id}`, data),
  deleteCategory: (id: number) => api.delete<ApiResponse>(`/admin/categories/${id}`),
  getPosts: (params?: any) => api.get<ApiResponse>('/admin/posts', { params }),
  getPost: (id: number) => api.get<ApiResponse>(`/admin/posts/${id}`),
  createPost: (data: any) => api.post<ApiResponse>('/admin/posts', data),
  updatePost: (id: number, data: any) => api.put<ApiResponse>(`/admin/posts/${id}`, data),
  deletePost: (id: number) => api.delete<ApiResponse>(`/admin/posts/${id}`),
  getBanners: (params?: any) => api.get<ApiResponse>('/admin/banners', { params }),
  getBanner: (id: number) => api.get<ApiResponse>(`/admin/banners/${id}`),
  createBanner: (data: any) => api.post<ApiResponse>('/admin/banners', data),
  updateBanner: (id: number, data: any) => api.put<ApiResponse>(`/admin/banners/${id}`, data),
  deleteBanner: (id: number) => api.delete<ApiResponse>(`/admin/banners/${id}`),
  getSettings: (params?: any) => api.get<ApiResponse>('/admin/settings', { params }),
  updateSettings: (data: any) => api.put<ApiResponse>('/admin/settings', data),
  getSMTPSettings: () => api.get<ApiResponse>('/admin/settings/smtp'),
  updateSMTPSettings: (data: any) => api.put<ApiResponse>('/admin/settings/smtp', data),
  testSMTPSettings: (data: any) => api.post<ApiResponse>('/admin/settings/smtp/test', data),
  getCaptchaSettings: () => api.get<ApiResponse>('/admin/settings/captcha'),
  updateCaptchaSettings: (data: any) => api.put<ApiResponse>('/admin/settings/captcha', data),
  getTelegramAuthSettings: () => api.get<ApiResponse>('/admin/settings/telegram-auth'),
  updateTelegramAuthSettings: (data: any) => api.put<ApiResponse>('/admin/settings/telegram-auth', data),
  getNotificationCenterSettings: () => api.get<ApiResponse>('/admin/settings/notification-center'),
  updateNotificationCenterSettings: (data: any) => api.put<ApiResponse>('/admin/settings/notification-center', data),
  testNotificationCenterSettings: (data: any) => api.post<ApiResponse>('/admin/settings/notification-center/test', data),
  getPublicConfig: () => api.get<ApiResponse>('/public/config'),
  getImageCaptcha: () => api.get<ApiResponse>('/public/captcha/image'),
  getDashboardOverview: (params?: any) => api.get<ApiResponse>('/admin/dashboard/overview', { params }),
  getDashboardTrends: (params?: any) => api.get<ApiResponse>('/admin/dashboard/trends', { params }),
  getDashboardRankings: (params?: any) => api.get<ApiResponse>('/admin/dashboard/rankings', { params }),
  updatePassword: (data: any) => api.put<ApiResponse>('/admin/password', data),
  getOrders: (params?: any) => api.get<ApiResponse>('/admin/orders', { params }),
  getOrder: (id: number) => api.get<ApiResponse>(`/admin/orders/${id}`),
  updateOrderStatus: (id: number, data: any) => api.patch<ApiResponse>(`/admin/orders/${id}`, data),
  createFulfillment: (data: any) => api.post<ApiResponse>('/admin/fulfillments', data),
  getPayments: (params?: any) => api.get<ApiResponse>('/admin/payments', { params }),
  getPayment: (id: number) => api.get<ApiResponse>(`/admin/payments/${id}`),
  exportPayments: (params?: any) => api.get('/admin/payments/export', { params, responseType: 'blob' }),
  createPaymentChannel: (data: any) => api.post<ApiResponse>('/admin/payment-channels', data),
  getPaymentChannels: (params?: any) => api.get<ApiResponse>('/admin/payment-channels', { params }),
  getPaymentChannel: (id: number) => api.get<ApiResponse>(`/admin/payment-channels/${id}`),
  updatePaymentChannel: (id: number, data: any) => api.put<ApiResponse>(`/admin/payment-channels/${id}`, data),
  deletePaymentChannel: (id: number) => api.delete<ApiResponse>(`/admin/payment-channels/${id}`),
  getUsers: (params?: any) => api.get<ApiResponse>('/admin/users', { params }),
  getUserLoginLogs: (params?: any) => api.get<ApiResponse>('/admin/user-login-logs', { params }),
  getUser: (id: number) => api.get<ApiResponse>(`/admin/users/${id}`),
  getUserWallet: (id: number) => api.get<ApiResponse<{ user: any; account: AdminWalletAccount }>>(`/admin/users/${id}/wallet`),
  getUserWalletTransactions: (id: number, params?: any) =>
    api.get<ApiResponse<AdminWalletTransaction[]>>(`/admin/users/${id}/wallet/transactions`, { params }),
  getWalletRecharges: (params?: any) =>
    api.get<ApiResponse<AdminWalletRecharge[]>>('/admin/wallet/recharges', { params }),
  adjustUserWallet: (id: number, data: AdminAdjustWalletPayload) =>
    api.post<ApiResponse<{ account: AdminWalletAccount; transaction: AdminWalletTransaction }>>(`/admin/users/${id}/wallet/adjust`, data),
  updateUser: (id: number, data: any) => api.put<ApiResponse>(`/admin/users/${id}`, data),
  batchUpdateUserStatus: (data: any) => api.put<ApiResponse>('/admin/users/batch-status', data),
  getUserCouponUsages: (id: number, params?: any) => api.get<ApiResponse>(`/admin/users/${id}/coupon-usages`, { params }),
  refundOrderToWallet: (id: number, data: AdminRefundToWalletPayload) =>
    api.post<ApiResponse<{ order: any; transaction: AdminWalletTransaction }>>(`/admin/orders/${id}/refund-to-wallet`, data),
  createCoupon: (data: any) => api.post<ApiResponse>('/admin/coupons', data),
  getCoupons: (params?: any) => api.get<ApiResponse>('/admin/coupons', { params }),
  updateCoupon: (id: number, data: any) => api.put<ApiResponse>(`/admin/coupons/${id}`, data),
  deleteCoupon: (id: number) => api.delete<ApiResponse>(`/admin/coupons/${id}`),
  generateGiftCards: (data: AdminGenerateGiftCardsPayload) =>
    api.post<ApiResponse<{ batch: any; created: number }>>('/admin/gift-cards/generate', data),
  getGiftCards: (params?: any) => api.get<ApiResponse<any[]>>('/admin/gift-cards', { params }),
  updateGiftCard: (id: number, data: AdminUpdateGiftCardPayload) => api.put<ApiResponse>(`/admin/gift-cards/${id}`, data),
  deleteGiftCard: (id: number) => api.delete<ApiResponse>(`/admin/gift-cards/${id}`),
  batchUpdateGiftCardStatus: (data: AdminBatchGiftCardStatusPayload) =>
    api.patch<ApiResponse<{ affected: number }>>('/admin/gift-cards/batch-status', data),
  exportGiftCards: (data: AdminExportGiftCardsPayload) =>
    api.post('/admin/gift-cards/export', data, { responseType: 'blob' }),
  createPromotion: (data: any) => api.post<ApiResponse>('/admin/promotions', data),
  getPromotions: (params?: any) => api.get<ApiResponse>('/admin/promotions', { params }),
  updatePromotion: (id: number, data: any) => api.put<ApiResponse>(`/admin/promotions/${id}`, data),
  deletePromotion: (id: number) => api.delete<ApiResponse>(`/admin/promotions/${id}`),
  createCardSecretBatch: (data: any) => api.post<ApiResponse>('/admin/card-secrets/batch', data),
  importCardSecretCSV: (formData: FormData) =>
    api.post<ApiResponse>('/admin/card-secrets/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  getCardSecrets: (params?: any) => api.get<ApiResponse>('/admin/card-secrets', { params }),
  updateCardSecret: (id: number, data: any) => api.put<ApiResponse>(`/admin/card-secrets/${id}`, data),
  batchUpdateCardSecretStatus: (data: AdminBatchCardSecretStatusPayload) =>
    api.patch<ApiResponse<{ affected: number }>>('/admin/card-secrets/batch-status', data),
  batchDeleteCardSecrets: (data: AdminBatchCardSecretDeletePayload) =>
    api.post<ApiResponse<{ affected: number }>>('/admin/card-secrets/batch-delete', data),
  exportCardSecrets: (data: AdminExportCardSecretsPayload) =>
    api.post('/admin/card-secrets/export', data, { responseType: 'blob' }),
  getCardSecretStats: (params?: any) => api.get<ApiResponse>('/admin/card-secrets/stats', { params }),
  getCardSecretBatches: (params?: any) => api.get<ApiResponse>('/admin/card-secrets/batches', { params }),
  getCardSecretTemplate: () => api.get<ApiResponse>('/admin/card-secrets/template'),
}
