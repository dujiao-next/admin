<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, RouterView, RouterLink } from 'vue-router'
import {
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  CreditCard,
  WalletCards,
  Package,
  Folder,
  KeyRound,
  Gift,
  Users,
  History,
  FileText,
  Images,
  Ticket,
  BadgePercent,
  Settings,
  ShieldCheck,
  ScrollText,
  Sun,
  Moon,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAdminAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'

interface NavItem {
  label: string
  icon: any
  to: string
  permission?: string
}

const { t, locale } = useI18n()

const authzNavLabel = computed(() => {
  if (locale.value === "zh-TW") return "權限管理"
  if (locale.value === "en-US") return "Access Control"
  return "权限管理"
})

const authzAuditNavLabel = computed(() => {
  if (locale.value === "zh-TW") return "權限審計"
  if (locale.value === "en-US") return "Permission Audit"
  return "权限审计"
})
const route = useRoute()
const authStore = useAdminAuthStore()
const isDark = ref(false)

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    {
      label: t('admin.nav.dashboard'),
      icon: LayoutDashboard,
      to: '/',
    },
    {
      label: t('admin.nav.products'),
      icon: Package,
      to: '/products',
      permission: 'GET:/admin/products',
    },
    {
      label: t('admin.nav.categories'),
      icon: Folder,
      to: '/categories',
      permission: 'GET:/admin/categories',
    },
    {
      label: t('admin.nav.cardSecrets'),
      icon: KeyRound,
      to: '/card-secrets',
      permission: 'GET:/admin/card-secrets',
    },
    {
      label: t('admin.nav.giftCards'),
      icon: Gift,
      to: '/gift-cards',
      permission: 'GET:/admin/gift-cards',
    },
    {
      label: t('admin.nav.orders'),
      icon: ShoppingBag,
      to: '/orders',
      permission: 'GET:/admin/orders',
    },
    {
      label: t('admin.nav.payments'),
      icon: CreditCard,
      to: '/payments',
      permission: 'GET:/admin/payments',
    },
    {
      label: t('admin.nav.paymentChannels'),
      icon: WalletCards,
      to: '/payment-channels',
      permission: 'GET:/admin/payment-channels',
    },
    {
      label: t('admin.nav.users'),
      icon: Users,
      to: '/users',
      permission: 'GET:/admin/users',
    },
    {
      label: t('admin.nav.userLoginLogs'),
      icon: History,
      to: '/user-login-logs',
      permission: 'GET:/admin/user-login-logs',
    },
    {
      label: t('admin.nav.posts'),
      icon: FileText,
      to: '/posts',
      permission: 'GET:/admin/posts',
    },
    {
      label: t('admin.nav.banners'),
      icon: Images,
      to: '/banners',
      permission: 'GET:/admin/banners',
    },
    {
      label: t('admin.nav.coupons'),
      icon: Ticket,
      to: '/coupons',
      permission: 'GET:/admin/coupons',
    },
    {
      label: t('admin.nav.promotions'),
      icon: BadgePercent,
      to: '/promotions',
      permission: 'GET:/admin/promotions',
    },
    {
      label: t('admin.nav.settings'),
      icon: Settings,
      to: '/settings',
      permission: 'GET:/admin/settings',
    },
    {
      label: authzNavLabel.value,
      icon: ShieldCheck,
      to: '/authz',
      permission: 'GET:/admin/authz/roles',
    },
    {
      label: authzAuditNavLabel.value,
      icon: ScrollText,
      to: '/authz-audit-logs',
      permission: 'GET:/admin/authz/audit-logs',
    },
  ]

  return items.filter((item) => authStore.hasPermission(item.permission))
})

const applyTheme = (theme: 'light' | 'dark') => {
  isDark.value = theme === 'dark'
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  localStorage.setItem('admin_theme', theme)
}

const toggleTheme = () => {
  applyTheme(isDark.value ? 'light' : 'dark')
}

