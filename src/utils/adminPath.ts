interface BaseHrefDocument {
  querySelector(selector: 'base'): Pick<Element, 'getAttribute'> | null
}

const buildAdminBasePath = import.meta.env?.VITE_ADMIN_PATH || ''

export const normalizeAdminBasePath = (value?: string | null): string => {
  const path = value?.trim().replace(/^\/+|\/+$/g, '') || ''
  return path ? `/${path}` : ''
}

export const resolveAdminBasePath = (
  runtimeBasePath?: string | null,
  fallbackBasePath = buildAdminBasePath,
): string => normalizeAdminBasePath(runtimeBasePath ?? fallbackBasePath)

export const getAdminBasePath = (
  documentRef: BaseHrefDocument | undefined = typeof document === 'undefined' ? undefined : document,
  fallbackBasePath = buildAdminBasePath,
): string => resolveAdminBasePath(
  documentRef?.querySelector('base')?.getAttribute('href'),
  fallbackBasePath,
)

export const buildAdminRouteUrl = (route: string, basePath: string): string => {
  const base = normalizeAdminBasePath(basePath)
  const normalizedRoute = route.trim().replace(/^\/+/, '')

  if (!normalizedRoute) return base || '/'
  return `${base}/${normalizedRoute}`
}

export const getAdminRouteUrl = (route: string): string =>
  buildAdminRouteUrl(route, getAdminBasePath())
