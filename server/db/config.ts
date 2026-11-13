import { readFileSync, statSync } from 'node:fs'
import type { DatabaseEngine } from '../../shared/types/database.ts'

export type DatabaseEnvironment = Record<string, string | undefined>
export type VerifiedTls = { rejectUnauthorized: true; ca?: string; cert?: string; key?: string; passphrase?: string }
export type ProbeConfiguration = {
  engine: DatabaseEngine
  connectionString: string
  host: string
  port: number
  username: string
  password: string
  database: string
  tls?: VerifiedTls
}

export class ConfigurationError extends Error {
  readonly engine: DatabaseEngine | null
  constructor(message: string, engine: DatabaseEngine | null) { super(message); this.engine = engine }
}

export function selectedEngine(environment: DatabaseEnvironment): DatabaseEngine | null {
  const value = environment.DB_ENGINE?.trim().toLowerCase() || 'postgresql'
  return ['postgresql', 'mysql', 'mariadb', 'redis'].includes(value) ? value as DatabaseEngine : null
}

export function resolveConfiguration(environment: DatabaseEnvironment): ProbeConfiguration {
  const engine = selectedEngine(environment)
  const fail = (message: string): never => { throw new ConfigurationError(message, engine) }
  if (!engine) return fail('DB_ENGINE must be postgresql, mysql, mariadb, or redis.')
  const variable = engine === 'redis' ? 'REDIS_URL' : 'DATABASE_URL'
  const connectionString = (environment[variable] || (engine === 'postgresql' ? environment.POSTGRES_URL : undefined))?.trim()
  if (!connectionString) return fail(variable + ' is not configured.')
  let url: URL
  try { url = new URL(connectionString) } catch { return fail(variable + ' must be a valid connection URL.') }
  const schemes = engine === 'postgresql' ? ['postgres:', 'postgresql:'] : engine === 'redis' ? ['redis:', 'rediss:'] : ['mysql:']
  if (!schemes.includes(url.protocol) || !url.hostname || url.hash) return fail(variable + ' has an unsupported scheme, host, or fragment.')
  if (engine !== 'postgresql' && url.search) return fail('Use the documented TLS settings instead of connection URL query options.')

  let username: string, password: string, database: string
  try {
    username = decodeURIComponent(url.username)
    password = decodeURIComponent(url.password)
    database = decodeURIComponent(url.pathname.slice(1))
  } catch { return fail(variable + ' contains invalid URL encoding.') }
  if (engine === 'redis') {
    if (!/^\d*$/.test(database) || (database && !Number.isSafeInteger(Number(database)))) return fail('REDIS_URL must select a nonnegative logical database index.')
    database ||= '0'
  } else if (engine !== 'postgresql' && (!database || database.includes('/') || database.includes('\0'))) {
    return fail('DATABASE_URL must select a database name.')
  }

  const flag = environment.DB_TLS?.trim().toLowerCase()
  if (flag && !['true', 'false', '1', '0'].includes(flag)) return fail('DB_TLS must be true or false.')
  const explicitTls = flag ? ['true', '1'].includes(flag) : undefined
  let urlTls: boolean | undefined = engine === 'redis' ? url.protocol === 'rediss:' : undefined
  const mode = url.searchParams.get('sslmode')?.toLowerCase()
  const ssl = url.searchParams.get('ssl')?.toLowerCase()
  if (engine === 'postgresql') {
    if (mode && !['disable', 'require', 'verify-ca', 'verify-full'].includes(mode)) return fail('PostgreSQL sslmode must disable TLS or require verified TLS.')
    if (ssl && !['true', 'false', '1', '0'].includes(ssl)) return fail('PostgreSQL ssl must be true or false.')
    if (url.searchParams.has('uselibpqcompat')) return fail('uselibpqcompat is not supported; certificate verification must remain enabled.')
    if (mode) urlTls = mode !== 'disable'
    if (ssl) {
      const sslFlag = ['true', '1'].includes(ssl)
      if (urlTls !== undefined && urlTls !== sslFlag) return fail('PostgreSQL TLS settings conflict.')
      urlTls = sslFlag
    }
  }
  const caFile = environment.DB_CA_FILE?.trim()
  const rootCert = engine === 'postgresql' ? url.searchParams.get('sslrootcert') : null
  const certFile = engine === 'postgresql' ? url.searchParams.get('sslcert') : null
  const keyFile = engine === 'postgresql' ? url.searchParams.get('sslkey') : null
  if (engine === 'postgresql' && urlTls === undefined && (rootCert || certFile || keyFile)) urlTls = true
  if (explicitTls !== undefined && urlTls !== undefined && explicitTls !== urlTls) return fail('DB_TLS conflicts with the connection URL TLS settings.')
  const enabled = explicitTls ?? urlTls ?? false
  if ((caFile || rootCert || certFile || keyFile) && !enabled) return fail('Certificate files require TLS to be enabled.')
  if (caFile && rootCert) return fail('Configure only one CA file source.')
  if (Boolean(certFile) !== Boolean(keyFile)) return fail('PostgreSQL client certificates require both sslcert and sslkey.')
  function certificate(file: string | null | undefined): string | undefined {
    if (!file) return undefined
    try {
      if (statSync(file).size > 1024 * 1024) return fail('A certificate file exceeds the size limit.')
      return readFileSync(file, 'utf8')
    } catch { return fail('A configured certificate file could not be read.') }
  }
  const tls: VerifiedTls | undefined = enabled ? {
    rejectUnauthorized: true,
    ...(caFile || rootCert ? { ca: certificate(caFile || rootCert) } : {}),
    ...(certFile ? { cert: certificate(certFile), key: certificate(keyFile) } : {}),
    ...(url.searchParams.has('sslpassword') ? { passphrase: url.searchParams.get('sslpassword')! } : {})
  } : undefined
  if (!enabled && url.searchParams.has('sslpassword')) return fail('sslpassword requires TLS.')
  if (engine === 'postgresql') {
    for (const name of ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'sslpassword']) url.searchParams.delete(name)
    // Keep unrelated PostgreSQL URL parameters, while preventing the driver from replacing verified TLS options.
  }
  return { engine, connectionString: url.toString(), host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port || (engine === 'postgresql' ? 5432 : engine === 'redis' ? 6379 : 3306)), username, password, database, tls }
}
