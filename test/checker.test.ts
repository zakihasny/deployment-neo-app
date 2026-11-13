import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDatabaseChecker } from '../server/db/checker.ts'
import { parseVersion, sqlMetadata, optionalRedisMetadata, EngineMismatchError } from '../server/db/adapters.ts'
import type { DatabaseEngine } from '../shared/types/database.ts'

const env = { DATABASE_URL: 'postgres://app:private-password@db.example.test/app' }
const result = { database: 'app', versionLabel: '16.14', versionMajor: 16 }
test('missing configuration and invalid engines do not open a connection', async () => {
  for (const environment of [{}, { DB_ENGINE: 'invalid' }]) {
    const checker = createDatabaseChecker({ environment: () => environment, createProbe() { throw new Error('must not connect') } })
    const status = await checker.check()
    assert.equal(status.configured, false); assert.equal(status.connected, false); assert.equal(status.expectedVersion, null)
    assert.equal(status.engine, 'DB_ENGINE' in environment ? null : 'postgresql')
    await checker.close()
  }
})
test('success preserves public fields and versions are informational', async () => {
  let closed = false
  const checker = createDatabaseChecker({ environment: () => env, createProbe: () => ({ async run() { return { ...result, versionLabel: '17.6', versionMajor: 17 } }, destroy() { closed = true } }) })
  const status = await checker.check()
  assert.equal(status.connected, true); assert.equal(status.engine, 'postgresql'); assert.equal(status.versionMajor, 17)
  assert.equal(status.expectedVersion, null); assert.equal(status.database, 'app'); assert.ok(status.latencyMs! >= 1); assert.ok(closed)
  assert.ok(Date.parse(status.checkedAt)); assert.equal(JSON.stringify(status).includes('private-password'), false)
})
test('connection errors are sanitized and resources are destroyed', async () => {
  let destroyed = false
  const checker = createDatabaseChecker({ environment: () => env, createProbe: () => ({ async run() { throw new Error(env.DATABASE_URL) }, destroy() { destroyed = true } }) })
  const status = await checker.check()
  assert.equal(status.connected, false); assert.equal(status.configured, true); assert.ok(destroyed)
  assert.equal(JSON.stringify(status).includes('private-password'), false); assert.equal(JSON.stringify(status).includes('db.example.test'), false)
})
test('overlapping checks share one in-flight probe and later checks run fresh', async () => {
  let resolve!: (value: typeof result) => void; let calls = 0
  const checker = createDatabaseChecker({ environment: () => env, createProbe: () => ({ run() { calls++; return new Promise(done => { resolve = done }) }, destroy() {} }) })
  const first = checker.check(), second = checker.check()
  assert.equal(first, second); assert.equal(calls, 1); resolve(result)
  assert.deepEqual(await first, await second)
  const next = checker.check(); assert.equal(calls, 2); resolve(result); await next
})
test('deadlines terminate stuck probes and permit recovery', async () => {
  let destroyed = 0, hanging = true
  const checker = createDatabaseChecker({ environment: () => env, timeoutMs: 20, createProbe: () => ({ run: () => hanging ? new Promise(() => {}) : Promise.resolve(result), destroy() { destroyed++ } }) })
  const started = Date.now(), failed = await checker.check()
  assert.equal(failed.connected, false); assert.ok(Date.now() - started < 1000); assert.ok(destroyed > 0)
  hanging = false; assert.equal((await checker.check()).connected, true)
})
test('shutdown cancels an in-flight probe and prevents new connections', async () => {
  const checker = createDatabaseChecker({ environment: () => env, createProbe: () => ({ run: () => new Promise(() => {}), destroy() {} }) })
  const pending = checker.check(); await checker.close()
  assert.equal((await pending).connected, false); assert.equal((await checker.check()).connected, false)
})
test('MySQL and MariaDB version parsing detects engine mismatches', async () => {
  assert.deepEqual(sqlMetadata('mariadb', { database: 'app', version: '5.5.5-11.4.13-MariaDB' }), { database: 'app', versionLabel: '11.4.13-MariaDB', versionMajor: 11 })
  assert.equal(sqlMetadata('mysql', { database: 'app', version: '8.4.13' }).versionMajor, 8)
  assert.throws(() => sqlMetadata('mysql', { database: 'app', version: '11.4.13-MariaDB' }), EngineMismatchError)
  assert.throws(() => sqlMetadata('mariadb', { database: 'app', version: '8.4.13' }), EngineMismatchError)
  const checker = createDatabaseChecker({ environment: () => ({ DB_ENGINE: 'mysql', DATABASE_URL: 'mysql://app:pass@host/app' }), createProbe: () => ({ async run() { throw new EngineMismatchError('mysql', 'mariadb') }, destroy() {} }) })
  assert.match((await checker.check()).message, /Engine mismatch/)
  assert.equal(parseVersion('8.2.11'), 8); assert.equal(parseVersion(null), null); assert.equal(parseVersion('unknown'), null)
})
test('Redis metadata permission failures keep a successful PING green without leaking internals', async () => {
  assert.ok(optionalRedisMetadata(new Error('NOPERM no permissions for INFO')))
  assert.equal(optionalRedisMetadata(new Error('connection reset')), false)
  const checker = createDatabaseChecker({ environment: () => ({ DB_ENGINE: 'redis', REDIS_URL: 'redis://localhost/2' }), createProbe: () => ({ async run() { return { database: '2', versionLabel: null, versionMajor: null, metadataUnavailable: true } }, destroy() {} }) })
  const status = await checker.check()
  assert.equal(status.connected, true); assert.equal(status.versionLabel, null); assert.equal(status.database, '2')
  assert.match(status.message, /version information is unavailable/); assert.equal('metadataUnavailable' in status, false)
})
test('each configured engine returns the selected engine and a generic driver failure', async () => {
  for (const engine of ['postgresql', 'mysql', 'mariadb', 'redis'] as DatabaseEngine[]) {
    const environment = { DB_ENGINE: engine, DATABASE_URL: engine === 'postgresql' ? env.DATABASE_URL : 'mysql://app:pass@host/app', REDIS_URL: 'redis://localhost' }
    const checker = createDatabaseChecker({ environment: () => environment, createProbe: () => ({ async run() { throw new Error('sensitive details') }, destroy() {} }) })
    const status = await checker.check(); assert.equal(status.engine, engine); assert.equal(status.connected, false); assert.equal(status.configured, true)
    assert.equal(status.message.includes('sensitive'), false)
  }
})
