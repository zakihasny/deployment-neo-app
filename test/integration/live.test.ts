import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import type { DatabaseEngine, DatabaseStatus } from '../../shared/types/database.ts'

const enabled = process.env.RUN_DB_INTEGRATION === 'true'
const engine = process.env.DB_ENGINE as DatabaseEngine
const urls: Record<DatabaseEngine, string> = {
  postgresql: 'postgresql://probe:fixture-postgres-password@postgresql:5432/probe',
  mysql: 'mysql://probe:fixture-mysql-password@mysql:3306/probe',
  mariadb: 'mysql://probe:fixture-mariadb-password@mariadb:3306/probe',
  redis: 'redis://:fixture-redis-password@redis:6379/2'
}
const labels = { postgresql: 'PostgreSQL', mysql: 'MySQL', mariadb: 'MariaDB', redis: 'Redis' }
const sanitize = (value: string) => value.replace(/(?:postgres(?:ql)?|mysql|redis|rediss):\/\/[^\s"']+/gi, '[CONNECTION REDACTED]').replace(/fixture-[a-z-]*password/gi, '[FIXTURE PASSWORD REDACTED]')
function docker(...args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 180000 })
  assert.equal(result.status, 0, sanitize(result.stderr || 'Fixture command failed'))
  return result.stdout.trim()
}
const compose = (...args: string[]) => docker('compose', '-f', 'compose.test.yaml', ...args)
async function status(port = 13000): Promise<DatabaseStatus> {
  const response = await fetch(`http://127.0.0.1:${port}/api/database-status`, { signal: AbortSignal.timeout(7000) })
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
  return await response.json() as DatabaseStatus
}
async function waitForServer(port = 13000) {
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    try { const response = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(2000) }); if (response.ok) { await response.text(); return } } catch {}
    await sleep(500)
  }
  throw new Error('Fixture web service did not start.')
}
async function oneOff(environment: Record<string, string>, verify: () => Promise<void>) {
  const args = Object.entries(environment).flatMap(([key, value]) => ['-e', key + '=' + value])
  const id = compose('run', '--rm', '--no-deps', '-d', '-p', '127.0.0.1:13001:3000', ...args, 'web')
  assert.match(id, /^[a-f0-9]{64}$/)
  try { await waitForServer(13001); await verify() } finally { docker('rm', '-f', id) }
}

