import { randomInt, randomUUID } from 'node:crypto'

const pick = <T>(values: readonly T[]) => values[randomInt(values.length)]
const shortId = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`

export default defineEventHandler(() => {
  const serviceNames = ['portal-api', 'billing-worker', 'identity-web', 'asset-sync', 'reporting-api', 'event-router']
  const databaseNames = ['operations', 'customer_portal', 'billing', 'analytics', 'audit_log', 'identity']
  const owners = ['Platform', 'Finance', 'Operations', 'Security', 'Data', 'Customer Experience']
  const regions = ['Jakarta', 'West Java', 'Central Java']
  const serviceStates = ['Running', 'Running', 'Running', 'Warning']
  const databaseStates = ['Healthy', 'Healthy', 'Healthy', 'Degraded']
  const deploymentStates = ['Succeeded', 'Succeeded', 'Succeeded', 'Pending', 'Failed']

  const services = Array.from({ length: 8 }, (_, index) => ({
    id: shortId('SVC'),
    name: `${pick(serviceNames)}-${index + 1}`,
    region: pick(regions),
    vcpu: pick([1, 2, 2, 4]),
    memory: pick(['1 GB', '2 GB', '4 GB', '8 GB']),
    status: pick(serviceStates)
  }))

  const databases = Array.from({ length: 8 }, (_, index) => ({
    id: shortId('DB'),
    name: `${pick(databaseNames)}_${index + 1}`,
    owner: pick(owners),
    connections: randomInt(3, 86),
    storage: `${randomInt(2, 48)} GB`,
    status: pick(databaseStates)
  }))

  const deployments = Array.from({ length: 8 }, () => ({
    id: shortId('EVT'),
    service: pick(serviceNames),
    revision: randomUUID().replaceAll('-', '').slice(0, 7),
    trigger: pick(['Git push', 'Manual', 'Scheduled']),
    duration: `${randomInt(18, 241)} s`,
    status: pick(deploymentStates)
  }))

  return {
    generatedAt: new Date().toISOString(),
    services,
    databases,
    deployments
  }
})
