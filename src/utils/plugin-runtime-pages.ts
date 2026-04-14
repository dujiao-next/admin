import { adminAPI } from '@/api/admin'
import type { AdminPluginPageRegistry } from '@/api/types'

let mountedAdminPagesCache: AdminPluginPageRegistry[] | null = null
let mountedAdminPagesPromise: Promise<AdminPluginPageRegistry[]> | null = null

const normalizeRoutePath = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function invalidateMountedAdminPluginPages() {
  mountedAdminPagesCache = null
  mountedAdminPagesPromise = null
}

export async function loadMountedAdminPluginPages(force = false): Promise<AdminPluginPageRegistry[]> {
  if (!force && mountedAdminPagesCache) {
    return mountedAdminPagesCache
  }
  if (!force && mountedAdminPagesPromise) {
    return mountedAdminPagesPromise
  }
  mountedAdminPagesPromise = adminAPI.getPluginRuntimePages({ scope: 'admin' })
    .then((res: any) => {
      const data = res.data?.data
      mountedAdminPagesCache = Array.isArray(data) ? data : []
      return mountedAdminPagesCache
    })
    .catch(() => {
      mountedAdminPagesCache = []
      return mountedAdminPagesCache
    })
    .finally(() => {
      mountedAdminPagesPromise = null
    })
  return mountedAdminPagesPromise ?? []
}

export function hasMountedAdminPluginPage(routePath: string, pages?: AdminPluginPageRegistry[]) {
  const currentPages = pages ?? mountedAdminPagesCache ?? []
  const normalizedRoutePath = normalizeRoutePath(routePath)
  return currentPages.some((item) => normalizeRoutePath(item.route_path) === normalizedRoutePath)
}