test('real driver, compiled HTTP application, dependency failure and recovery', { skip: !enabled, timeout: 480000 }, async () => {
  assert.ok(engine in urls, 'DB_ENGINE must select a known disposable fixture.')
  await waitForServer()
  const connected = await status()
  assert.equal(connected.connected, true, connected.message); assert.equal(connected.configured, true)
  assert.equal(connected.engine, engine); assert.equal(connected.expectedVersion, null)
  assert.equal(connected.database, engine === 'redis' ? '2' : 'probe')
  assert.equal(connected.versionMajor, { postgresql: 16, mysql: 8, mariadb: 11, redis: 8 }[engine])
  assert.ok(connected.versionLabel); assert.ok(connected.latencyMs! >= 1)
  const html = await (await fetch('http://127.0.0.1:13000/')).text()
  assert.match(html, /TEST FE/); assert.match(html, /WITH DB/); assert.match(html, /Connected/)
  assert.ok(html.includes(labels[engine] + ' ' + connected.versionMajor))
  assert.equal((html.match(/role="tab"/g) || []).length, 3)
  for (const tab of ['Service inventory', 'Database workloads', 'Deployment events']) assert.ok(html.includes(tab))
  const sample = await (await fetch('http://127.0.0.1:13000/api/sample-data')).json()
  for (const table of ['services', 'databases', 'deployments']) assert.equal(sample[table].length, 8)
  const aggregate = await (await fetch('http://127.0.0.1:13000/api/databases-status')).json()
  assert.deepEqual(aggregate.databases.map((s: DatabaseStatus) => s.engine), ['postgresql', 'mysql', 'mariadb', 'redis'])
  assert.ok(aggregate.databases.every((s: DatabaseStatus) => s.connected), 'All four fixture databases must connect')
  const parallel = await Promise.all(Array.from({ length: 6 }, () => status()))
  assert.ok(parallel.every(value => value.connected))
  assert.equal(JSON.stringify(connected).includes('fixture-'), false)

  const wrongUrl = urls[engine].replace(/fixture-[a-z]+-password/, 'wrong-password')
  const aggregateKey = { postgresql: 'POSTGRES_URL', mysql: 'MYSQL_URL', mariadb: 'MARIADB_URL', redis: 'REDIS_URL' }[engine]
  await oneOff({ DB_ENGINE: engine, DATABASE_URL: wrongUrl, REDIS_URL: wrongUrl, [aggregateKey]: wrongUrl }, async () => {
    const failed = await status(13001)
    assert.equal(failed.connected, false); assert.equal(failed.configured, true)
    assert.equal((await fetch('http://127.0.0.1:13001/healthz')).status, 200)
    const failedHtml = await (await fetch('http://127.0.0.1:13001/')).text()
    assert.match(failedHtml, /Not connected/); assert.ok(failedHtml.includes(labels[engine]))
    assert.equal(JSON.stringify(failed).includes('wrong-password'), false)
  })
  await oneOff({ DB_ENGINE: engine, DATABASE_URL: '', POSTGRES_URL: '', REDIS_URL: '' }, async () => {
    const missing = await status(13001); assert.equal(missing.configured, false); assert.equal(missing.connected, false)
    assert.equal((await fetch('http://127.0.0.1:13001/healthz')).status, 200)
  })
  await oneOff({ DB_ENGINE: 'invalid' }, async () => {
    const invalid = await status(13001); assert.equal(invalid.engine, null); assert.equal(invalid.configured, false)
  })
  if (engine === 'postgresql') {
    await oneOff({ DB_ENGINE: '', DATABASE_URL: urls.postgresql }, async () => assert.equal((await status(13001)).connected, true))
  }
  if (engine === 'mysql' || engine === 'mariadb') {
    const other = engine === 'mysql' ? 'mariadb' : 'mysql'
    if (engine === 'mariadb') {
      // Prime MySQL's caching_sha2_password fast-auth cache in this disposable fixture.
      // The MariaDB adapter intentionally does not enable unauthenticated RSA-key retrieval.
      await oneOff({ DB_ENGINE: 'mysql', DATABASE_URL: urls.mysql }, async () => assert.equal((await status(13001)).connected, true))
    }
    await oneOff({ DB_ENGINE: engine, DATABASE_URL: urls[other] }, async () => {
      const mismatch = await status(13001); assert.equal(mismatch.connected, false); assert.match(mismatch.message, /Engine mismatch/)
    })
  }
  if (engine === 'redis') {
    compose('exec', '-T', 'redis', 'redis-cli', '-a', 'fixture-redis-password', 'ACL', 'SETUSER', 'probe-noinfo', 'on', '>fixture-limited-password', '~*', '-@all', '+ping', '+select')
    try {
      await oneOff({ DB_ENGINE: 'redis', REDIS_URL: 'redis://probe-noinfo:fixture-limited-password@redis:6379/2' }, async () => {
        const limited = await status(13001); assert.equal(limited.connected, true, limited.message); assert.equal(limited.versionLabel, null)
        assert.equal(limited.versionMajor, null); assert.match(limited.message, /version information is unavailable/)
      })
    } finally { compose('exec', '-T', 'redis', 'redis-cli', '-a', 'fixture-redis-password', 'ACL', 'DELUSER', 'probe-noinfo') }
  }

  compose('stop', engine)
  const started = Date.now(), unavailable = await status()
  assert.equal(unavailable.connected, false); assert.ok(Date.now() - started < 6500, 'Probe must remain bounded')
  assert.equal((await fetch('http://127.0.0.1:13000/healthz')).status, 200)
  const partial = await (await fetch('http://127.0.0.1:13000/api/databases-status')).json()
  assert.deepEqual(partial.databases.filter((s: DatabaseStatus) => !s.connected).map((s: DatabaseStatus) => s.engine), [engine])
  compose('start', engine)
  let recovered = false
  for (let attempt = 0; attempt < 20; attempt++) { if ((await status()).connected) { recovered = true; break } await sleep(500) }
  assert.equal(recovered, true, 'Next request should recover without an application restart')
  compose('restart', 'web'); await waitForServer(); assert.equal((await status()).connected, true)

  // Only the server-generated fixture database exists: probes must not create application tables or keys.
  let count: string
  if (engine === 'redis') count = compose('exec', '-T', 'redis', 'redis-cli', '-a', 'fixture-redis-password', '-n', '2', 'DBSIZE')
  else if (engine === 'postgresql') count = compose('exec', '-T', 'postgresql', 'psql', '-U', 'probe', '-d', 'probe', '-tAc', "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
  else count = compose('exec', '-T', engine, engine === 'mysql' ? 'mysql' : 'mariadb', '-uprobe', '-pfixture-' + engine + '-password', '-Nse', "SELECT count(*) FROM information_schema.tables WHERE table_schema='probe'")
  assert.equal(count, '0')
  console.log('PASS: ' + engine + ' connectivity, UI labels, credentials, liveness, recovery and zero application-data writes.')
})
