<script setup lang="ts">
type TabKey = 'services' | 'databases' | 'deployments'
type CellValue = string | number

type SampleData = {
  generatedAt: string
  services: Record<string, CellValue>[]
  databases: Record<string, CellValue>[]
  deployments: Record<string, CellValue>[]
}

type TableColumn = {
  key: string
  label: string
  numeric?: boolean
  status?: boolean
}

type TableDefinition = {
  title: string
  description: string
  columns: TableColumn[]
}

const tabs: { key: TabKey; label: string }[] = [
  { key: 'services', label: 'Service inventory' },
  { key: 'databases', label: 'Database workloads' },
  { key: 'deployments', label: 'Deployment events' }
]

const tables: Record<TabKey, TableDefinition> = {
  services: {
    title: 'Service inventory',
    description: 'Generated examples of compute services and their current runtime state.',
    columns: [
      { key: 'id', label: 'Service ID' },
      { key: 'name', label: 'Service name' },
      { key: 'region', label: 'Region' },
      { key: 'vcpu', label: 'vCPU', numeric: true },
      { key: 'memory', label: 'Memory' },
      { key: 'status', label: 'Status', status: true }
    ]
  },
  databases: {
    title: 'Database workloads',
    description: 'Generated examples of PostgreSQL workloads, owners, and capacity signals.',
    columns: [
      { key: 'id', label: 'Workload ID' },
      { key: 'name', label: 'Database name' },
      { key: 'owner', label: 'Owner' },
      { key: 'connections', label: 'Connections', numeric: true },
      { key: 'storage', label: 'Storage used' },
      { key: 'status', label: 'Health', status: true }
    ]
  },
  deployments: {
    title: 'Deployment events',
    description: 'Generated examples of recent releases and their delivery outcomes.',
    columns: [
      { key: 'id', label: 'Event ID' },
      { key: 'service', label: 'Service' },
      { key: 'revision', label: 'Revision' },
      { key: 'trigger', label: 'Trigger' },
      { key: 'duration', label: 'Duration', numeric: true },
      { key: 'status', label: 'Result', status: true }
    ]
  }
}

const activeTab = ref<TabKey>('services')
const tabRefs = ref<HTMLButtonElement[]>([])

const pick = <T>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)] as T
const randomInt = (minimum: number, maximum: number) => Math.floor(Math.random() * (maximum - minimum)) + minimum
const shortId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

function createSampleData(): SampleData {
  const serviceNames = ['portal-api', 'billing-worker', 'identity-web', 'asset-sync', 'reporting-api', 'event-router']
  const databaseNames = ['operations', 'customer_portal', 'billing', 'analytics', 'audit_log', 'identity']
  const owners = ['Platform', 'Finance', 'Operations', 'Security', 'Data', 'Customer Experience']
  const regions = ['Jakarta', 'West Java', 'Central Java']

  return {
    generatedAt: new Date().toISOString(),
    services: Array.from({ length: 8 }, (_, index) => ({
      id: shortId('SVC'),
      name: `${pick(serviceNames)}-${index + 1}`,
      region: pick(regions),
      vcpu: pick([1, 2, 2, 4]),
      memory: pick(['1 GB', '2 GB', '4 GB', '8 GB']),
      status: pick(['Running', 'Running', 'Running', 'Warning'])
    })),
    databases: Array.from({ length: 8 }, (_, index) => ({
      id: shortId('DB'),
      name: `${pick(databaseNames)}_${index + 1}`,
      owner: pick(owners),
      connections: randomInt(3, 86),
      storage: `${randomInt(2, 48)} GB`,
      status: pick(['Healthy', 'Healthy', 'Healthy', 'Degraded'])
    })),
    deployments: Array.from({ length: 8 }, () => ({
      id: shortId('EVT'),
      service: pick(serviceNames),
      revision: Math.random().toString(16).slice(2, 9),
      trigger: pick(['Git push', 'Manual', 'Scheduled']),
      duration: `${randomInt(18, 241)} s`,
      status: pick(['Succeeded', 'Succeeded', 'Succeeded', 'Pending', 'Failed'])
    }))
  }
}

const sampleData = ref<SampleData>(createSampleData())

const activeTable = computed(() => tables[activeTab.value])
const activeRows = computed(() => sampleData.value[activeTab.value])

function regenerateSampleData() {
  sampleData.value = createSampleData()
}

function activateTab(key: TabKey, index?: number) {
  activeTab.value = key
  if (typeof index === 'number') nextTick(() => tabRefs.value[index]?.focus())
}

function onTabKeydown(event: KeyboardEvent, index: number) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  let nextIndex = index
  if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
  if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
  if (event.key === 'Home') nextIndex = 0
  if (event.key === 'End') nextIndex = tabs.length - 1
  const nextTab = tabs[nextIndex]
  if (nextTab) activateTab(nextTab.key, nextIndex)
}
</script>

<template>
  <main class="page-shell">
    <section class="hero" aria-labelledby="page-title">
      <div class="hero__copy">
        <p class="eyebrow">NEO App · Static deployment test</p>
        <h1 id="page-title"><span>TEST FE</span> WITH DB</h1>
        <p class="hero__lead">
          A static front-end deployment surface with three browser-generated operational datasets and no server or database dependency.
        </p>
      </div>

      <aside
        class="database-card database-card--connected"
        aria-live="polite"
        aria-label="Static deployment status"
      >
        <div class="database-card__header">
          <p class="database-card__label">Runtime mode</p>
          <span class="database-card__version">Static site</span>
        </div>

        <div class="database-card__status">
          <span class="status-dot" aria-hidden="true" />
          <div class="status-copy">
            <strong>Ready</strong>
            <span>Runs entirely in the browser. No database connection is required.</span>
          </div>
        </div>

        <div class="database-card__footer">
          <span class="database-card__meta">Client-side generated data</span>
          <button class="btn" type="button" @click="regenerateSampleData">
            Regenerate data
          </button>
        </div>
      </aside>
    </section>

    <section class="content-section" aria-labelledby="sample-data-title">
      <div class="section-heading">
        <div>
          <h2 id="sample-data-title">Sample operational data</h2>
          <p>Randomized in your browser. These rows are not sent to or stored in a database.</p>
        </div>
        <span class="sample-badge">Sample only</span>
      </div>

      <div class="tab-shell">
        <div class="tab-list" role="tablist" aria-label="Sample data tables">
          <button
            v-for="(tab, index) in tabs"
            :id="`tab-${tab.key}`"
            :key="tab.key"
            :ref="(element) => { if (element) tabRefs[index] = element as HTMLButtonElement }"
            class="tab"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            :aria-controls="`panel-${tab.key}`"
            :tabindex="activeTab === tab.key ? 0 : -1"
            @click="activateTab(tab.key)"
            @keydown="onTabKeydown($event, index)"
          >
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <div
          :id="`panel-${activeTab}`"
          class="tab-panel"
          role="tabpanel"
          :aria-labelledby="`tab-${activeTab}`"
        >
          <div class="table-intro">
            <h3>{{ activeTable.title }}</h3>
            <p>{{ activeTable.description }}</p>
          </div>
          <DataTable
            :caption="activeTable.title"
            :columns="activeTable.columns"
            :rows="activeRows"
          />
        </div>
      </div>
    </section>

    <footer class="page-footer">
      <span>Runtime: static HTML, CSS and JavaScript</span>
      <span>Sample generated {{ new Date(sampleData.generatedAt).toLocaleString('en-GB') }}</span>
    </footer>
  </main>
</template>
