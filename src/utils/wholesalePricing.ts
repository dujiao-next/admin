type LocalizedText = Record<string, unknown>

export type WholesaleSkuLike = {
  id?: number
  sku_code?: string
  spec_values?: LocalizedText | string | null
  price_amount?: number | string
  sort_order?: number
  is_active?: boolean
}

export type WholesaleProductLike = {
  skus?: WholesaleSkuLike[]
}

export type WholesaleTierLike = {
  sku_id?: number | string
  sku_code?: string
  min_quantity?: number | string
  unit_price?: number | string
}

export type WholesaleSkuPriceReference = {
  id: number
  label: string
  code: string
  priceAmount: number
  priceText: string
  tierApplies: boolean | null
}

type BuildSkuReferenceOptions = {
  tiers?: WholesaleTierLike[]
  locale?: string
  formatPrice: (amount: number) => string
}

type WholesaleTierScope = {
  type: 'all' | 'id' | 'code'
  id: number
  code: string
}

const normalizeText = (value: unknown) => String(value ?? '').trim()
const normalizeCode = (value: unknown) => normalizeText(value).toLowerCase()

const localeFallbacks = (locale?: string) => {
  const normalized = normalizeText(locale).toLowerCase()
  switch (normalized) {
    case 'zh-tw':
    case 'zh-hk':
    case 'zh-mo':
      return ['zh-TW', 'zh-CN', 'en-US']
    case 'en':
    case 'en-us':
      return ['en-US', 'zh-CN', 'zh-TW']
    case 'zh':
    case 'zh-cn':
    default:
      return ['zh-CN', 'zh-TW', 'en-US']
  }
}

const resolveLocalizedText = (value: unknown, locale?: string) => {
  if (!value) return ''
  if (typeof value === 'string') return normalizeText(value)
  if (typeof value !== 'object' || Array.isArray(value)) return ''
  const row = value as LocalizedText
  for (const code of localeFallbacks(locale)) {
    const text = normalizeText(row[code])
    if (text) return text
  }
  return normalizeText(Object.values(row)[0])
}

const parsePositiveNumber = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

const parsePositiveInteger = (value: unknown) => {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return parsed
}

export const listActiveWholesaleSkus = (product: WholesaleProductLike | null | undefined) => {
  const skus = Array.isArray(product?.skus) ? product.skus : []
  return skus
    .filter((sku) => sku?.is_active !== false)
    .slice()
    .sort((a, b) => {
      const orderA = Number(a.sort_order || 0)
      const orderB = Number(b.sort_order || 0)
      if (orderA !== orderB) return orderA - orderB
      return Number(a.id || 0) - Number(b.id || 0)
    })
}

const resolveWholesaleTierScope = (tier: WholesaleTierLike | null | undefined): WholesaleTierScope => {
  const rawSkuID = normalizeText(tier?.sku_id)
  if (rawSkuID === 'all') return { type: 'all', id: 0, code: '' }
  if (rawSkuID.startsWith('id:')) {
    const id = parsePositiveInteger(rawSkuID.slice(3))
    if (id > 0) return { type: 'id', id, code: '' }
  }
  if (rawSkuID.startsWith('code:')) {
    const code = normalizeText(rawSkuID.slice(5))
    if (code) return { type: 'code', id: 0, code }
  }

  const id = parsePositiveInteger(tier?.sku_id)
  if (id > 0) return { type: 'id', id, code: '' }

  const code = normalizeText(tier?.sku_code)
  if (code) return { type: 'code', id: 0, code }
  return { type: 'all', id: 0, code: '' }
}

export const wholesaleTierScopeValue = (tier: WholesaleTierLike | null | undefined) => {
  const scope = resolveWholesaleTierScope(tier)
  if (scope.type === 'id') return `id:${scope.id}`
  if (scope.type === 'code') return `code:${scope.code}`
  return 'all'
}

