import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMultiDatabaseChecker } from '../server/db/multi-checker.ts'
import { createDatabaseChecker } from '../server/db/checker.ts'
import { resolveConfiguration } from '../server/db/config.ts'
test('aggregate checks isolate failures, share in-flight probes and recover without leaking credentials', async () => {
  const env = { POSTGRES_URL: 'postgres://probe:secret@pg/app', MYSQL_URL: 'mysql://probe:secret@my/app', MARIADB_URL: 'mysql://probe:secret@ma/app', REDIS_URL: 'redis://:secret@rd/0' }
  let fail = true, calls = 0, destroyed = 0
  const checker = createMultiDatabaseChecker(() => env, options => createDatabaseChecker({ ...options, timeoutMs: 50,
    createProbe(config) { calls++; return { async run() { await new Promise(r => setTimeout(r, 5)); if (config.engine === 'mysql' && fail) throw Error(config.connectionString); return { database: config.database || 'app', versionLabel: '16', versionMajor: 16 } }, destroy() { destroyed++ } } } }))
  const [a, b] = await Promise.all([checker.check(), checker.check()])
  assert.equal(calls, 4); assert.deepEqual(a, b)
  assert.deepEqual(a.databases.map(s => s.engine), ['postgresql','mysql','mariadb','redis'])
  assert.deepEqual(a.databases.map(s => s.connected), [true,false,true,true])
  assert.equal(JSON.stringify(a).includes('secret'), false)
  fail = false; assert.ok((await checker.check()).databases.every(s => s.connected)); assert.equal(destroyed, 8)
  await checker.close()
})
test('aggregate missing configuration is isolated and legacy PostgreSQL accepts fallback', async () => {
  const checker = createMultiDatabaseChecker(() => ({})); const result = await checker.check()
  assert.ok(result.databases.every(s => !s.configured && !s.connected)); await checker.close()
  assert.equal(resolveConfiguration({POSTGRES_URL:'postgres://probe:secret@pg/app'}).engine, 'postgresql')
})
