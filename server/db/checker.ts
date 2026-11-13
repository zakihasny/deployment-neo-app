import { performance } from 'node:perf_hooks'
import { databaseEngineLabels } from '../../shared/types/database.ts'
import type { DatabaseStatus } from '../../shared/types/database.ts'
import { ConfigurationError, resolveConfiguration, selectedEngine } from './config.ts'
import type { DatabaseEnvironment, ProbeConfiguration } from './config.ts'
import { createDatabaseProbe, EngineMismatchError } from './adapters.ts'
import type { DatabaseProbe } from './adapters.ts'

export function createDatabaseChecker({ environment = () => process.env, createProbe = createDatabaseProbe, timeoutMs = 5000 }: {
  environment?: () => DatabaseEnvironment; createProbe?: (config: ProbeConfiguration) => DatabaseProbe; timeoutMs?: number
} = {}) {
  let inFlight: Promise<DatabaseStatus> | undefined
  let currentProbe: DatabaseProbe | undefined
  let stop: (() => void) | undefined
  let closed = false

  async function perform(): Promise<DatabaseStatus> {
    const env = environment()
    const status: DatabaseStatus = { engine: selectedEngine(env), connected: false, configured: false, database: null,
      expectedVersion: null, versionMajor: null, versionLabel: null, latencyMs: null, checkedAt: new Date().toISOString(), message: '' }
    let config: ProbeConfiguration
    try { config = resolveConfiguration(env) }
    catch (error) { return { ...status, message: error instanceof ConfigurationError ? error.message : 'Database configuration is invalid.' } }
    status.configured = true
    const label = databaseEngineLabels[config.engine]
    if (closed) return { ...status, message: 'Database checking has stopped.' }
    let timer: ReturnType<typeof setTimeout> | undefined
    let probe: DatabaseProbe | undefined
    const started = performance.now()
    try {
      probe = createProbe(config)
      currentProbe = probe
      const deadline = new Promise<never>((_, reject) => {
        stop = () => { try { probe?.destroy() } catch {} reject(new Error('PROBE_STOPPED')) }
        timer = setTimeout(stop, timeoutMs)
      })
      const result = await Promise.race([probe.run(), deadline])
      return { ...status, database: result.database, versionLabel: result.versionLabel, versionMajor: result.versionMajor, connected: true,
        latencyMs: Math.max(1, Math.round(performance.now() - started)),
        message: result.metadataUnavailable ? label + ' is responding. Server version information is unavailable.' : label + ' is responding.' }
    } catch (error) {
      return { ...status, message: error instanceof EngineMismatchError ? error.message : label + ' connection is unavailable or exceeded the five-second probe limit.' }
    } finally {
      clearTimeout(timer)
      try { probe?.destroy() } catch {}
      currentProbe = undefined
      stop = undefined
    }
  }
  return {
    check(): Promise<DatabaseStatus> {
      if (inFlight) return inFlight
      const pending = perform()
      inFlight = pending
      void pending.finally(() => { if (inFlight === pending) inFlight = undefined })
      return pending
    },
    async close() {
      closed = true
      stop?.()
      try { currentProbe?.destroy() } catch {}
      await inFlight
    }
  }
}
