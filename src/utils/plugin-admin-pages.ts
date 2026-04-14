import { KeyRound, Layers3, ListOrdered, ScrollText } from 'lucide-vue-next'
import type { RouteRecordRaw, Router } from 'vue-router'

import type { AdminPluginPageRegistry } from '@/api/types'

import { loadMountedAdminPluginPages } from './plugin-runtime-pages'

export interface PluginAdminNavItem {
  label: string
  to: string
  permission?: string
  icon?: any
}

export interface PluginAdminNavGroup {
  id: string
  label: string
  icon: any
  items: PluginAdminNavItem[]
  sortOrder: number
}

interface PluginAdminPageMeta {
  routeName: string
  viewKey: string
  permission: string
  navGroupID: string
  navGroupLabel: string
  navGroupLabelI18nKey: string
  navGroupIconKey: string
  navGroupSort: number
  navHidden: boolean
  navLabel: string
  navLabelI18nKey: string
  navIconKey: string
}

const pluginAdminComponentLoaders: Record<string, () => Promise<any>> = {
  plugin_runtime_placeholder: () => import('@/views/admin/PluginRuntimePage.vue'),
}

const iconMap: Record<string, any> = {
  keyround: KeyRound,
  layers3: Layers3,
  listordered: ListOrdered,
  scrolltext: ScrollText,
}

let registeredPluginRouteNames = new Set<string>()

const normalizeRoutePath = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

const normalizeIconKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')

const readObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

const readString = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

const readBool = (record: Record<string, unknown>, key: string) => record[key] === true

const readNumber = (record: Record<string, unknown>, key: string, fallback: number) => {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const fallbackRouteName = (page: AdminPluginPageRegistry) => {
  const normalized = normalizeRoutePath(page.route_path)
    .slice(1)
    .replace(/[:/]+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
  const suffix = normalized || 'root'
  return `plugin-admin-${page.plugin_id}-${suffix}`
}

const resolveRouteName = (page: AdminPluginPageRegistry, routeName: string) => {
  const suffix = routeName || fallbackRouteName(page)
  return `plugin:${page.plugin_id}:${suffix}`
}

const resolveIcon = (iconKey: string, fallback: any = Layers3) => {
  if (!iconKey) {
    return fallback
  }
  return iconMap[normalizeIconKey(iconKey)] || fallback
}

const resolveText = (i18nKey: string, fallback: string, translate: (key: string) => string) => {
  if (i18nKey) {
    const translated = translate(i18nKey)
    if (translated && translated !== i18nKey) {
      return translated
    }
  }
  return fallback
}

export function readPluginAdminPageMeta(page: AdminPluginPageRegistry): PluginAdminPageMeta {
  const meta = readObject(page.meta)
  return {
    routeName: resolveRouteName(page, readString(meta, 'route_name')),
    viewKey: readString(meta, 'view_key') || 'plugin_runtime_placeholder',
    permission: readString(meta, 'permission'),
    navGroupID: readString(meta, 'nav_group_id') || `plugin:${page.plugin_id}`,
    navGroupLabel: readString(meta, 'nav_group_label') || page.plugin_id,
    navGroupLabelI18nKey: readString(meta, 'nav_group_label_i18n_key'),
    navGroupIconKey: readString(meta, 'nav_group_icon'),
    navGroupSort: readNumber(meta, 'nav_group_sort', 500),
    navHidden: readBool(meta, 'nav_hidden'),
    navLabel: readString(meta, 'nav_label') || page.title || normalizeRoutePath(page.route_path),
    navLabelI18nKey: readString(meta, 'nav_label_i18n_key'),
    navIconKey: readString(meta, 'nav_icon'),
  }
}

function buildPluginAdminRouteRecord(page: AdminPluginPageRegistry): RouteRecordRaw {
  const pageMeta = readPluginAdminPageMeta(page)
  const loader = pluginAdminComponentLoaders[pageMeta.viewKey] || pluginAdminComponentLoaders.plugin_runtime_placeholder

  return {
    path: normalizeRoutePath(page.route_path).slice(1),
    name: pageMeta.routeName,
    component: loader,
    meta: {
      permission: pageMeta.permission,
      pluginPagePath: normalizeRoutePath(page.route_path),
      pluginId: page.plugin_id,
      pluginTitle: page.title,
      pluginMeta: page.meta,
      pluginRuntimePage: true,
    },
  } as RouteRecordRaw
}

export function syncPluginAdminRoutes(router: Router, pages: AdminPluginPageRegistry[]) {
  const nextRouteNames = new Set<string>()
  const sortedPages = [...pages].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order
    }
    return normalizeRoutePath(left.route_path).localeCompare(normalizeRoutePath(right.route_path))
  })

  sortedPages.forEach((page) => {
    const record = buildPluginAdminRouteRecord(page)
    const routeName = String(record.name)
    nextRouteNames.add(routeName)
    if (router.hasRoute(routeName)) {
      router.removeRoute(routeName)
    }
    router.addRoute('dashboard', record)
  })

  Array.from(registeredPluginRouteNames).forEach((routeName) => {
    if (!nextRouteNames.has(routeName) && router.hasRoute(routeName)) {
      router.removeRoute(routeName)
    }
  })

  registeredPluginRouteNames = nextRouteNames
}

export async function syncMountedAdminPluginRoutes(router: Router, force = false) {
  const pages = await loadMountedAdminPluginPages(force)
  syncPluginAdminRoutes(router, pages)
  return pages
}

export function buildPluginAdminNavGroups(
  pages: AdminPluginPageRegistry[],
  translate: (key: string) => string,
  hasPermission: (permission?: string) => boolean,
): PluginAdminNavGroup[] {
  const groupMap = new Map<string, PluginAdminNavGroup>()
  const sortedPages = [...pages].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order
    }
    return normalizeRoutePath(left.route_path).localeCompare(normalizeRoutePath(right.route_path))
  })

  sortedPages.forEach((page) => {
    const pageMeta = readPluginAdminPageMeta(page)
    if (pageMeta.navHidden || !hasPermission(pageMeta.permission)) {
      return
    }
    if (!groupMap.has(pageMeta.navGroupID)) {
      groupMap.set(pageMeta.navGroupID, {
        id: pageMeta.navGroupID,
        label: resolveText(pageMeta.navGroupLabelI18nKey, pageMeta.navGroupLabel, translate),
        icon: resolveIcon(pageMeta.navGroupIconKey),
        items: [],
        sortOrder: pageMeta.navGroupSort,
      })
    }
    const group = groupMap.get(pageMeta.navGroupID)
    if (!group) {
      return
    }
    group.items.push({
      label: resolveText(pageMeta.navLabelI18nKey, pageMeta.navLabel, translate),
      to: normalizeRoutePath(page.route_path),
      permission: pageMeta.permission,
      icon: resolveIcon(pageMeta.navIconKey, group.icon),
    })
  })

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((left, right) => left.to.localeCompare(right.to)),
    }))
    .filter((group) => group.items.length > 0)
    .sort((left, right) => left.sortOrder - right.sortOrder)
}
