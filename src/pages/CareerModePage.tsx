import { HomepageCareerStarter } from '../components/home/HomepageCareerStarter'
import { SiteFooter } from '../components/layout/SiteFooter'
import { SiteHeader } from '../components/layout/SiteHeader'
import { CAREER_GAME_MODE, CAREER_MODE_PATH, careerModeContent, careerModeSections, type CareerModePageKind } from '../data/career-modes'
import { localizePath, useI18n } from '../i18n/config'

export function CareerModePage({ mode }: { mode: CareerModePageKind }) {
  const { locale } = useI18n()
  const content = careerModeContent[locale][mode]
  const alternateMode = mode === 'full' ? 'quick' : 'full'
  const alternateContent = careerModeContent[locale][alternateMode]
  const sections = careerModeSections(locale, mode)
  const starterId = mode === 'full' ? 'iniciar-carrera-completa' : 'iniciar-carrera-rapida'
  const guideId = mode === 'full' ? 'guia-carrera-completa' : 'guia-carrera-rapida'

  return (
    <div className={`marketing-page build-career-page career-mode-page career-mode-page--${mode}`}>
      <SiteHeader playHref={`#${starterId}`} />
      <main>
        <section className="site-section build-career-hero career-mode-hero">
          <div className="site-container build-career-hero__grid">
            <div className="build-career-hero__copy">
              <p className="eyebrow">{content.hero.eyebrow}</p>
              <h1>{content.hero.title}</h1>
              <p className="lead">{content.hero.lead}</p>
              <div className="build-career-hero__actions">
                <a className="button button--primary" href={`#${starterId}`}>{content.hero.primary}</a>
                <a className="button button--secondary" href={`#${guideId}`}>{content.hero.secondary}</a>
              </div>
              <ul className="build-career-facts">
                {content.hero.facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            </div>
            <aside className="career-mode-board" aria-hidden="true">
              <span>{mode === 'full' ? '01' : '03'}</span>
              <strong>{mode === 'full' ? 'SEASON' : 'SEASONS'}</strong>
              <small>{mode === 'full' ? 'PER CHAPTER' : 'PER CHAPTER'}</small>
              <div><i /><i /><i /><i /></div>
            </aside>
          </div>
        </section>

        <section className="site-section build-career-player" id={starterId}>
          <div className="site-container">
            <HomepageCareerStarter
              entry={mode === 'full' ? 'full_career_page' : 'quick_career_page'}
              gameMode={CAREER_GAME_MODE[mode]}
            />
          </div>
        </section>

        <section className="site-section site-section--seo-intro" id={guideId}>
          <div className="site-container seo-intro-grid">
            <div className="section-heading section-heading--wide"><p className="eyebrow">Copero</p><h2>{content.intro.title}</h2></div>
            <div className="seo-copy">{content.intro.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          </div>
        </section>

        {sections.map((section, index) => (
          <section className={index % 2 ? 'site-section build-career-result-section' : 'site-section'} key={section.title}>
            <div className={`site-container career-mode-content-grid${section.visual ? ' career-mode-content-grid--visual' : ''}`}>
              <div className="section-heading section-heading--wide"><p className="eyebrow">{String(index + 1).padStart(2, '0')}</p><h2>{section.title}</h2></div>
              <div className="seo-copy">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
              {section.visual && <figure className="career-mode-figure"><img src={section.visual.src} alt={section.title} width={section.visual.width} height={section.visual.height} loading="lazy" decoding="async" /><figcaption>{section.title}</figcaption></figure>}
            </div>
          </section>
        ))}

        <section className="site-section">
          <div className="site-container">
            <div className="section-heading"><p className="eyebrow">FAQ</p><h2>{content.faq.title}</h2></div>
            <div className="build-career-faq-list">
              {content.faq.items.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
            </div>
          </div>
        </section>

        <section className="site-section"><div className="site-container"><div className="final-cta build-career-final-cta"><div><h2>{content.finalCta.title}</h2><p className="lead">{content.finalCta.body}</p><div className="build-career-hero__actions"><a className="button button--primary" href={`#${starterId}`}>{content.finalCta.button}</a><a className="button button--secondary" href={localizePath(CAREER_MODE_PATH[alternateMode], locale)}>{alternateContent.hero.title}</a></div></div></div></div></section>
      </main>
      <SiteFooter />
    </div>
  )
}
