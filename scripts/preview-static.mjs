import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const root = resolve('.output/public')
const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 4173)
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
}

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    let filePath = resolve(root, relativePath)

    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end('Forbidden')
      return
    }

    try {
      const fileStat = await stat(filePath)
      if (fileStat.isDirectory()) filePath = resolve(filePath, 'index.html')
    } catch {
      filePath = resolve(root, 'index.html')
    }

    const body = await readFile(filePath)
    const contentType = contentTypes[extname(filePath)] ?? 'application/octet-stream'
    response.writeHead(200, { 'content-type': contentType })
    response.end(body)
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(port, host, () => {
  console.log(`Static preview: http://${host}:${port}`)
})
