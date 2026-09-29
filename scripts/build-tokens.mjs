import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

const sourceUrl = new URL('../design-tokens/bgn.tokens.json', import.meta.url)
const outputUrl = new URL('../design-tokens/bgn.tokens.css', import.meta.url)
const source = JSON.parse(await readFile(sourceUrl, 'utf8'))
const tokens = source.tokens

function resolve(value, trail = []) {
  const reference = /^\{([^}]+)\}$/.exec(value)
  if (!reference) return value
  const key = reference[1]
  if (!(key in tokens)) throw new Error(`Unknown token reference: ${key}`)
  if (trail.includes(key)) throw new Error(`Circular token reference: ${[...trail, key].join(' -> ')}`)
  return resolve(tokens[key], [...trail, key])
}

const lines = Object.entries(tokens).map(([name, value]) => `  --${name}: ${resolve(value)};`)
const css = `/* Generated from bgn.tokens.json. Do not edit directly. */\n:root {\n${lines.join('\n')}\n}\n`

if (process.argv.includes('--check')) {
  const current = await readFile(outputUrl, 'utf8').catch(() => '')
  if (current !== css) {
    console.error('Generated token CSS is stale. Run: pnpm tokens:build')
    process.exit(1)
  }
  console.log('Design token CSS is current.')
} else {
  await writeFile(outputUrl, css, 'utf8')
  console.log('Generated design-tokens/bgn.tokens.css')
}
