import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONTENT_DIR = join(ROOT, 'src', 'data', 'simulador-carrera-futbol')

const CONFIG = {
  es: {
    locale: 'es',
    sectionLimit: 5,
    phrases: ['simulador de carrera de fútbol', 'simulador carrera fútbol', 'juego de carrera de fútbol'],
  },
  en: {
    locale: 'en',
    sectionLimit: 5,
    phrases: ['football player career simulator', 'online football career simulator', 'football career simulator', 'online football career game', 'football career game', 'career generator'],
  },
  'zh-cn': {
    locale: 'zh-CN',
    sectionLimit: 5,
    phrases: ['足球球员生涯模拟器', '在线足球职业生涯游戏', '足球职业生涯模拟', '足球生涯模拟器'],
  },
  de: {
    locale: 'de',
    sectionLimit: 6,
    phrases: ['fußballspieler karriere simulator', 'fußball karriere simulator', 'fußball karriere simulation', 'fußballkarriere', 'fußballspieler', 'laufbahn'],
  },
  it: {
    locale: 'it',
    sectionLimit: 6,
    phrases: ['simulatore di carriera calcistica', 'simulatore carriera calciatore', 'gioco carriera calciatore', 'carriera calcistica'],
  },
  'pt-br': {
    locale: 'pt-BR',
    sectionLimit: 6,
    phrases: ['simulador carreira jogador de futebol', 'simulador de carreira de futebol'],
  },
  ko: {
    locale: 'ko',
    sectionLimit: 8,
    phrases: ['온라인 축구 커리어 시뮬레이터', '축구 선수 커리어 시뮬레이터', '축구 커리어 시뮬레이터'],
  },
}

function collectStrings(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(collectStrings)
}

function renderedContent(content, sectionLimit) {
  return {
    hero: content.hero,
    route: content.route,
    intro: content.intro,
    sections: content.sections.slice(0, sectionLimit),
    faq: content.faq,
    finalCta: content.finalCta,
  }
}

function longFormProse(content, sectionLimit) {
  return [
    content.hero.lead,
    ...content.intro.paragraphs,
    ...content.sections.slice(0, sectionLimit).flatMap((section) => section.paragraphs),
    ...content.faq.items.map((item) => item.answer),
    content.finalCta.body,
  ].join(' ')
}

function wordSegments(text, locale) {
  const segmenter = new Intl.Segmenter(locale, { granularity: 'word' })
  return [...segmenter.segment(text)].filter((part) => part.isWordLike)
}

function keywordCoverage(text, locale, phrases) {
  const lower = text.toLocaleLowerCase(locale)
  const spans = []
  const sortedPhrases = [...phrases].sort((a, b) => b.length - a.length)

  for (const phrase of sortedPhrases) {
    const needle = phrase.toLocaleLowerCase(locale)
    let start = 0
    while (start < lower.length) {
      const index = lower.indexOf(needle, start)
      if (index === -1) break
      const end = index + needle.length
      const overlaps = spans.some((span) => index < span.end && end > span.start)
      if (!overlaps) spans.push({ start: index, end })
      start = index + needle.length
    }
  }

  const segments = wordSegments(text, locale)
  const keywordWords = segments.filter((part) =>
    spans.some((span) => part.index >= span.start && part.index < span.end),
  ).length
  return {
    density: segments.length ? (keywordWords / segments.length) * 100 : 0,
    keywordWords,
    totalWords: segments.length,
  }
}

const failures = []

for (const [id, config] of Object.entries(CONFIG)) {
  const content = JSON.parse(await readFile(join(CONTENT_DIR, `${id}.json`), 'utf8'))
  const visible = renderedContent(content, config.sectionLimit)
  const visibleText = collectStrings(visible).join(' ')
  const pageWords = wordSegments(visibleText, config.locale).length
  const prose = longFormProse(content, config.sectionLimit)
  const { density, keywordWords, totalWords: proseWords } = keywordCoverage(prose, config.locale, config.phrases)
  const densityRounded = Number(density.toFixed(2))

  console.log(`${id}: ${pageWords} page words; ${proseWords} prose words, ${keywordWords} keyword-family words, ${densityRounded}% prose coverage`)

  if (pageWords < 1200 || pageWords > 1800) {
    failures.push(`${id} page word count ${pageWords} is outside 1200-1800`)
  }
  if (density < 3.5 || density > 5) {
    failures.push(`${id} keyword-family prose coverage ${densityRounded}% is outside 3.5-5%`)
  }
}

if (failures.length) {
  console.error(`Simulator content validation failed:\n- ${failures.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log('Simulator content validation passed for all seven rendered locale pages.')
}
