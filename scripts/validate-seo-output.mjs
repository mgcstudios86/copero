import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const SITE = 'https://copero.top'
const INFO_PAGES = ['about', 'contact', 'privacy', 'terms']
const CAREER = 'copero-build-your-own-football-career'
const CAREER_MODES = [
  { id: 'full', slug: 'carrera-completa' },
  { id: 'quick', slug: 'carrera-rapida' },
]
const LOCALES = [
  { id: 'es', htmlLang: 'es', hrefLang: 'es', prefix: '' },
  { id: 'en', htmlLang: 'en', hrefLang: 'en', prefix: '/en' },
  { id: 'zh-cn', htmlLang: 'zh-CN', hrefLang: 'zh-CN', prefix: '/zh-cn' },
  { id: 'de', htmlLang: 'de', hrefLang: 'de', prefix: '/de' },
  { id: 'it', htmlLang: 'it', hrefLang: 'it', prefix: '/it' },
  { id: 'pt-br', htmlLang: 'pt-BR', hrefLang: 'pt-BR', prefix: '/pt-br' },
  { id: 'ko', htmlLang: 'ko', hrefLang: 'ko', prefix: '/ko' },
]

const failures = []
const check = (label, condition) => { if (!condition) failures.push(label) }

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function routePath(locale, page) {
  const suffix = page === 'home' ? '/' : `/${page}`
  return locale.prefix ? `${locale.prefix}${suffix}` : suffix
}

function routeFile(locale, page) {
  const file = page === 'home' ? 'index.html' : `${page}.html`
  return locale.prefix ? join(DIST, locale.id, file) : join(DIST, file)
}

async function loadCareer(locale) {
  const path = locale.id === 'en'
    ? join(ROOT, 'src', 'data', 'build-career-page.json')
    : join(ROOT, 'src', 'data', 'build-career', `${locale.id}.json`)
  return JSON.parse(await readFile(path, 'utf8'))
}

