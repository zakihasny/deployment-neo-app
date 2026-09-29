import { access, readFile } from 'node:fs/promises'

const required = [
  'app.vue',
  'nuxt.config.ts',
  'package.json',
  'scripts/preview-static.mjs',
  'design-tokens/bgn.tokens.json',
  'design-tokens/bgn.tokens.css'
]

for (const file of required) await access(file)

const app = await readFile('app.vue', 'utf8')
const normalizedApp = app.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
for (const text of ['TEST FE WITH DB', 'No database connection is required', 'role="tablist"', 'aria-live="polite"']) {
  const source = text.startsWith('role=') || text.startsWith('aria-') ? app : normalizedApp
  if (!source.includes(text)) throw new Error(`app.vue is missing required UI contract: ${text}`)
}

if (['/api/', 'DATABASE_URL', 'useFetch'].some(text => app.includes(text))) {
  throw new Error('Static app must not call server-side APIs or database configuration')
}

const tabEntries = app.match(/\{ key: '(services|databases|deployments)'/g) ?? []
if (tabEntries.length !== 3) throw new Error('Static app must define exactly three tabs')

const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
if (packageJson.scripts?.build !== 'nuxt generate') throw new Error('Static build must run nuxt generate')
if (packageJson.scripts?.preview !== 'node scripts/preview-static.mjs') throw new Error('Static preview must serve the generated output')
if (packageJson.dependencies?.pg || packageJson.devDependencies?.['@types/pg']) {
  throw new Error('Static branch must not include PostgreSQL packages')
}

const nuxtConfig = await readFile('nuxt.config.ts', 'utf8')
if (!nuxtConfig.includes('ssr: false') || !nuxtConfig.includes("preset: 'static'")) {
  throw new Error('Nuxt must use SPA rendering and the static Nitro preset')
}

for (const forbidden of ['Dockerfile', 'compose.yaml', '.env.example']) {
  try {
    await access(forbidden)
    throw new Error(`Static branch contains forbidden runtime artifact: ${forbidden}`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Static branch')) throw error
  }
}

console.log('Static project structure and UI contracts are valid.')
