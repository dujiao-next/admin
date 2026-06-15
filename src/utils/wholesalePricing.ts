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

const normalizeText = (value: unknown) => String(value ?? '').trim()

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

const activeSkus = (product: WholesaleProductLike | null | undefined) => {
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

export const hasMultipleActiveWholesaleSkus = (product: WholesaleProductLike | null | undefined) => activeSkus(product).length > 1

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

const normalizeSkuId = (value: unknown) => {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  const integer = Math.floor(parsed)
  return integer > 0 ? integer : 0
}

const normalizeSkuCode = (value: unknown) => normalizeText(value).toLowerCase()

export const isUniversalWholesaleTier = (tier: WholesaleTierLike | null | undefined) => {
  return normalizeSkuId(tier?.sku_id) <= 0 && normalizeSkuCode(tier?.sku_code) === ''
}

export const wholesaleTierMatchesSku = (tier: WholesaleTierLike | null | undefined, sku: WholesaleSkuLike | null | undefined) => {
  if (!tier || !sku) return false
  const tierSkuId = normalizeSkuId(tier.sku_id)
  const skuId = normalizeSkuId(sku.id)
  if (tierSkuId > 0 && skuId > 0 && tierSkuId === skuId) return true
  const tierSkuCode = normalizeSkuCode(tier.sku_code)
  return tierSkuCode !== '' && tierSkuCode === normalizeSkuCode(sku.sku_code)
}

export const formatWholesaleTierScopeLabel = (
  product: WholesaleProductLike | null | undefined,
  tier: WholesaleTierLike | null | undefined,
  options?: { locale?: string; allLabel?: string },
) => {
  if (isUniversalWholesaleTier(tier)) return options?.allLabel || 'All SKU'
  const skus = activeSkus(product)
  const matched = skus.find((sku) => wholesaleTierMatchesSku(tier, sku))
  if (matched) return formatWholesaleSkuLabel(matched, options?.locale)
  const skuCode = normalizeText(tier?.sku_code)
  if (skuCode) return skuCode
  const skuId = normalizeSkuId(tier?.sku_id)
  return skuId > 0 ? `SKU#${skuId}` : '-'
}

export const buildWholesaleSkuPriceReferences = (
  product: WholesaleProductLike | null | undefined,
  options: BuildSkuReferenceOptions,
): WholesaleSkuPriceReference[] => {
  const tiers = Array.isArray(options.tiers) ? options.tiers : []
  return activeSkus(product)
    .map((sku) => {
      const priceAmount = parsePositiveNumber(sku.price_amount)
      if (priceAmount === null) return null
      const specificTiers = tiers.filter((tier) => wholesaleTierMatchesSku(tier, sku))
      const relevantTiers = specificTiers.length > 0 ? specificTiers : tiers.filter((tier) => isUniversalWholesaleTier(tier))
      const lowestTierPrice = lowestWholesaleTierUnitPrice(relevantTiers)
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
