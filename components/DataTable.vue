<script setup lang="ts">
type CellValue = string | number

type Column = {
  key: string
  label: string
  numeric?: boolean
  status?: boolean
}

defineProps<{
  caption: string
  columns: Column[]
  rows: Record<string, CellValue>[]
}>()

function statusClass(value: CellValue | undefined) {
  const normalized = String(value).toLowerCase()
  if (['healthy', 'ready', 'running', 'succeeded', 'available'].includes(normalized)) return 'table-status--success'
  if (['warning', 'pending', 'degraded'].includes(normalized)) return 'table-status--warning'
  return 'table-status--error'
}
</script>

<template>
  <div class="table-scroll">
    <table class="data-table">
      <caption class="sr-only">{{ caption }}</caption>
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            scope="col"
            :class="{ 'is-numeric': column.numeric }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in rows" :key="String(row.id ?? rowIndex)">
          <td
            v-for="column in columns"
            :key="column.key"
            :class="{ 'is-numeric': column.numeric }"
          >
            <span
              v-if="column.status"
              class="table-status"
              :class="statusClass(row[column.key])"
            >
              {{ row[column.key] }}
            </span>
            <template v-else>{{ row[column.key] }}</template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
