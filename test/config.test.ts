import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resolveConfiguration, selectedEngine } from '../server/db/config.ts'

test('PostgreSQL remains the default and accepts both URL schemes', () => {
  for (const scheme of ['postgres', 'postgresql']) {
    const config = resolveConfiguration({ DATABASE_URL: `${scheme}://user:p%40ss@localhost/test` })
    assert.equal(config.engine, 'postgresql'); assert.equal(config.password, 'p@ss'); assert.equal(config.port, 5432)
  }
})
test('selection is trimmed, case insensitive and rejects unsupported engines', () => {
  assert.equal(selectedEngine({ DB_ENGINE: ' MariaDB ' }), 'mariadb')
  assert.equal(selectedEngine({ DB_ENGINE: 'mongodb' }), null)
  assert.throws(() => resolveConfiguration({ DB_ENGINE: 'mongodb' }), /DB_ENGINE must/)
})
test('each engine reads only its documented connection variable', () => {
  assert.throws(() => resolveConfiguration({ DB_ENGINE: 'redis', DATABASE_URL: 'redis://localhost' }), /REDIS_URL is not configured/)
  assert.throws(() => resolveConfiguration({ REDIS_URL: 'redis://localhost' }), /DATABASE_URL is not configured/)
  for (const engine of ['mysql', 'mariadb']) {
    const config = resolveConfiguration({ DB_ENGINE: engine, DATABASE_URL: 'mysql://app:pass@localhost:3307/app' })
    assert.equal(config.database, 'app'); assert.equal(config.port, 3307)
  }
  assert.equal(resolveConfiguration({ DB_ENGINE: 'redis', REDIS_URL: 'redis://localhost' }).database, '0')
  assert.equal(resolveConfiguration({ DB_ENGINE: 'redis', REDIS_URL: 'redis://localhost/3' }).database, '3')
})
test('invalid schemes, hosts, encodings, options and Redis indexes are rejected without echoing secrets', () => {
  const cases = [
    { DB_ENGINE: 'mysql', DATABASE_URL: 'postgres://secret@host/app' },
    { DB_ENGINE: 'mariadb', DATABASE_URL: 'mysql://secret@host/' },
    { DB_ENGINE: 'mysql', DATABASE_URL: 'mysql://user:%GG@host/app' },
    { DB_ENGINE: 'mysql', DATABASE_URL: 'mysql://secret@host/app?ssl=false' },
    { DB_ENGINE: 'redis', REDIS_URL: 'https://secret@host/' },
    { DB_ENGINE: 'redis', REDIS_URL: 'redis://secret@host/-1' },
    { DB_ENGINE: 'redis', REDIS_URL: 'redis://secret@host/9007199254740992' },
    { DB_ENGINE: 'redis', REDIS_URL: 'redis://secret@host/0#fragment' }
  ]
  for (const env of cases) assert.throws(() => resolveConfiguration(env), error => error instanceof Error && !error.message.includes('secret'))
})
test('TLS always verifies certificates and preserves PostgreSQL verified URL settings', () => {
  for (const mode of ['require', 'verify-ca', 'verify-full']) {
    const config = resolveConfiguration({ DATABASE_URL: `postgres://user:pass@host/app?sslmode=${mode}&application_name=test` })
    assert.equal(config.tls?.rejectUnauthorized, true)
    assert.equal(new URL(config.connectionString).searchParams.has('sslmode'), false)
    assert.equal(new URL(config.connectionString).searchParams.get('application_name'), 'test')
  }
  for (const engine of ['mysql', 'mariadb']) assert.equal(resolveConfiguration({ DB_ENGINE: engine, DATABASE_URL: 'mysql://app:pass@host/app', DB_TLS: 'true' }).tls?.rejectUnauthorized, true)
  assert.equal(resolveConfiguration({ DB_ENGINE: 'redis', REDIS_URL: 'rediss://host/0' }).tls?.rejectUnauthorized, true)
})
test('conflicting TLS flags and verification-disabling options are rejected', () => {
  for (const mode of ['no-verify', 'prefer', 'allow']) assert.throws(() => resolveConfiguration({ DATABASE_URL: `postgres://host/app?sslmode=${mode}` }))
  for (const options of ['sslmode=disable', 'ssl=false']) assert.throws(() => resolveConfiguration({ DATABASE_URL: `postgres://host/app?${options}`, DB_TLS: 'true' }))
  assert.throws(() => resolveConfiguration({ DATABASE_URL: 'postgres://host/app?sslmode=require', DB_TLS: 'false' }))
  assert.throws(() => resolveConfiguration({ DATABASE_URL: 'postgres://host/app?uselibpqcompat=true' }))
  assert.throws(() => resolveConfiguration({ DB_ENGINE: 'redis', REDIS_URL: 'redis://host', DB_TLS: 'true' }))
  assert.throws(() => resolveConfiguration({ DB_ENGINE: 'redis', REDIS_URL: 'rediss://host', DB_TLS: 'false' }))
  assert.throws(() => resolveConfiguration({ DATABASE_URL: 'postgres://host/app', DB_TLS: 'sometimes' }))
})
test('custom CA files are server-side, bounded and require TLS', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'db-probe-ca-'))
  try {
    const file = path.join(dir, 'test-ca.pem'); writeFileSync(file, 'fixture CA contents')
    const config = resolveConfiguration({ DATABASE_URL: 'postgres://host/app', DB_TLS: 'true', DB_CA_FILE: file })
    assert.equal(config.tls?.ca, 'fixture CA contents'); assert.equal(config.tls?.rejectUnauthorized, true)
    const legacy = resolveConfiguration({ DATABASE_URL: `postgres://host/app?sslrootcert=${encodeURIComponent(file)}` })
    assert.equal(legacy.tls?.ca, 'fixture CA contents'); assert.equal(legacy.tls?.rejectUnauthorized, true)
    assert.throws(() => resolveConfiguration({ DATABASE_URL: 'postgres://host/app', DB_CA_FILE: file }))
    assert.throws(() => resolveConfiguration({ DATABASE_URL: `postgres://host/app?sslmode=verify-full&sslrootcert=${encodeURIComponent(file)}`, DB_CA_FILE: file }))
    assert.throws(() => resolveConfiguration({ DATABASE_URL: 'postgres://host/app', DB_TLS: 'true', DB_CA_FILE: path.join(dir, 'missing') }), /could not be read/)
    writeFileSync(file, 'x'.repeat(1024 * 1024 + 1))
    assert.throws(() => resolveConfiguration({ DATABASE_URL: 'postgres://host/app', DB_TLS: 'true', DB_CA_FILE: file }))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
