import { readFile } from 'node:fs/promises'

const files = {
  index: await readFile(new URL('../index.html', import.meta.url), 'utf8'),
  robots: await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8'),
  sitemap: await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8'),
  redirects: await readFile(new URL('../public/_redirects', import.meta.url), 'utf8'),
  headers: (await readFile(new URL('../public/_headers', import.meta.url), 'utf8')).replaceAll('\r\n', '\n'),
  env: await readFile(new URL('../.env.example', import.meta.url), 'utf8'),
  analytics: await readFile(new URL('../src/lib/analytics.ts', import.meta.url), 'utf8'),
  siteHeader: await readFile(new URL('../src/components/layout/SiteHeader.tsx', import.meta.url), 'utf8'),
  packageJson: await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  viteConfig: await readFile(new URL('../vite.config.ts', import.meta.url), 'utf8'),
  wrangler: await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
}

const wranglerConfig = JSON.parse(files.wrangler)
const infoPages = ['about', 'contact', 'privacy', 'terms']
const prefixedLocales = ['en', 'zh-cn', 'de', 'it', 'pt-br', 'ko']

const assertions = [
  ['fallback template remains noindex until prerender completes', files.index.includes('<meta name="robots" content="noindex, follow"')],
  ['fallback template canonical points to root', files.index.includes('<link rel="canonical" href="https://copero.top/"')],
  ['root is not redirected away from Spanish content', !files.redirects.includes('/ /es/ 301')],
  ['legacy /es homepage redirects to root', files.redirects.includes('/es/ / 301')],
  ['legacy /es game redirects to root game', files.redirects.includes('/es/game /game 301')],
  ...infoPages.map((page) => [
    `legacy /es/${page} redirects to root ${page}`,
    files.redirects.includes(`/es/${page} /${page} 301`),
  ]),
  ['robots sitemap', files.robots.includes('Sitemap: https://copero.top/sitemap.xml')],
  ['Spanish sitemap homepage is root', files.sitemap.includes('<loc>https://copero.top/</loc>')],
  ...infoPages.map((page) => [
    `Spanish sitemap ${page} is unprefixed`,
    files.sitemap.includes(`<loc>https://copero.top/${page}</loc>`),
  ]),
  ['sitemap excludes Spanish /es homepage duplicate', !files.sitemap.includes('<loc>https://copero.top/es/</loc>')],
  ...prefixedLocales.flatMap((locale) => [
    [`${locale} sitemap homepage`, files.sitemap.includes(`<loc>https://copero.top/${locale}/</loc>`)],
    ...infoPages.map((page) => [
      `${locale} sitemap ${page}`,
      files.sitemap.includes(`<loc>https://copero.top/${locale}/${page}</loc>`),
    ]),
  ]),
  ['sitemap excludes noindex game pages', !files.sitemap.includes('/game</loc>')],
  ['Spanish game X-Robots noindex', files.headers.includes('/game\n  X-Robots-Tag: noindex, nofollow')],
  ...prefixedLocales.map((locale) => [
    `${locale} game X-Robots noindex`,
    files.headers.includes(`/${locale}/game\n  X-Robots-Tag: noindex, nofollow`),
  ]),
  ['Pages previews noindex', files.headers.includes('https://:project.pages.dev/*')],
  ['header uses public favicon logo', files.siteHeader.includes('src="/favicon.svg"')],
  [
    'Vite build owns Spanish root prerender promotion',
    files.viteConfig.includes("name: 'copero-static-seo-build'") &&
      files.viteConfig.includes("'scripts/prerender.mjs'") &&
      files.viteConfig.includes("'scripts/promote-default-locale.mjs'"),
  ],
  ['package build executes Vite build', files.packageJson.includes('"build": "tsc -b && vite build"')],
  ['Wrangler deploys the generated dist directory', wranglerConfig.assets?.directory === './dist'],
  ['Wrangler uses SSG-style HTML handling', wranglerConfig.assets?.html_handling === 'auto-trailing-slash'],
  ['Wrangler uses the generated 404 page', wranglerConfig.assets?.not_found_handling === '404-page'],
  ['Wrangler includes GA4 public config', Object.hasOwn(wranglerConfig.vars ?? {}, 'VITE_GA_MEASUREMENT_ID')],
  ['Wrangler includes Clarity public config', Object.hasOwn(wranglerConfig.vars ?? {}, 'VITE_CLARITY_PROJECT_ID')],
  [
    'Vite can read public analytics config from Wrangler',
    files.viteConfig.includes('readWranglerPublicVars') &&
      files.viteConfig.includes('wranglerVars?.VITE_GA_MEASUREMENT_ID') &&
      files.viteConfig.includes('wranglerVars?.VITE_CLARITY_PROJECT_ID'),
  ],
  ['GA4 environment variable', files.env.includes('VITE_GA_MEASUREMENT_ID=')],
  ['Clarity environment variable', files.env.includes('VITE_CLARITY_PROJECT_ID=')],
  ['analytics avoids PII field', !files.analytics.includes('lastName')],
]

const failures = assertions.filter(([, passed]) => !passed).map(([label]) => label)
if (failures.length > 0) {
  console.error(`Launch validation failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`Launch validation passed (${assertions.length} checks).`)
}
