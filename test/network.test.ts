import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'
import { createDatabaseChecker } from '../server/db/checker.ts'
import type { DatabaseEngine } from '../shared/types/database.ts'

test('real drivers stay bounded and release sockets when a peer accepts TCP but never answers', { timeout: 9000 }, async () => {
  const sockets = new Set<import('node:net').Socket>()
  const peer = createServer(socket => { sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket)); socket.on('data', () => {}) })
  await new Promise<void>(resolve => peer.listen(0, '127.0.0.1', resolve))
  const address = peer.address() as import('node:net').AddressInfo
  const checkers = (['postgresql', 'mysql', 'mariadb', 'redis'] as DatabaseEngine[]).map(engine => createDatabaseChecker({ environment: () => ({
    DB_ENGINE: engine,
    DATABASE_URL: `${engine === 'postgresql' ? 'postgresql' : 'mysql'}://fixture:fixture@127.0.0.1:${address.port}/fixture`,
    REDIS_URL: `redis://:fixture@127.0.0.1:${address.port}/0`
  }) }))
  try {
    const started = Date.now()
    const results = await Promise.all(checkers.map(checker => checker.check()))
    assert.ok(results.every(result => !result.connected && result.configured))
    assert.ok(Date.now() - started < 6000, 'All four production deadlines must remain bounded')
    for (let i = 0; i < 10 && sockets.size; i++) await sleep(50)
    assert.equal(sockets.size, 0, 'No abandoned handshake sockets should survive the probe')
  } finally {
    await Promise.all(checkers.map(checker => checker.close()))
    for (const socket of sockets) socket.destroy()
    await new Promise<void>(resolve => peer.close(() => resolve()))
  }
})
