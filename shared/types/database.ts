export type DatabaseEngine = 'postgresql' | 'mysql' | 'mariadb' | 'redis'

export type DatabaseStatus = {
  engine: DatabaseEngine | null
  connected: boolean
  configured: boolean
  database: string | null
  expectedVersion: null
  versionMajor: number | null
  versionLabel: string | null
  latencyMs: number | null
  checkedAt: string
  message: string
}

export const databaseEngineLabels: Record<DatabaseEngine, string> = {
  postgresql: 'PostgreSQL', mysql: 'MySQL', mariadb: 'MariaDB', redis: 'Redis'
}
