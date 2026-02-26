<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterView, RouterLink } from 'vue-router'
import {
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  CreditCard,
  Package,
  Users,
  FileText,
  BadgePercent,
  Settings,
  FolderTree,
  Boxes,
  KeyRound,
  ListOrdered,
  WalletCards,
  ReceiptText,
  UserRound,
  Wallet,
  History,
  Images,
  Newspaper,
  Ticket,
  Gift,
  SlidersHorizontal,
  ShieldCheck,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAdminAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'

interface NavGroupItem {
  label: string
  to: string
  permission?: string
  icon?: any
}

interface NavGroup {
  id: string
  label: string
  icon: any
  items: NavGroupItem[]
}

const NAV_GROUP_EXPANDED_STORAGE_KEY = 'admin_nav_group_expanded'

const readExpandedGroups = () => {
  if (typeof window === 'undefined') {
    return {}
  }
  const raw = localStorage.getItem(NAV_GROUP_EXPANDED_STORAGE_KEY)
  if (!raw) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }
    const result: Record<string, boolean> = {}
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        result[key] = value
      }
    })
    return result
  } catch {
    return {}
  }
}

const { t, locale } = useI18n()
const route = useRoute()
const authStore = useAdminAuthStore()
const isDark = ref(false)
const navSearch = ref('')
const expandedGroups = ref<Record<string, boolean>>(readExpandedGroups())

const navGroups = computed<NavGroup[]>(() => {
  const groups: NavGroup[] = [
    {
      id: 'products',
      label: t('admin.navGroups.productManagement'),
      icon: Package,
      items: [
        {
          label: t('admin.navItems.productCategories'),
          to: '/categories',
          icon: FolderTree,
          permission: 'GET:/admin/categories',
        },
        {
          label: t('admin.navItems.productList'),
          to: '/products',
          icon: Boxes,
          permission: 'GET:/admin/products',
        },
        {
          label: t('admin.navItems.cardSecrets'),
          to: '/card-secrets',
          icon: KeyRound,
          permission: 'GET:/admin/card-secrets',
        },
      ],
    },
    {
      id: 'orders',
      label: t('admin.navGroups.orderManagement'),
      icon: ShoppingBag,
      items: [
        {
          label: t('admin.navItems.orderList'),
          to: '/orders',
          icon: ListOrdered,
          permission: 'GET:/admin/orders',
        },
      ],
    },
    {
      id: 'payments',
      label: t('admin.navGroups.paymentManagement'),
      icon: CreditCard,
      items: [
        {
          label: t('admin.navItems.paymentChannels'),
          to: '/payment-channels',
          icon: WalletCards,
          permission: 'GET:/admin/payment-channels',
        },
        {
          label: t('admin.navItems.payments'),
          to: '/payments',
          icon: ReceiptText,
          permission: 'GET:/admin/payments',
        },
      ],
    },
    {
      id: 'users',
      label: t('admin.navGroups.userManagement'),
      icon: Users,
      items: [
        {
          label: t('admin.navItems.userList'),
          to: '/users',
          icon: UserRound,
          permission: 'GET:/admin/users',
        },
        {
          label: t('admin.navItems.walletManagement'),
          to: '/wallet-recharges',
          icon: Wallet,
          permission: 'GET:/admin/wallet/recharges',
        },
        {
          label: t('admin.navItems.userLoginLogs'),
          to: '/user-login-logs',
          icon: History,
          permission: 'GET:/admin/user-login-logs',
        },
      ],
    },
    {
      id: 'content',
      label: t('admin.navGroups.contentManagement'),
      icon: FileText,
      items: [
        {
          label: t('admin.navItems.banners'),
          to: '/banners',
          icon: Images,
          permission: 'GET:/admin/banners',
        },
        {
          label: t('admin.navItems.posts'),
          to: '/posts',
          icon: Newspaper,
          permission: 'GET:/admin/posts',
        },
      ],
    },
    {
      id: 'marketing',
      label: t('admin.navGroups.marketingManagement'),
      icon: BadgePercent,
      items: [
        {
          label: t('admin.navItems.coupons'),
          to: '/coupons',
          icon: Ticket,
          permission: 'GET:/admin/coupons',
        },
        {
          label: t('admin.navItems.promotions'),
          to: '/promotions',
          icon: BadgePercent,
          permission: 'GET:/admin/promotions',
        },
        {
          label: t('admin.navItems.giftCards'),
          to: '/gift-cards',
          icon: Gift,
          permission: 'GET:/admin/gift-cards',
        },
      ],
    },
    {
      id: 'system',
      label: t('admin.navGroups.systemSettings'),
      icon: Settings,
      items: [
        {
          label: t('admin.navItems.siteSettings'),
          to: '/settings',
          icon: SlidersHorizontal,
          permission: 'GET:/admin/settings',
        },
        {
          label: t('admin.navItems.authz'),
          to: '/authz',
          icon: ShieldCheck,
          permission: 'GET:/admin/authz/roles',
        },
        {
          label: t('admin.navItems.authzAudit'),
          to: '/authz-audit-logs',
          icon: ScrollText,
          permission: 'GET:/admin/authz/audit-logs',
        },
      ],
    },
  ]

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => authStore.hasPermission(item.permission)),
    }))
    .filter((group) => group.items.length > 0)
})

