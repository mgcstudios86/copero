import type { Locale } from '../i18n/config'
import en from './build-career-page.json'
import es from './build-career/es.json'
import zhCn from './build-career/zh-cn.json'
import de from './build-career/de.json'
import it from './build-career/it.json'
import ptBr from './build-career/pt-br.json'
import ko from './build-career/ko.json'

export type BuildCareerContent = typeof en

const contentByLocale: Record<Locale, BuildCareerContent> = {
  es,
  en,
  'zh-cn': zhCn,
  de,
  it,
  'pt-br': ptBr,
  ko,
}

export function getBuildCareerContent(locale: Locale): BuildCareerContent {
  return contentByLocale[locale]
}