for (const locale of LOCALES) {
  const homeResource = JSON.parse(await readFile(join(ROOT, 'src', 'i18n', 'locales', locale.id, 'home.json'), 'utf8'))
  const pagesResource = JSON.parse(await readFile(join(ROOT, 'src', 'i18n', 'locales', locale.id, 'pages.json'), 'utf8'))
  const home = await readFile(routeFile(locale, 'home'), 'utf8')
  const game = await readFile(routeFile(locale, 'game'), 'utf8')

  check(`${locale.id} home lang`, home.includes(`<html lang="${locale.htmlLang}">`))
  check(`${locale.id} home title`, home.includes(`<title>${escapeHtml(homeResource.seo.title)}</title>`))
  check(`${locale.id} home H1`, home.includes(`<h1>${escapeHtml(homeResource.hero.title)}</h1>`))
  check(`${locale.id} home canonical`, home.includes(`<link rel="canonical" href="${SITE}${routePath(locale, 'home')}"`))
  check(`${locale.id} home prerender`, home.includes('data-prerendered="page"'))
  check(`${locale.id} game noindex`, game.includes('content="noindex, nofollow"'))

  for (const alternate of LOCALES) {
    check(`${locale.id} home hreflang ${alternate.hrefLang}`, home.includes(`hreflang="${alternate.hrefLang}" href="${SITE}${routePath(alternate, 'home')}"`))
  }

  for (const page of INFO_PAGES) {
    const html = await readFile(routeFile(locale, page), 'utf8')
    const resource = pagesResource[page]
    check(`${locale.id}/${page} title`, html.includes(`<title>${escapeHtml(resource.seo.title)}</title>`))
    check(`${locale.id}/${page} H1`, html.includes(`<h1>${escapeHtml(resource.title)}</h1>`))
    check(`${locale.id}/${page} canonical`, html.includes(`<link rel="canonical" href="${SITE}${routePath(locale, page)}"`))
    check(`${locale.id}/${page} prerender`, html.includes('data-prerendered="page"'))
  }

  const careerResource = await loadCareer(locale)
  const careerFile = locale.prefix ? join(DIST, locale.id, `${CAREER}.html`) : join(DIST, `${CAREER}.html`)
  const careerHtml = await readFile(careerFile, 'utf8')
  const careerUrl = `${SITE}${locale.prefix}/${CAREER}`

  check(`${locale.id} career lang`, careerHtml.includes(`<html lang="${locale.htmlLang}">`))
  check(`${locale.id} career title`, careerHtml.includes(`<title>${escapeHtml(careerResource.seo.title)}</title>`))
  check(`${locale.id} career description`, careerHtml.includes(`content="${escapeHtml(careerResource.seo.description)}"`))
  check(`${locale.id} career H1`, careerHtml.includes(`<h1>${escapeHtml(careerResource.hero.title)}</h1>`))
  check(`${locale.id} career canonical`, careerHtml.includes(`<link rel="canonical" href="${careerUrl}"`))
  check(`${locale.id} career prerender`, careerHtml.includes('data-prerendered="page"'))
  check(`${locale.id} career indexable`, careerHtml.includes('content="index, follow"'))
  check(`${locale.id} career WebPage schema`, careerHtml.includes('"@type":"WebPage"'))
  check(`${locale.id} career WebApplication schema`, careerHtml.includes('"@type":"WebApplication"'))

  for (const alternate of LOCALES) {
    const alternateUrl = `${SITE}${alternate.prefix}/${CAREER}`
    check(`${locale.id} career hreflang ${alternate.hrefLang}`, careerHtml.includes(`hreflang="${alternate.hrefLang}" href="${alternateUrl}"`))
  }
  check(`${locale.id} career x-default`, careerHtml.includes(`hreflang="x-default" href="${SITE}/${CAREER}"`))

  const modeResource = JSON.parse(await readFile(join(ROOT, 'src', 'data', 'career-modes', `${locale.id}.json`), 'utf8'))
  for (const mode of CAREER_MODES) {
    const content = modeResource[mode.id]
    const html = await readFile(routeFile(locale, mode.slug), 'utf8')
    const url = `${SITE}${locale.prefix}/${mode.slug}`
    check(`${locale.id}/${mode.slug} lang`, html.includes(`<html lang="${locale.htmlLang}">`))
    check(`${locale.id}/${mode.slug} title`, html.includes(`<title>${escapeHtml(content.seo.title)}</title>`))
    check(`${locale.id}/${mode.slug} description`, html.includes(`content="${escapeHtml(content.seo.description)}"`))
    check(`${locale.id}/${mode.slug} H1`, html.includes(`<h1>${escapeHtml(content.hero.title)}</h1>`))
    check(`${locale.id}/${mode.slug} canonical`, html.includes(`<link rel="canonical" href="${url}"`))
    check(`${locale.id}/${mode.slug} prerender`, html.includes('data-prerendered="page"'))
    check(`${locale.id}/${mode.slug} indexable`, html.includes('content="index, follow"'))
    check(`${locale.id}/${mode.slug} WebPage schema`, html.includes('"@type":"WebPage"'))
    check(`${locale.id}/${mode.slug} WebApplication schema`, html.includes('"@type":"WebApplication"'))
    check(`${locale.id}/${mode.slug} visual content`, html.includes('class="career-mode-figure"') && html.includes('loading="lazy"') && html.includes('<figcaption>'))
    for (const alternate of LOCALES) {
      check(`${locale.id}/${mode.slug} hreflang ${alternate.hrefLang}`, html.includes(`hreflang="${alternate.hrefLang}" href="${SITE}${alternate.prefix}/${mode.slug}"`))
    }
    check(`${locale.id}/${mode.slug} x-default`, html.includes(`hreflang="x-default" href="${SITE}/${mode.slug}"`))
  }
}

const redirects = await readFile(join(DIST, '_redirects'), 'utf8')
const sitemap = await readFile(join(DIST, 'sitemap.xml'), 'utf8')
const robots = await readFile(join(DIST, 'robots.txt'), 'utf8')
check('legacy Spanish homepage redirect', redirects.includes('/es/ / 301'))
check('legacy Spanish career redirect', redirects.includes(`/es/${CAREER} /${CAREER} 301`))
for (const mode of CAREER_MODES) check(`legacy Spanish ${mode.slug} redirect`, redirects.includes(`/es/${mode.slug} /${mode.slug} 301`))
check('robots sitemap declaration', robots.includes(`Sitemap: ${SITE}/sitemap.xml`))
check('sitemap excludes game routes', !sitemap.includes('/game</loc>'))
check('sitemap excludes legacy Spanish locale', !sitemap.includes(`<loc>${SITE}/es/`))

for (const locale of LOCALES) {
  check(`${locale.id} sitemap home`, sitemap.includes(`<loc>${SITE}${routePath(locale, 'home')}</loc>`))
  check(`${locale.id} sitemap career`, sitemap.includes(`<loc>${SITE}${locale.prefix}/${CAREER}</loc>`))
  for (const mode of CAREER_MODES) check(`${locale.id} sitemap ${mode.slug}`, sitemap.includes(`<loc>${SITE}${locale.prefix}/${mode.slug}</loc>`))
  for (const page of INFO_PAGES) check(`${locale.id} sitemap ${page}`, sitemap.includes(`<loc>${SITE}${routePath(locale, page)}</loc>`))
}

if (failures.length) {
  console.error(`SEO output validation failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log('SEO output validation passed: seven localized page sets, build-career pages and fourteen career-mode pages are prerendered, canonicalized and listed in sitemap.xml.')
}