watch(
  navGroups,
  (groups) => {
    const next: Record<string, boolean> = {}
    groups.forEach((group) => {
      next[group.id] = expandedGroups.value[group.id] ?? true
    })
    expandedGroups.value = next
  },
  { immediate: true }
)

watch(
  expandedGroups,
  (value) => {
    if (typeof window === 'undefined') {
      return
    }
    localStorage.setItem(NAV_GROUP_EXPANDED_STORAGE_KEY, JSON.stringify(value))
  },
  { deep: true }
)

const normalizedSearch = computed(() => navSearch.value.trim().toLowerCase())
const dashboardNavLabel = computed(() => t('admin.navItems.dashboard'))

const showDashboardNav = computed(() => {
  const keyword = normalizedSearch.value
  if (!keyword) {
    return true
  }
  const label = dashboardNavLabel.value.toLowerCase()
  const groupLabel = t('admin.navGroups.dashboard').toLowerCase()
  return label.includes(keyword) || groupLabel.includes(keyword)
})

const filteredNavGroups = computed<NavGroup[]>(() => {
  const keyword = normalizedSearch.value
  if (!keyword) {
    return navGroups.value
  }
  const result: NavGroup[] = []
  navGroups.value.forEach((group) => {
    const groupMatched = group.label.toLowerCase().includes(keyword)
    const matchedItems = groupMatched
      ? group.items
      : group.items.filter((item) => item.label.toLowerCase().includes(keyword))
    if (matchedItems.length > 0) {
      result.push({
        ...group,
        items: matchedItems,
      })
    }
  })
  return result
})

const isGroupExpanded = (groupID: string) => {
  if (normalizedSearch.value) {
    return true
  }
  return expandedGroups.value[groupID] !== false
}

const toggleGroup = (groupID: string) => {
  expandedGroups.value[groupID] = !isGroupExpanded(groupID)
}

const isItemActive = (to: string) => {
  if (to === '/') {
    return route.path === '/'
  }
  return route.path === to || route.path.startsWith(`${to}/`)
}

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
        <div class="px-3 pb-2">
          <Input
            v-model="navSearch"
            class="h-8 text-xs"
            :placeholder="t('admin.navSearch.placeholder')"
          />
        </div>
        <nav class="px-3 pb-3 space-y-2 flex-1 overflow-y-auto">
          <RouterLink
            v-if="showDashboardNav"
            to="/"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
            :class="isItemActive('/') ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'"
          >
            <LayoutDashboard class="h-4 w-4 shrink-0" />
            <span>{{ dashboardNavLabel }}</span>
          </RouterLink>
          <div
            v-if="!showDashboardNav && filteredNavGroups.length === 0"
            class="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground"
          >
            {{ t('admin.navSearch.empty') }}
          </div>
          <div v-for="group in filteredNavGroups" :key="group.id" class="space-y-1">
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary/70"
              :class="isGroupExpanded(group.id) ? 'bg-secondary/40 text-foreground' : 'text-foreground'"
              @click="toggleGroup(group.id)"
            >
              <div class="flex min-w-0 items-center gap-3">
                <component :is="group.icon" class="h-4 w-4 shrink-0" />
                <span class="truncate">{{ group.label }}</span>
              </div>
              <component
                :is="isGroupExpanded(group.id) ? ChevronDown : ChevronRight"
                class="h-4 w-4 shrink-0 text-muted-foreground"
              />
            </button>
            <div v-show="isGroupExpanded(group.id)" class="space-y-1 pl-9">
              <RouterLink
                v-for="item in group.items"
                :key="`${group.id}-${item.to}`"
                :to="item.to"
                class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
                :class="isItemActive(item.to) ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'"
              >
                <component v-if="item.icon" :is="item.icon" class="h-3.5 w-3.5 shrink-0" />
                <span class="truncate">{{ item.label }}</span>
              </RouterLink>
            </div>
          </div>
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
