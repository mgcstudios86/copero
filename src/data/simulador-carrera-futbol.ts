import type { Locale } from '../i18n/config'
import de from './simulador-carrera-futbol/de.json'
import en from './simulador-carrera-futbol/en.json'
import es from './simulador-carrera-futbol/es.json'
import it from './simulador-carrera-futbol/it.json'
import ko from './simulador-carrera-futbol/ko.json'
import ptBr from './simulador-carrera-futbol/pt-br.json'
import zhCn from './simulador-carrera-futbol/zh-cn.json'

export type SimuladorCarreraFutbolContent = {
  seo: { title: string; description: string }
  hero: {
    eyebrow: string
    title: string
    lead: string
    primary: string
    secondary: string
    factsLabel: string
    facts: string[]
  }
  route: {
    label: string
    live: string
    player: string
    age: string
    stages: { title: string; detail: string }[]
    footer: string
  }
  intro: { eyebrow: string; title: string; paragraphs: string[] }
  sections: { eyebrow: string; title: string; paragraphs: string[] }[]
  faq: { eyebrow: string; title: string; items: { question: string; answer: string }[] }
  finalCta: { eyebrow: string; title: string; body: string; button: string }
}

export const simuladorCarreraFutbolContent: Record<Locale, SimuladorCarreraFutbolContent> = {
  es,
  en,
  'zh-cn': zhCn,
  de,
  it,
  'pt-br': ptBr,
  ko,
}

export const SIMULATOR_SECTION_LIMITS: Record<Locale, number> = {
  es: 5,
  en: 5,
  'zh-cn': 5,
  de: 6,
  it: 6,
  'pt-br': 6,
  ko: 8,
}

export function simulatorSections(locale: Locale) {
  return simuladorCarreraFutbolContent[locale].sections.slice(0, SIMULATOR_SECTION_LIMITS[locale])
}
