import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAdminRouteUrl,
  getAdminBasePath,
  normalizeAdminBasePath,
} from '../src/utils/adminPath.ts'

const baseDocument = (href: string | null) => ({
  querySelector: () => href === null ? null : {
    getAttribute: () => href,
  },
})

test('runtime admin base overrides the build fallback', () => {
  const runtimeBase = getAdminBasePath(baseDocument('/console-private/'), '/admin')

  assert.equal(runtimeBase, '/console-private')
  assert.equal(
    buildAdminRouteUrl('/payments?payment_id=42', runtimeBase),
    '/console-private/payments?payment_id=42',
  )
})

test('admin base normalizes boundary slashes', () => {
  assert.equal(normalizeAdminBasePath('///private-admin///'), '/private-admin')
  assert.equal(normalizeAdminBasePath('/'), '')
})

test('admin route URL construction avoids duplicate slashes', () => {
  assert.equal(buildAdminRouteUrl('/payments?payment_id=42', '/private-admin/'), '/private-admin/payments?payment_id=42')
  assert.equal(buildAdminRouteUrl('login', ''), '/login')
})

test('missing runtime base uses the build fallback', () => {
  assert.equal(getAdminBasePath(baseDocument(null), '/admin/'), '/admin')
})