export const isUniversalWholesaleTier = (tier: WholesaleTierLike | null | undefined) => resolveWholesaleTierScope(tier).type === 'all'

export const wholesaleTierMatchesSku = (tier: WholesaleTierLike | null | undefined, sku: WholesaleSkuLike | null | undefined) => {
  const scope = resolveWholesaleTierScope(tier)
  if (scope.type === 'all') return true
  if (!sku) return false
  if (scope.type === 'id') return Number(sku.id || 0) === scope.id
  return normalizeCode(sku.sku_code) === normalizeCode(scope.code)
}

const hasSpecificWholesaleTier = (tiers: WholesaleTierLike[] | undefined, sku: WholesaleSkuLike) => {
  return (Array.isArray(tiers) ? tiers : []).some((tier) => !isUniversalWholesaleTier(tier) && wholesaleTierMatchesSku(tier, sku))
}

const tiersForSku = (tiers: WholesaleTierLike[] | undefined, sku: WholesaleSkuLike) => {
  const rows = Array.isArray(tiers) ? tiers : []
  const hasSpecific = hasSpecificWholesaleTier(rows, sku)
  return rows.filter((tier) => {
    if (hasSpecific) return !isUniversalWholesaleTier(tier) && wholesaleTierMatchesSku(tier, sku)
    return isUniversalWholesaleTier(tier)
  })
}

export const hasMultipleActiveWholesaleSkus = (product: WholesaleProductLike | null | undefined) => listActiveWholesaleSkus(product).length > 1

export const lowestWholesaleTierUnitPrice = (tiers: WholesaleTierLike[] | undefined) => {
  const prices = (Array.isArray(tiers) ? tiers : [])
    .map((tier) => parsePositiveNumber(tier?.unit_price))
    .filter((price): price is number => price !== null)
  if (!prices.length) return null
  return Math.min(...prices)
}

export const formatWholesaleSkuLabel = (sku: WholesaleSkuLike, locale?: string) => {
  const specText = resolveLocalizedText(sku.spec_values, locale)
  if (specText) return specText
  const code = normalizeText(sku.sku_code)
  if (code) return code
  const id = Number(sku.id || 0)
  return id > 0 ? `#${id}` : '-'
}

export const formatWholesaleTierScopeLabel = (
  product: WholesaleProductLike | null | undefined,
  tier: WholesaleTierLike | null | undefined,
  locale?: string,
  allLabel = '全部 SKU',
) => {
  const scope = resolveWholesaleTierScope(tier)
  if (scope.type === 'all') return allLabel

  const skus = listActiveWholesaleSkus(product)
  const sku = skus.find((item) => {
    if (scope.type === 'id') return Number(item.id || 0) === scope.id
    return normalizeCode(item.sku_code) === normalizeCode(scope.code)
  })
  if (sku) return formatWholesaleSkuLabel(sku, locale)
  if (scope.type === 'id') return `#${scope.id}`
  return scope.code
}

export const buildWholesaleSkuPriceReferences = (
  product: WholesaleProductLike | null | undefined,
  options: BuildSkuReferenceOptions,
): WholesaleSkuPriceReference[] => {
  return listActiveWholesaleSkus(product)
    .map((sku) => {
      const priceAmount = parsePositiveNumber(sku.price_amount)
      if (priceAmount === null) return null
      const matchedTiers = tiersForSku(options.tiers, sku)
      const lowestTierPrice = lowestWholesaleTierUnitPrice(matchedTiers)
      return {
        id: Number(sku.id || 0),
        label: formatWholesaleSkuLabel(sku, options.locale),
        code: normalizeText(sku.sku_code),
        priceAmount,
        priceText: options.formatPrice(priceAmount),
        tierApplies: lowestTierPrice === null ? null : lowestTierPrice < priceAmount,
      }
    })
    .filter((item): item is WholesaleSkuPriceReference => item !== null)
}
