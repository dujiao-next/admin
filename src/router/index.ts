import { createRouter, createWebHistory } from 'vue-router'
import { useAdminAuthStore } from '@/stores/auth'
import { hasMountedAdminPluginPage, loadMountedAdminPluginPages } from '@/utils/plugin-runtime-pages'
import { syncMountedAdminPluginRoutes } from '@/utils/plugin-admin-pages'

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
        path: 'card-secret-imports',
        name: 'card-secret-imports',
        component: () => import('@/views/admin/CardSecretImports.vue'),
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
        path: 'order-refunds',
        name: 'order-refunds',
        component: () => import('@/views/admin/OrderRefunds.vue'),
        meta: { permission: 'GET:/admin/order-refunds' },
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
        path: 'media',
        name: 'media',
        component: () => import('@/views/admin/Media.vue'),
        meta: { permission: 'GET:/admin/media' },
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
        path: 'member-levels',
        name: 'member-levels',
        component: () => import('@/views/admin/MemberLevels.vue'),
        meta: { permission: 'GET:/admin/member-levels' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/admin/Settings.vue'),
        meta: { permission: 'GET:/admin/settings' },
      },
      {
        path: 'settings/notifications',
        name: 'notifications',
        component: () => import('@/views/admin/Notifications.vue'),
        meta: { permission: 'GET:/admin/settings/notification-center' },
      },
      {
        path: 'security',
        name: 'security',
        component: () => import('@/views/admin/Security.vue'),
      },
      {
        path: 'affiliates/settings',
        name: 'affiliates-settings',
        component: () => import('@/views/admin/AffiliateSettings.vue'),
        meta: { permission: 'GET:/admin/settings/affiliate' },
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
      {
        path: 'site-connections',
        name: 'site-connections',
        component: () => import('@/views/admin/SiteConnections.vue'),
        meta: { permission: 'GET:/admin/site-connections' },
      },
      {
        path: 'product-mappings',
        name: 'product-mappings',
        component: () => import('@/views/admin/ProductMappings.vue'),
        meta: { permission: 'GET:/admin/product-mappings' },
      },
      {
        path: 'procurement-orders',
        name: 'procurement-orders',
        component: () => import('@/views/admin/ProcurementOrders.vue'),
        meta: { permission: 'GET:/admin/procurement-orders' },
      },
      {
        path: 'reconciliation',
        name: 'reconciliation',
        component: () => import('@/views/admin/Reconciliation.vue'),
        meta: { permission: 'GET:/admin/reconciliation/jobs' },
      },
      {
        path: 'api-credentials',
        name: 'api-credentials',
        component: () => import('@/views/admin/ApiCredentials.vue'),
        meta: { permission: 'GET:/admin/api-credentials' },
      },
      {
        path: 'telegram-bot',
        name: 'telegram-bot',
        component: () => import('@/views/admin/TelegramBot.vue'),
        meta: { permission: 'GET:/admin/settings/telegram-bot' },
      },
      {
        path: 'telegram-bot/settings',
        name: 'telegram-bot-settings',
        component: () => import('@/views/admin/TelegramBotSettings.vue'),
        meta: { permission: 'GET:/admin/settings/telegram-bot' },
      },
      {
        path: 'telegram-bot/help-center',
        name: 'telegram-bot-help-center',
        component: () => import('@/views/admin/TelegramBotHelpCenter.vue'),
        meta: { permission: 'GET:/admin/settings/telegram-bot' },
      },
      {
        path: 'telegram-bot/menu',
        name: 'telegram-bot-menu-settings',
        component: () => import('@/views/admin/TelegramBotMenuSettings.vue'),
        meta: { permission: 'GET:/admin/settings/telegram-bot' },
      },
      {
        path: 'telegram-bot/status',
        name: 'telegram-bot-status',
        component: () => import('@/views/admin/TelegramBotStatus.vue'),
        meta: { permission: 'GET:/admin/settings/telegram-bot' },
      },
      {
        path: 'telegram-bot/channel-clients',
        name: 'telegram-bot-channel-clients',
        component: () => import('@/views/admin/TelegramBotChannelClients.vue'),
        meta: { permission: 'GET:/admin/channel-clients' },
      },
      {
        path: 'telegram-bot/broadcasts',
        name: 'telegram-bot-broadcasts',
        component: () => import('@/views/admin/TelegramBotBroadcasts.vue'),
        meta: { permission: 'GET:/admin/telegram-bot/broadcasts' },
      },
      {
        path: 'telegram-bot/broadcasts/create',
        name: 'telegram-bot-broadcast-create',
        component: () => import('@/views/admin/TelegramBotBroadcastCreate.vue'),
        meta: { permission: 'GET:/admin/telegram-bot/broadcasts' },
      },
      {
        path: 'telegram-bot/broadcasts/:id',
        name: 'telegram-bot-broadcast-detail',
        component: () => import('@/views/admin/TelegramBotBroadcastDetail.vue'),
        meta: { permission: 'GET:/admin/telegram-bot/broadcasts' },
      },
      {
        path: 'plugins',
        name: 'plugins',
        component: () => import('@/views/admin/Plugins.vue'),
        meta: { permission: 'GET:/admin/plugins' },
      },
      {
        path: 'plugin-market',
        name: 'plugin-market',
        component: () => import('@/views/admin/PluginMarket.vue'),
        meta: { permission: 'GET:/admin/plugin-market/registries' },
      },
      {
        path: 'plugin-market-center',
        name: 'plugin-market-center',
        component: () => import('@/views/admin/PluginMarketCenter.vue'),
        meta: { permission: 'GET:/admin/plugin-market-center/publishers' },
      },
      {
        path: 'plugin-license-center',
        name: 'plugin-license-center',
        component: () => import('@/views/admin/PluginLicenseCenter.vue'),
        meta: { permission: 'GET:/admin/plugin-license-center/licenses' },
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
  const requiresAuth = to.path !== '/login'

  if (requiresAuth && !authStore.token) {
    return { path: '/login' }
  }

  if (to.path === '/login' && authStore.token) {
    return { path: '/' }
  }

  if (requiresAuth && authStore.token && !authStore.permissionsLoaded) {
    try {
      await authStore.loadAuthz()
    } catch {
      authStore.logout()
      return { path: '/login' }
    }
  }

  let mountedPages = [] as Awaited<ReturnType<typeof loadMountedAdminPluginPages>>
  if (requiresAuth && authStore.token) {
    mountedPages = await syncMountedAdminPluginRoutes(router)
    if (to.matched.length === 0) {
      const resolved = router.resolve({
        path: to.path,
        query: to.query,
        hash: to.hash,
      })
      if (resolved.matched.length > 0) {
        return {
          path: to.path,
          query: to.query,
          hash: to.hash,
          replace: true,
        }
      }
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

  const requiredPluginPage = typeof to.meta.pluginPagePath === 'string' ? to.meta.pluginPagePath : ''
  if (requiredPluginPage) {
    const currentMountedPages = mountedPages.length > 0 ? mountedPages : await loadMountedAdminPluginPages()
    if (!hasMountedAdminPluginPage(requiredPluginPage, currentMountedPages)) {
      if (to.path !== '/forbidden') {
        return {
          path: '/forbidden',
          query: {
            from: to.fullPath,
            reason: 'plugin_page_unavailable',
          },
        }
      }
    }
  }

  return true
})

export default router
