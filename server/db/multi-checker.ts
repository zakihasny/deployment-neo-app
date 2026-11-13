import { createDatabaseChecker } from './checker.ts'
import type { DatabaseEnvironment } from './config.ts'
import type { DatabaseEngine } from '../../shared/types/database.ts'
const engines: DatabaseEngine[] = ['postgresql', 'mysql', 'mariadb', 'redis']
const keys = { postgresql: 'POSTGRES_URL', mysql: 'MYSQL_URL', mariadb: 'MARIADB_URL', redis: 'REDIS_URL' }
export function createMultiDatabaseChecker(environment: () => DatabaseEnvironment = () => process.env, factory = createDatabaseChecker) {
  const checkers = engines.map(engine => factory({ environment: () => {
    const env = environment()
    return { DB_ENGINE: engine, DATABASE_URL: env[keys[engine]], REDIS_URL: env.REDIS_URL,
      DB_TLS: env.DB_TLS, DB_CA_FILE: env.DB_CA_FILE }
  } }))
  return { async check() { return { databases: await Promise.all(checkers.map(checker => checker.check())) } },
    async close() { await Promise.all(checkers.map(checker => checker.close())) } }
}
