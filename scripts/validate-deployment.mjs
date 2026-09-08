const rawBase = process.env.COPERO_DEPLOYMENT_URL || process.argv[2]
if (!rawBase) {
  console.error('Usage: COPERO_DEPLOYMENT_URL=https://copero.top npm run validate:deployment')
  process.exit(1)
}

const base = rawBase.replace(/\/$/, '')
const infoPages = ['about', 'contact', 'privacy', 'terms']
const locales = [
  { id: 'es', htmlLang: 'es', hrefLang: 'es', prefix: '' },
  { id: 'en', htmlLang: 'en', hrefLang: 'en', prefix: '/en' },
  { id: 'zh-cn', htmlLang: 'zh-CN', hrefLang: 'zh-CN', prefix: '/zh-cn' },
  { id: 'de', htmlLang: 'de', hrefLang: 'de', prefix: '/de' },
  { id: 'it', htmlLang: 'it', hrefLang: 'it', prefix: '/it' },
  { id: 'pt-br', htmlLang: 'pt-BR', hrefLang: 'pt-BR', prefix: '/pt-br' },
  { id: 'ko', htmlLang: 'ko', hrefLang: 'ko', prefix: '/ko' },
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function routePath(locale, page) {
  const suffix = page === 'home' ? '/' : `/${page}`
  return locale.prefix ? `${locale.prefix}${suffix}` : suffix
}

async function request(path, options = {}) {
  return fetch(`${base}${path}`, {
    redirect: 'manual',
    headers: { 'user-agent': 'CoperoReleaseValidator/1.0' },
    ...options,
  })
}

async function html(path) {
  const response = await request(path)
  const body = await response.text()
  return { response, body }
}

const root = await html('/')
assert(root.response.status === 200, `/ must return 200, received ${root.response.status}`)
assert(root.body.includes('<html lang="es"'), '/ must serve Spanish HTML')
assert(root.body.includes('<link rel="canonical" href="https://copero.top/"'), '/ canonical must be https://copero.top/')
assert(root.body.includes('data-prerendered="page"'), '/ must contain prerendered page content')
assert(root.body.includes('<h1>'), '/ raw HTML must contain a visible H1')
assert(!root.body.includes('<div id="root"></div>'), '/ must not be an empty SPA shell')

const legacySpanish = await request('/es/')
assert(legacySpanish.status === 301, `/es/ must return 301, received ${legacySpanish.status}`)
assert(legacySpanish.headers.get('location')?.endsWith('/'), '/es/ must redirect to root')

const legacyGame = await request('/es/game')
assert(legacyGame.status === 301, `/es/game must return 301, received ${legacyGame.status}`)
assert(legacyGame.headers.get('location')?.endsWith('/game'), '/es/game must redirect to /game')

for (const locale of locales) {
  const homePath = routePath(locale, 'home')
  const canonical = `https://copero.top${homePath}`
  const home = await html(homePath)

  assert(home.response.status === 200, `${homePath} must return 200`)
  assert(home.body.includes(`<html lang="${locale.htmlLang}"`), `${homePath} must expose html lang ${locale.htmlLang}`)
  assert(home.body.includes(`<link rel="canonical" href="${canonical}"`), `${homePath} canonical is incorrect`)
  for (const alternate of locales) {
    const alternateUrl = `https://copero.top${routePath(alternate, 'home')}`
    assert(
      home.body.includes(`hreflang="${alternate.hrefLang}" href="${alternateUrl}"`),
      `${homePath} is missing ${alternate.hrefLang} hreflang`,
    )
  }
  assert(home.body.includes('hreflang="x-default" href="https://copero.top/"'), `${homePath} is missing root x-default`)
  assert(home.body.includes('data-prerendered="page"'), `${homePath} must contain prerendered content`)
  assert(home.body.includes('<h1>'), `${homePath} raw HTML must contain H1 content`)
  assert(!/name="robots" content="noindex/i.test(home.body), `${homePath} must remain indexable`)

  for (const page of infoPages) {
    const pagePath = routePath(locale, page)
    const pageCanonical = `https://copero.top${pagePath}`
    const info = await html(pagePath)
    assert(info.response.status === 200, `${pagePath} must return 200`)
    assert(info.body.includes(`<html lang="${locale.htmlLang}"`), `${pagePath} must expose html lang ${locale.htmlLang}`)
    assert(info.body.includes(`<link rel="canonical" href="${pageCanonical}"`), `${pagePath} canonical is incorrect`)
    for (const alternate of locales) {
      const alternateUrl = `https://copero.top${routePath(alternate, page)}`
      assert(
        info.body.includes(`hreflang="${alternate.hrefLang}" href="${alternateUrl}"`),
        `${pagePath} is missing ${alternate.hrefLang} hreflang`,
      )
    }
    assert(info.body.includes(`hreflang="x-default" href="https://copero.top/${page}"`), `${pagePath} x-default is incorrect`)
    assert(info.body.includes('data-prerendered="page"'), `${pagePath} must contain prerendered content`)
    assert(info.body.includes('<h1>'), `${pagePath} raw HTML must contain H1 content`)
    assert(!/name="robots" content="noindex/i.test(info.body), `${pagePath} must remain indexable`)
  }

  const gamePath = routePath(locale, 'game')
  const game = await html(gamePath)
  assert(game.response.status === 200, `${gamePath} must return 200`)
  assert(/name="robots" content="noindex, nofollow"/i.test(game.body), `${gamePath} meta robots must be noindex`)
  assert(/noindex/i.test(game.response.headers.get('x-robots-tag') ?? ''), `${gamePath} X-Robots-Tag must be noindex`)
}

for (const page of infoPages) {
  const legacy = await request(`/es/${page}`)
  assert(legacy.status === 301, `/es/${page} must return 301`)
  assert(legacy.headers.get('location')?.endsWith(`/${page}`), `/es/${page} must redirect to /${page}`)
}

const sitemap = await html('/sitemap.xml')
assert(sitemap.response.status === 200, '/sitemap.xml must return 200')
for (const locale of locales) {
  assert(sitemap.body.includes(`<loc>https://copero.top${routePath(locale, 'home')}</loc>`), `sitemap is missing ${routePath(locale, 'home')}`)
  for (const page of infoPages) {
    assert(sitemap.body.includes(`<loc>https://copero.top${routePath(locale, page)}</loc>`), `sitemap is missing ${routePath(locale, page)}`)
  }
}
assert(!sitemap.body.includes('<loc>https://copero.top/es/</loc>'), 'sitemap must not include legacy /es/ homepage')
assert(!sitemap.body.includes('/game</loc>'), 'sitemap must not include game routes')

const missingPath = `/__copero-release-check-${Date.now()}`
const missing = await html(missingPath)
assert(missing.response.status === 404, `unknown path must return 404, received ${missing.response.status}`)
assert(/noindex/i.test(missing.body), '404 response must include noindex')

if (new URL(base).hostname.endsWith('.pages.dev')) {
  const preview = await request('/')
  assert(/noindex/i.test(preview.headers.get('x-robots-tag') ?? ''), 'pages.dev preview must expose X-Robots-Tag noindex')
}

console.log(`Deployment validation passed for ${base}.`)
