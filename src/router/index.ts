import { createRouter, createWebHistory } from 'vue-router'
import { useAdminAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
  },
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard-home',
        component: () => import('@/views/Dashboard.vue'),
      },
      {
        path: 'forbidden',
        name: 'forbidden',
        component: () => import('@/views/Forbidden.vue'),
      },
      {
        path: 'products',
        name: 'products',
        component: () => import('@/views/admin/Products.vue'),
        meta: { permission: 'GET:/admin/products' },
      },
      {
        path: 'categories',
        name: 'categories',
        component: () => import('@/views/admin/Categories.vue'),
        meta: { permission: 'GET:/admin/categories' },
      },
      {
        path: 'card-secrets',
        name: 'card-secrets',
        component: () => import('@/views/admin/CardSecrets.vue'),
        meta: { permission: 'GET:/admin/card-secrets' },
      },
      {
        path: 'gift-cards',
        name: 'gift-cards',
        component: () => import('@/views/admin/GiftCards.vue'),
        meta: { permission: 'GET:/admin/gift-cards' },
      },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/admin/Orders.vue'),
        meta: { permission: 'GET:/admin/orders' },
      },
      {
        path: 'payments',
        name: 'payments',
        component: () => import('@/views/admin/Payments.vue'),
        meta: { permission: 'GET:/admin/payments' },
      },
      {
        path: 'wallet-recharges',
        name: 'wallet-recharges',
        component: () => import('@/views/admin/WalletRecharges.vue'),
        meta: { permission: 'GET:/admin/wallet/recharges' },
      },
      {
        path: 'payment-channels',
        name: 'payment-channels',
        component: () => import('@/views/admin/PaymentChannels.vue'),
        meta: { permission: 'GET:/admin/payment-channels' },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/admin/Users.vue'),
        meta: { permission: 'GET:/admin/users' },
      },
      {
        path: 'user-login-logs',
        name: 'user-login-logs',
        component: () => import('@/views/admin/UserLoginLogs.vue'),
        meta: { permission: 'GET:/admin/user-login-logs' },
      },
      {
        path: 'users/:id',
        name: 'user-detail',
        component: () => import('@/views/admin/UserDetail.vue'),
        meta: { permission: 'GET:/admin/users/:id' },
      },
      {
        path: 'posts',
        name: 'posts',
        component: () => import('@/views/admin/Posts.vue'),
        meta: { permission: 'GET:/admin/posts' },
      },
      {
        path: 'banners',
        name: 'banners',
        component: () => import('@/views/admin/Banners.vue'),
        meta: { permission: 'GET:/admin/banners' },
      },
      {
        path: 'coupons',
        name: 'coupons',
        component: () => import('@/views/admin/Coupons.vue'),
        meta: { permission: 'GET:/admin/coupons' },
      },
      {
        path: 'promotions',
        name: 'promotions',
        component: () => import('@/views/admin/Promotions.vue'),
        meta: { permission: 'GET:/admin/promotions' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/admin/Settings.vue'),
        meta: { permission: 'GET:/admin/settings' },
      },
      {
        path: 'affiliates/users',
        name: 'affiliates-users',
        component: () => import('@/views/admin/AffiliateUsers.vue'),
        meta: { permission: 'GET:/admin/affiliates/users' },
      },
      {
        path: 'affiliates/commissions',
        name: 'affiliates-commissions',
        component: () => import('@/views/admin/AffiliateCommissions.vue'),
        meta: { permission: 'GET:/admin/affiliates/commissions' },
      },
      {
        path: 'affiliates/withdraws',
        name: 'affiliates-withdraws',
        component: () => import('@/views/admin/AffiliateWithdraws.vue'),
        meta: { permission: 'GET:/admin/affiliates/withdraws' },
      },
      {
        path: 'authz',
        name: 'authz',
        component: () => import('@/views/admin/Authz.vue'),
        meta: { permission: 'GET:/admin/authz/roles' },
      },
      {
        path: 'authz-audit-logs',
        name: 'authz-audit-logs',
        component: () => import('@/views/admin/AuthzAuditLogs.vue'),
        meta: { permission: 'GET:/admin/authz/audit-logs' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const authStore = useAdminAuthStore()

  if (to.meta.requiresAuth && !authStore.token) {
    return { path: '/login' }
  }

  if (to.path === '/login' && authStore.token) {
    return { path: '/' }
  }

  if (to.meta.requiresAuth && authStore.token && !authStore.permissionsLoaded) {
    try {
      await authStore.loadAuthz()
    } catch {
      authStore.logout()
      return { path: '/login' }
    }
  }

  const requiredPermission = typeof to.meta.permission === 'string' ? to.meta.permission : ''
  if (requiredPermission && !authStore.hasPermission(requiredPermission)) {
    if (to.path !== '/forbidden') {
      return {
        path: '/forbidden',
        query: {
          from: to.fullPath,
        },
      }
    }
  }

  return true
})

export default router
