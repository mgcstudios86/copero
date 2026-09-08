import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONTENT_DIR = join(ROOT, 'src', 'data', 'career-modes')
const MODES = ['full', 'quick']
const GUIDE_SECTION_INDEXES = {
  es: { full: [0, 2], quick: [1, 3, 5] },
  en: { full: [0, 2], quick: [1, 3] },
  'zh-cn': { full: [0, 2], quick: [1, 3] },
  de: { full: [0, 2, 4], quick: [1, 3, 5] },
  it: { full: [0, 2, 4], quick: [1, 3, 5] },
  'pt-br': { full: [0, 2, 4], quick: [1, 3, 5] },
  ko: { full: [0, 2, 4, 6], quick: [1, 3, 5, 7] },
}
const CONFIG = {
  es: { locale: 'es', full: ['carrera completa', 'modo carrera', 'carrera de fútbol'], quick: ['carrera rápida', 'modo rápido', 'carrera exprés'] },
  en: { locale: 'en', full: ['full career', 'career mode', 'football career'], quick: ['quick career', 'speed career', 'fast career'] },
  'zh-cn': { locale: 'zh-CN', full: ['完整生涯', '生涯模式', '足球生涯'], quick: ['快速生涯', '快速模式', '足球生涯'] },
  de: { locale: 'de', full: ['volle karriere', 'karrieremodus', 'fußballkarriere'], quick: ['schnelle karriere', 'schnellmodus', 'fußballkarriere'] },
  it: { locale: 'it', full: ['carriera completa', 'modalità carriera', 'carriera calcistica'], quick: ['carriera veloce', 'modalità rapida', 'carriera calcistica'] },
  'pt-br': { locale: 'pt-BR', full: ['carreira completa', 'modo carreira', 'carreira de futebol'], quick: ['carreira rápida', 'modo rápido', 'carreira de futebol'] },
  ko: { locale: 'ko', full: ['전체 커리어', '커리어 모드', '축구 커리어'], quick: ['빠른 커리어', '빠른 모드', '축구 커리어'] },
}

function prose(content) {
  return [
    content.hero.lead,
    ...content.intro.paragraphs,
    ...content.sections.flatMap((section) => section.paragraphs),
    ...content.faq.items.map((item) => item.answer),
    content.finalCta.body,
  ].join(' ')
}

function words(text, locale) {
  return [...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)].filter((part) => part.isWordLike)
}

function collectStrings(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(collectStrings)
}

function coverage(text, locale, phrases) {
  const lower = text.toLocaleLowerCase(locale)
  const spans = []
  for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
    const needle = phrase.toLocaleLowerCase(locale)
    let start = 0
    while (start < lower.length) {
      const index = lower.indexOf(needle, start)
      if (index === -1) break
      const end = index + needle.length
      if (!spans.some((span) => index < span.end && end > span.start)) spans.push({ start: index, end })
      start = end
    }
  }
  const segments = words(text, locale)
  const keywordWords = segments.filter((part) => spans.some((span) => part.index >= span.start && part.index < span.end)).length
  return { total: segments.length, keywordWords, density: segments.length ? keywordWords / segments.length * 100 : 0 }
}

const failures = []
for (const [id, config] of Object.entries(CONFIG)) {
  let resource
  try {
    resource = JSON.parse(await readFile(join(CONTENT_DIR, `${id}.json`), 'utf8'))
  } catch (error) {
    failures.push(`${id} content file is missing or invalid: ${error.message}`)
    continue
  }
  const simulator = JSON.parse(await readFile(join(ROOT, 'src', 'data', 'simulador-carrera-futbol', `${id}.json`), 'utf8'))

  for (const mode of MODES) {
    const content = resource[mode]
    if (!content) {
      failures.push(`${id}/${mode} content is missing`)
      continue
    }
    if (!content.seo.title.toLocaleLowerCase(config.locale).includes(config[mode][0].toLocaleLowerCase(config.locale))) failures.push(`${id}/${mode} title misses primary phrase`)
    if (!content.seo.description.toLocaleLowerCase(config.locale).includes(config[mode][0].toLocaleLowerCase(config.locale))) failures.push(`${id}/${mode} description misses primary phrase`)
    if (!content.hero.title.toLocaleLowerCase(config.locale).includes(config[mode][0].toLocaleLowerCase(config.locale))) failures.push(`${id}/${mode} H1 misses primary phrase`)
    const cjk = id === 'zh-cn' || id === 'ko'
    const titleRange = cjk ? [18, 35] : [35, 65]
    const descriptionRange = cjk ? [35, 90] : [120, 170]
    if (content.seo.title.length < titleRange[0] || content.seo.title.length > titleRange[1]) failures.push(`${id}/${mode} title length ${content.seo.title.length} is outside ${titleRange.join('-')}`)
    if (content.seo.description.length < descriptionRange[0] || content.seo.description.length > descriptionRange[1]) failures.push(`${id}/${mode} description length ${content.seo.description.length} is outside ${descriptionRange.join('-')}`)
    if (content.sections.length < 4) failures.push(`${id}/${mode} needs at least four substantive sections`)
    if (content.faq.items.length < 4) failures.push(`${id}/${mode} needs at least four FAQ items`)

    const pageProse = prose(content)
    for (const supportingPhrase of config[mode].slice(1)) {
      if (!pageProse.toLocaleLowerCase(config.locale).includes(supportingPhrase.toLocaleLowerCase(config.locale))) failures.push(`${id}/${mode} misses supporting phrase: ${supportingPhrase}`)
    }
    const result = coverage(pageProse, config.locale, [config[mode][0]])
    const guideSections = GUIDE_SECTION_INDEXES[id][mode].map((index) => simulator.sections[index])
    const pageWordCount = words([...collectStrings(content), ...collectStrings(guideSections)].join(' '), config.locale).length
    const rounded = Number(result.density.toFixed(2))
    console.log(`${id}/${mode}: ${pageWordCount} visible words; ${result.total} targeted prose words, ${result.keywordWords} primary-keyword words, ${rounded}% targeted coverage`)
    if (pageWordCount < 1000 || pageWordCount > 1250) failures.push(`${id}/${mode} has ${pageWordCount} visible words; target is 1000-1250`)
    if (result.density < 3.5 || result.density > 5) failures.push(`${id}/${mode} primary-keyword coverage ${rounded}% is outside 3.5-5%`)
  }
  if (resource.full.seo.title === resource.quick.seo.title || resource.full.seo.description === resource.quick.seo.description) failures.push(`${id} mode pages need unique SEO metadata`)
}

if (failures.length) {
  console.error(`Career mode content validation failed:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log('Career mode content validation passed for all fourteen localized pages.')
}