const applyLocale = (value: string) => {
  locale.value = value
  localStorage.setItem('admin_locale', value)
}

const handleLogout = () => {
  authStore.logout()
  window.location.href = '/login'
}

onMounted(() => {
  const savedTheme = localStorage.getItem('admin_theme')
  if (savedTheme === 'light' || savedTheme === 'dark') {
    applyTheme(savedTheme)
  } else {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark ? 'dark' : 'light')
  }

  const savedLocale = localStorage.getItem('admin_locale')
  if (savedLocale) {
    applyLocale(savedLocale)
  }
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <div class="flex min-h-screen">
      <aside class="w-64 border-r border-border bg-card flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div class="px-6 py-6">
          <div class="text-xl font-semibold tracking-tight">
            {{ t('admin.brand') }}
          </div>
          <div class="text-xs text-muted-foreground mt-1">{{ t('admin.layout.controlRoom') }}</div>
        </div>
        <nav class="px-3 space-y-1 flex-1 overflow-y-auto">
          <RouterLink
            v-for="item in navItems"
            :key="item.label"
            :to="item.to"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
            :class="route.path === item.to ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'"
          >
            <component :is="item.icon" class="h-4 w-4" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>
        <div class="px-6 py-4 border-t border-border text-[11px] text-muted-foreground space-y-1">
          <p>© {{ new Date().getFullYear() }} Dujiao-Next</p>
          <a
            href="https://github.com/dujiao-next"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.648.5.5 5.648.5 12c0 5.084 3.292 9.4 7.86 10.922.575.106.784-.25.784-.556 0-.273-.01-1-.016-1.962-3.197.694-3.872-1.54-3.872-1.54-.522-1.326-1.274-1.678-1.274-1.678-1.042-.713.079-.699.079-.699 1.152.081 1.758 1.183 1.758 1.183 1.024 1.755 2.688 1.248 3.343.954.104-.742.401-1.248.73-1.535-2.552-.29-5.236-1.276-5.236-5.678 0-1.254.448-2.28 1.182-3.084-.118-.29-.512-1.457.112-3.04 0 0 .964-.308 3.158 1.178a10.98 10.98 0 0 1 2.876-.387c.976.004 1.96.132 2.878.387 2.192-1.486 3.154-1.178 3.154-1.178.626 1.583.232 2.75.114 3.04.736.804 1.18 1.83 1.18 3.084 0 4.413-2.688 5.384-5.248 5.668.412.354.78 1.052.78 2.12 0 1.53-.014 2.764-.014 3.14 0 .31.206.668.79.554C20.212 21.396 23.5 17.083 23.5 12 23.5 5.648 18.352.5 12 .5Z" />
            </svg>
            <span>https://github.com/dujiao-next</span>
          </a>
        </div>
      </aside>

      <div class="flex-1">
        <header class="flex items-center justify-between border-b border-border bg-background px-8 py-4">
          <div class="text-sm text-muted-foreground">{{ t('admin.layout.workspace') }}</div>
          <div class="flex items-center gap-2">
            <Select
              :model-value="locale"
              @update:modelValue="(value) => { if (value) applyLocale(String(value)) }"
            >
              <SelectTrigger class="h-8 w-[140px] text-xs">
                <SelectValue :placeholder="t('admin.common.lang.zhCN')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">{{ t('admin.common.lang.zhCN') }}</SelectItem>
                <SelectItem value="zh-TW">{{ t('admin.common.lang.zhTW') }}</SelectItem>
                <SelectItem value="en-US">{{ t('admin.common.lang.enUS') }}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon-sm" variant="outline" @click="toggleTheme">
              <Sun v-if="isDark" class="h-4 w-4" />
              <Moon v-else class="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" class="gap-2" @click="handleLogout">
              <LogOut class="h-4 w-4" />
              {{ t('admin.common.logout') }}
            </Button>
          </div>
        </header>
        <main class="px-8 py-6">
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>
