import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resellerProductSettingsPermission,
  buildResellerProductSettingStatusClass,
  getAdminResellerProductSettingOwnerLabel,
} from '../src/utils/resellerProductSettings.ts'

test('admin reseller product settings permission is exact', () => {
  assert.equal(resellerProductSettingsPermission, 'GET:/admin/resellers/product-settings')
})

test('listed status class distinguishes hidden rows', () => {
  assert.equal(buildResellerProductSettingStatusClass(false).includes('rose'), true)
  assert.equal(buildResellerProductSettingStatusClass(true).includes('emerald'), true)
})

test('owner label prefers email then display name then reseller id', () => {
  assert.equal(
    getAdminResellerProductSettingOwnerLabel({
      reseller_id: 7,
      profile: { user: { email: 'a@example.test' } },
    } as any),
    'a@example.test',
  )
  assert.equal(
    getAdminResellerProductSettingOwnerLabel({
      reseller_id: 8,
      profile: { user: { display_name: 'Store Owner' } },
    } as any),
    'Store Owner',
  )
  assert.equal(getAdminResellerProductSettingOwnerLabel({ reseller_id: 9 } as any), '#9')
})
