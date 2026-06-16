export const resellerProductSettingsPermission = 'GET:/admin/resellers/product-settings'

type AdminResellerProductSettingLike = {
  reseller_id: number
  profile?: { user?: { email?: string; display_name?: string } }
}

export const buildResellerProductSettingStatusClass = (listed?: boolean) => {
  if (listed === false) return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

export const getAdminResellerProductSettingOwnerLabel = (row: AdminResellerProductSettingLike) => {
  const email = row.profile?.user?.email?.trim()
  if (email) return email
  const displayName = row.profile?.user?.display_name?.trim()
  if (displayName) return displayName
  return `#${row.reseller_id}`
}
