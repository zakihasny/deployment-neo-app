import { Pool } from 'pg'

let pool: Pool | undefined

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function getDatabasePool() {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) throw new Error('DATABASE_NOT_CONFIGURED')

  pool ??= new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    application_name: 'test-deployment-neo-app'
  })

  pool.on('error', () => {
    // The next probe reports a generic disconnected state; credentials are never logged.
  })

  return pool
}

export async function closeDatabasePool() {
  const currentPool = pool
  pool = undefined
  if (currentPool) await currentPool.end()
}
