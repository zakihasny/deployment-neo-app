import { spawnSync } from 'node:child_process'
const result = spawnSync('docker', ['compose', '-f', 'compose.test.yaml', 'logs', '--tail', '45'], { encoding: 'utf8' })
const text = (result.stdout || '') + '\n' + (result.stderr || '')
console.log(text.replace(/(?:postgres(?:ql)?|mysql|redis|rediss):\/\/[^\s"']+/gi, '[CONNECTION REDACTED]').replace(/fixture-[a-z-]*password/gi, '[FIXTURE PASSWORD REDACTED]'))
