import { access, readFile } from 'node:fs/promises'

const required = [
  'app.vue',
  'nuxt.config.ts',
  'Dockerfile',
  'design-tokens/bgn.tokens.json',
  'design-tokens/bgn.tokens.css',
  'server/api/database-status.get.ts',
  'server/api/sample-data.get.ts',
  'server/routes/healthz.get.ts'
]

for (const file of required) await access(file)

const app = await readFile('app.vue', 'utf8')
const normalizedApp = app.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
for (const text of ['TEST FE WITH DB', 'role="tablist"', 'aria-live="polite"']) {
  const source = text.startsWith('role=') || text.startsWith('aria-') ? app : normalizedApp
  if (!source.includes(text)) throw new Error(`app.vue is missing required UI contract: ${text}`)
}

const dockerfile = await readFile('Dockerfile', 'utf8')
if (!dockerfile.includes('EXPOSE 3000') || !dockerfile.includes('/healthz')) {
  throw new Error('Dockerfile must expose port 3000 and check /healthz')
}

console.log('Project structure and UI contracts are valid.')
