<script setup lang="ts">
type TabKey = 'services' | 'databases' | 'deployments'
type CellValue = string | number

type DatabaseStatus = {
  connected: boolean
  configured: boolean
  database: string | null
  expectedVersion: number
  versionMajor: number | null
  versionLabel: string | null
  latencyMs: number | null
  checkedAt: string
  message: string
}

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
const { data: databaseStatus, pending: databasePending, refresh: refreshDatabaseStatus } = await useFetch<DatabaseStatus>('/api/database-status')
const { data: sampleData } = await useFetch<SampleData>('/api/sample-data')

const activeTable = computed(() => tables[activeTab.value])
const activeRows = computed(() => sampleData.value?.[activeTab.value] ?? [])
const statusState = computed(() => {
  if (databasePending.value) return 'checking'
  return databaseStatus.value?.connected ? 'connected' : 'disconnected'
})
const statusTitle = computed(() => {
  if (statusState.value === 'checking') return 'Checking connection'
  return statusState.value === 'connected' ? 'Connected' : 'Not connected'
})

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

let statusTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  statusTimer = setInterval(() => refreshDatabaseStatus(), 30000)
})
onBeforeUnmount(() => {
  if (statusTimer) clearInterval(statusTimer)
})
</script>

<template>
  <main class="page-shell">
    <section class="hero" aria-labelledby="page-title">
      <div class="hero__copy">
        <p class="eyebrow">NEO App · PostgreSQL connectivity test</p>
        <h1 id="page-title"><span>TEST FE</span> WITH DB</h1>
        <p class="hero__lead">
          A focused deployment surface that validates a PostgreSQL 16 connection and presents three generated operational datasets.
        </p>
      </div>

      <aside
        class="database-card"
        :class="`database-card--${statusState}`"
        aria-live="polite"
        aria-label="PostgreSQL connection status"
      >
        <div class="database-card__header">
          <p class="database-card__label">Database connection</p>
          <span class="database-card__version">PostgreSQL 16</span>
        </div>

        <div class="database-card__status">
          <span class="status-dot" aria-hidden="true" />
          <div class="status-copy">
            <strong>{{ statusTitle }}</strong>
            <span>{{ databaseStatus?.message ?? 'Waiting for the first health check.' }}</span>
          </div>
        </div>

        <div class="database-card__footer">
          <span class="database-card__meta">
            <template v-if="databaseStatus?.connected">
              {{ databaseStatus.database }} · {{ databaseStatus.latencyMs }} ms
            </template>
            <template v-else>Read-only connection probe</template>
          </span>
          <button class="btn" type="button" :disabled="databasePending" @click="refreshDatabaseStatus()">
            {{ databasePending ? 'Checking…' : 'Check again' }}
          </button>
        </div>
      </aside>
    </section>

    <section class="content-section" aria-labelledby="sample-data-title">
      <div class="section-heading">
        <div>
          <h2 id="sample-data-title">Sample operational data</h2>
          <p>Randomized on each server response. These rows are not stored in PostgreSQL.</p>
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
      <span>Connection probe: read-only PostgreSQL query</span>
      <span>Sample generated {{ sampleData?.generatedAt ? new Date(sampleData.generatedAt).toLocaleString('en-GB') : 'on request' }}</span>
    </footer>
  </main>
</template>
