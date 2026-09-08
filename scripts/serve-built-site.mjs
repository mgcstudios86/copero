import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.SEO_PREVIEW_PORT || 4173)

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
}

function normalizePathname(pathname) {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

async function loadRedirects() {
  const source = await readFile(join(DIST, '_redirects'), 'utf8')
  const redirects = new Map()

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const [from, to, statusText] = line.split(/\s+/)
    const status = Number(statusText || 302)
    if (from && to && Number.isInteger(status)) redirects.set(from, { to, status })
  }

  return redirects
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

async function resolveStaticFile(pathname) {
  const clean = normalize(pathname).replace(/^[/\\]+/, '')
  if (clean.includes('..')) return null

  const direct = join(DIST, clean)
  if (await isFile(direct)) return direct

  if (!extname(clean)) {
    const html = join(DIST, `${clean}.html`)
    if (await isFile(html)) return html

    const index = join(DIST, clean, 'index.html')
    if (await isFile(index)) return index
  }

  return null
}

const redirects = await loadRedirects()

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || `localhost:${PORT}`}`)
    const pathname = normalizePathname(url.pathname)
    const redirect = redirects.get(pathname)

    if (redirect) {
      response.writeHead(redirect.status, { Location: redirect.to })
      response.end()
      return
    }

    const file = await resolveStaticFile(pathname)
    if (file) {
      const body = await readFile(file)
      response.writeHead(200, {
        'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      response.end(body)
      return
    }

    // SPA fallback: rutas sin extension que no matchean archivo estatico
    // sirven dist/index.html (200) para que BrowserRouter pueda接管 la ruta.
    // Solo aplicar a peticiones GET/HEAD sin extension de archivo.
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      !extname(pathname) &&
      pathname !== '/' &&
      !pathname.startsWith('/api/')
    ) {
      const indexPath = join(DIST, 'index.html')
      try {
        await stat(indexPath)
        const body = await readFile(indexPath)
        response.writeHead(200, {
          'Content-Type': MIME['.html'],
          'Cache-Control': 'no-store',
        })
        response.end(body)
        return
      } catch {
        // index.html ausente: caer al 404 real abajo
      }
    }

    const notFound = join(DIST, '404.html')
    const body = await readFile(notFound)
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(body)
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end(error instanceof Error ? error.message : String(error))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SEO static preview: http://localhost:${PORT}/`)
  console.log('Use View Source on this server to inspect the same prerendered HTML shape that is deployed.')
})
