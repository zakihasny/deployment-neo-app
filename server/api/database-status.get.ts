import { performance } from 'node:perf_hooks'
import { databaseConfigured, getDatabasePool } from '../utils/database'

export default defineEventHandler(async () => {
  const checkedAt = new Date().toISOString()
  if (!databaseConfigured()) {
    return {
      connected: false,
      configured: false,
      database: null,
      expectedVersion: 16,
      versionMajor: null,
      versionLabel: null,
      latencyMs: null,
      checkedAt,
      message: 'DATABASE_URL is not configured.'
    }
  }

  const startedAt = performance.now()
  try {
    const result = await getDatabasePool().query({
      text: `SELECT current_database() AS database,
                    current_setting('server_version_num')::int AS version_num,
                    current_setting('server_version') AS version_label`,
      rowMode: 'array'
    })
    const [database, versionNumber, versionLabel] = result.rows[0] as [string, number, string]
    const versionMajor = Math.floor(Number(versionNumber) / 10000)
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt))
    const versionMatches = versionMajor === 16

    return {
      connected: true,
      configured: true,
      database,
      expectedVersion: 16,
      versionMajor,
      versionLabel,
      latencyMs,
      checkedAt,
      message: versionMatches
        ? `PostgreSQL ${versionMajor} is responding.`
        : `Connected, but PostgreSQL ${versionMajor} does not match the expected version.`
    }
  } catch {
    return {
      connected: false,
      configured: true,
      database: null,
      expectedVersion: 16,
      versionMajor: null,
      versionLabel: null,
      latencyMs: null,
      checkedAt,
      message: 'The PostgreSQL connection is unavailable.'
    }
  }
})
