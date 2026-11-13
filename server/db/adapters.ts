import { Client } from 'pg'
import mysql from 'mysql2'
import mariadb from 'mariadb'
import { createClient } from 'redis'
import type { ProbeConfiguration } from './config.ts'
import type { DatabaseEngine } from '../../shared/types/database.ts'

export type ProbeResult = { database: string | null; versionLabel: string | null; versionMajor: number | null; metadataUnavailable?: boolean }
export type DatabaseProbe = { run(): Promise<ProbeResult>; destroy(): void }
export class EngineMismatchError extends Error {
  constructor(expected: DatabaseEngine, actual: DatabaseEngine) { super(`Engine mismatch: configured ${expected}, but the server identifies as ${actual}.`) }
}

export function sqlMetadata(engine: DatabaseEngine, row: { database: unknown; version: unknown }): ProbeResult {
  const versionLabel = String(row.version).replace(/^5\.5\.5-/, '')
  const detected = /mariadb/i.test(versionLabel) ? 'mariadb' : 'mysql'
  if (engine !== detected) throw new EngineMismatchError(engine, detected)
  return { database: row.database === null ? null : String(row.database), versionLabel, versionMajor: parseVersion(versionLabel) }
}
export function parseVersion(value: string | null): number | null {
  const match = value?.match(/^(\d+)(?:\.|$)/)
  return match ? Number(match[1]) : null
}
export function optionalRedisMetadata(error: unknown): boolean {
  return error instanceof Error && (/\bNOPERM\b/.test(error.message) || /^ERR unknown command ['"]?INFO\b/i.test(error.message))
}

export function createDatabaseProbe(config: ProbeConfiguration): DatabaseProbe {
  const networkOptions = { host: config.host, port: config.port, user: config.username, password: config.password, database: config.database }
  let cancelled = false
  if (config.engine === 'postgresql') {
    const client = new Client({ connectionString: config.connectionString, ssl: config.tls || false,
      connectionTimeoutMillis: 4500, statement_timeout: 4500, application_name: 'test-deployment-neo-app' })
    client.on('error', () => {})
    return {
      async run() {
        await client.connect()
        if (cancelled) throw new Error('Probe cancelled')
        const result = await client.query("SELECT current_database() AS database, current_setting('server_version') AS version")
        const row = result.rows[0]
        return { database: String(row.database), versionLabel: String(row.version), versionMajor: parseVersion(String(row.version)) }
      },
      destroy() { if (!cancelled) { cancelled = true; void client.end().catch(() => {}) } }
    }
  }
  if (config.engine === 'mysql') {
    const client = mysql.createConnection({ ...networkOptions, connectTimeout: 4500, multipleStatements: false,
      ...(config.tls ? { ssl: { ...config.tls, verifyIdentity: true } } : {}) })
    client.on('error', () => {})
    return {
      async run() {
        const connection = client.promise()
        await connection.connect()
        if (cancelled) throw new Error('Probe cancelled')
        const [rows] = await connection.query<mysql.RowDataPacket[]>({ sql: 'SELECT DATABASE() AS database_name, VERSION() AS server_version', timeout: 4500 })
        return sqlMetadata(config.engine, { database: rows[0]!.database_name, version: rows[0]!.server_version })
      },
      destroy() { if (!cancelled) { cancelled = true; client.destroy() } }
    }
  }
  if (config.engine === 'mariadb') {
    let client: Awaited<ReturnType<typeof mariadb.createConnection>> | undefined
    return {
      async run() {
        // The application deadline/socket timeout also work when the peer identifies as MySQL.
        // Connector queryTimeout would reject that peer before VERSION() can identify the mismatch.
        client = await mariadb.createConnection({ ...networkOptions, connectTimeout: 4500, socketTimeout: 4500,
          multipleStatements: false, ...(config.tls ? { ssl: config.tls } : {}) })
        if (cancelled) { client.destroy(); throw new Error('Probe cancelled') }
        const rows = await client.query('SELECT DATABASE() AS database_name, VERSION() AS server_version')
        return sqlMetadata(config.engine, { database: rows[0].database_name, version: rows[0].server_version })
      },
      destroy() { cancelled = true; client?.destroy() }
    }
  }
  const client = createClient({ url: config.connectionString, disableOfflineQueue: true, disableClientInfo: true,
    socket: { connectTimeout: 4500, reconnectStrategy: false, ...(config.tls ? { ...config.tls, tls: true as const } : {}) } })
  client.on('error', () => {})
  return {
    async run() {
      await client.connect()
      if (cancelled) throw new Error('Probe cancelled')
      if (await client.ping() !== 'PONG') throw new Error('Redis did not respond to PING')
      try {
        const info = await client.info('server')
        const versionLabel = info.match(/^redis_version:([^\r\n]+)/m)?.[1] || null
        return { database: config.database, versionLabel, versionMajor: parseVersion(versionLabel) }
      } catch (error) {
        if (!optionalRedisMetadata(error)) throw error
        return { database: config.database, versionLabel: null, versionMajor: null, metadataUnavailable: true }
      }
    },
    destroy() { cancelled = true; if (client.isOpen) client.destroy() }
  }
}
