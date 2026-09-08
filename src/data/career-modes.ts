import type { Locale } from '../i18n/config'
import type { GameMode } from '../engine/types'
import de from './career-modes/de.json'
import en from './career-modes/en.json'
import es from './career-modes/es.json'
import it from './career-modes/it.json'
import ko from './career-modes/ko.json'
import ptBr from './career-modes/pt-br.json'
import zhCn from './career-modes/zh-cn.json'
import { simuladorCarreraFutbolContent } from './simulador-carrera-futbol'

export type CareerModePageKind = 'full' | 'quick'

export type CareerModeContent = {
  seo: { title: string; description: string }
  hero: {
    eyebrow: string
    title: string
    lead: string
    primary: string
    secondary: string
    facts: string[]
  }
  intro: { title: string; paragraphs: string[] }
  sections: CareerModeSection[]
  faq: { title: string; items: { question: string; answer: string }[] }
  finalCta: { title: string; body: string; button: string }
}

export type CareerModeSection = {
  title: string
  paragraphs: string[]
  visual?: { src: string; width: number; height: number }
}

type CareerModeResource = Record<CareerModePageKind, CareerModeContent>

export const careerModeContent: Record<Locale, CareerModeResource> = {
  es,
  en,
  'zh-cn': zhCn,
  de,
  it,
  'pt-br': ptBr,
  ko,
}

export const CAREER_MODE_PATH: Record<CareerModePageKind, string> = {
  full: '/carrera-completa',
  quick: '/carrera-rapida',
}

export const CAREER_GAME_MODE: Record<CareerModePageKind, GameMode> = {
  full: 'long',
  quick: 'express',
}

const GUIDE_SECTION_INDEXES: Record<Locale, Record<CareerModePageKind, number[]>> = {
  es: { full: [0, 2], quick: [1, 3, 5] },
  en: { full: [0, 2], quick: [1, 3] },
  'zh-cn': { full: [0, 2], quick: [1, 3] },
  de: { full: [0, 2, 4], quick: [1, 3, 5] },
  it: { full: [0, 2, 4], quick: [1, 3, 5] },
  'pt-br': { full: [0, 2, 4], quick: [1, 3, 5] },
  ko: { full: [0, 2, 4, 6], quick: [1, 3, 5, 7] },
}

const MODE_VISUALS: Record<CareerModePageKind, { src: string; width: number; height: number }[]> = {
  full: [
    { src: '/media/minigames/career-simulator/header2.jpg', width: 1200, height: 675 },
    { src: '/career-simulator/career-events/position_competition-compete.jpg', width: 434, height: 365 },
    { src: '/career-simulator/career-events/personal_coach-accept.jpg', width: 514, height: 300 },
    { src: '/career-simulator/career-events/finish_high_school-accept.jpg', width: 369, height: 360 },
  ],
  quick: [
    { src: '/career-simulator/career-events/training_extra-accept.jpg', width: 521, height: 343 },
    { src: '/career-simulator/career-events/season_load-accept.jpg', width: 585, height: 370 },
    { src: '/career-simulator/career-events/retirement.jpg', width: 512, height: 338 },
    { src: '/career-simulator/career-events/injury-continue.jpg', width: 720, height: 342 },
  ],
}

export function careerModeSections(locale: Locale, mode: CareerModePageKind): CareerModeSection[] {
  const original = careerModeContent[locale][mode].sections
  const guide = GUIDE_SECTION_INDEXES[locale][mode].map((sectionIndex, visualIndex) => {
    const section = simuladorCarreraFutbolContent[locale].sections[sectionIndex]
    return { title: section.title, paragraphs: section.paragraphs, visual: MODE_VISUALS[mode][visualIndex] }
  })
  return [...original, ...guide]
}
