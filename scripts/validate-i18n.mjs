import { readFile } from 'node:fs/promises'

const locales = ['es', 'en', 'zh-cn', 'de', 'it', 'pt-br', 'ko']
const resourceFiles = ['game.json', 'game-ui.json']
const requiredHomePreviewKeys = [
  'resultCard.eyebrow',
  'resultCard.number',
  'resultCard.overallLabel',
  'resultCard.name',
  'resultCard.description',
  'resultCard.stats.rating',
  'resultCard.stats.clubs',
  'resultCard.stats.trophies',
]

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function collectLeafKeys(value, prefix = '') {
  if (!value || typeof value !== 'object') return [prefix]
  return Object.entries(value).flatMap(([key, child]) => collectLeafKeys(child, prefix ? `${prefix}.${key}` : key))
}

const keysByLocale = new Map()
for (const locale of locales) {
  const merged = {}
  for (const file of resourceFiles) {
    Object.assign(merged, await readJson(`src/i18n/locales/${locale}/${file}`))
  }
  keysByLocale.set(locale, new Set(Object.keys(merged)))
}

const reference = keysByLocale.get('es')
for (const locale of locales.slice(1)) {
  const keys = keysByLocale.get(locale)
  const missing = [...reference].filter((key) => !keys.has(key))
  const extra = [...keys].filter((key) => !reference.has(key))
  if (missing.length || extra.length) {
    throw new Error(
      `${locale} game resources are out of sync. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`,
    )
  }
}

const pageKeys = new Map()
for (const locale of locales) {
  const pages = await readJson(`src/i18n/locales/${locale}/pages.json`)
  pageKeys.set(locale, new Set(collectLeafKeys(pages)))
}
const pageReference = pageKeys.get('es')
for (const locale of locales.slice(1)) {
  const keys = pageKeys.get(locale)
  const missing = [...pageReference].filter((key) => !keys.has(key))
  const extra = [...keys].filter((key) => !pageReference.has(key))
  if (missing.length || extra.length) {
    throw new Error(
      `${locale} info-page resources are out of sync. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`,
    )
  }
}

const homePreviewKeys = new Map()
for (const locale of locales) {
  const preview = await readJson(`src/i18n/locales/${locale}/home-preview.json`)
  const keys = new Set(collectLeafKeys(preview))
  homePreviewKeys.set(locale, keys)
  const missingRequired = requiredHomePreviewKeys.filter((key) => !keys.has(key))
  if (missingRequired.length) {
    throw new Error(`${locale} homepage result preview is missing: ${missingRequired.join(', ')}.`)
  }
}
const homePreviewReference = homePreviewKeys.get('es')
for (const locale of locales.slice(1)) {
  const keys = homePreviewKeys.get(locale)
  const missing = [...homePreviewReference].filter((key) => !keys.has(key))
  const extra = [...keys].filter((key) => !homePreviewReference.has(key))
  if (missing.length || extra.length) {
    throw new Error(
      `${locale} homepage preview resources are out of sync. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`,
    )
  }
}

const engineFiles = [
  'src/engine/game.ts',
  'src/engine/season.ts',
  'src/engine/objectives.ts',
  'src/engine/originStart.ts',
  'src/engine/contract.ts',
  'src/engine/careerPath.ts',
  'src/engine/rating.ts',
  'src/events/resolve.ts',
]

for (const file of engineFiles) {
  const source = await readFile(file, 'utf8')
  if (/from\s+['"][^'"]*i18n\//.test(source) || /from\s+['"][^'"]*i18n['"]/.test(source)) {
    throw new Error(`${file} imports the UI i18n layer. Engine state must stay locale neutral.`)
  }
}

const eventCatalog = await readFile('src/events/catalog.ts', 'utf8')
if (!eventCatalog.includes('titleKey') || !eventCatalog.includes('bodyKey') || !eventCatalog.includes('labelKey')) {
  throw new Error('Career event catalog must keep translation keys instead of rendered copy.')
}

const stateSource = await readFile('src/engine/state.ts', 'utf8')
const cooldownSource = await readFile('src/engine/eventCooldown.ts', 'utf8')
if (!cooldownSource.includes("simulador:career:play:v2:") || !cooldownSource.includes("simulador:career:last-save:v2")) {
  throw new Error('Career save keys changed unexpectedly during the i18n refactor.')
}
if (/STORAGE_PREFIX.*locale|LAST_SAVE_KEY.*locale/i.test(stateSource + cooldownSource)) {
  throw new Error('Locale must not become part of the career save key.')
}

console.log(
  `i18n validation passed: ${reference.size} game keys, ${pageReference.size} info-page keys and ${homePreviewReference.size} homepage preview keys aligned across ${locales.join(', ')}.`,
)
