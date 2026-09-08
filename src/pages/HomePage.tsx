import { HomepageCareerStarter } from '../components/home/HomepageCareerStarter'
import { SiteFooter } from '../components/layout/SiteFooter'
import { SiteHeader } from '../components/layout/SiteHeader'
import { useI18n } from '../i18n/config'

const ABOUT_PARAGRAPH_KEYS = ['one', 'two'] as const
const STEP_KEYS = ['identity', 'draft', 'origin', 'career'] as const
const MECHANIC_KEYS = ['growth', 'clubs', 'events', 'national'] as const
const FAQ_KEYS = ['what', 'play', 'career', 'football', 'free', 'save', 'classic', 'official'] as const

function CareerResultPreview() {
  const { t } = useI18n()

  return (
    <article className="career-result-card" aria-label={t('home', 'resultCard.eyebrow')}>
      <div className="career-result-card__top">
        <div>
          <p className="eyebrow eyebrow--gold">{t('home', 'resultCard.eyebrow')}</p>
          <div className="career-result-card__number">{t('home', 'resultCard.number')}</div>
        </div>
        <div className="career-result-card__score">
          <strong>92</strong>
          <span>{t('home', 'resultCard.overallLabel')}</span>
        </div>
      </div>
      <div className="career-result-card__name">
        <h2>{t('home', 'resultCard.name')}</h2>
        <p>{t('home', 'resultCard.description')}</p>
      </div>
      <div className="career-result-card__stats">
        <div><span>{t('home', 'resultCard.stats.rating')}</span><strong>S</strong></div>
        <div><span>{t('home', 'resultCard.stats.clubs')}</span><strong>5</strong></div>
        <div><span>{t('home', 'resultCard.stats.trophies')}</span><strong>7</strong></div>
      </div>
      <div className="career-result-card__timeline" aria-hidden="true">
        <span style={{ width: '34%' }} />
        <span style={{ width: '68%' }} />
        <span style={{ width: '92%' }} />
      </div>
    </article>
  )
}

export function HomePage() {
  const { t } = useI18n()

  return (
    <div className="marketing-page">
      <SiteHeader />
      <main>
        <section className="site-section site-section--hero" id="play">
          <div className="site-container play-first-hero">
            <div className="hero-copy">
              <p className="eyebrow">{t('home', 'hero.eyebrow')}</p>
              <h1>
                <span className="hero-title--desktop">{t('home', 'hero.title')}</span>
                <span className="hero-title--mobile">{t('home', 'hero.mobileTitle')}</span>
              </h1>
              <p className="lead hero-body hero-body--desktop">{t('home', 'hero.body')}</p>
              <p className="lead hero-body hero-body--mobile">{t('home', 'hero.mobileBody')}</p>
              <div className="tag-list">
                {(['browser', 'draft', 'career', 'save'] as const).map((key) => (
                  <span className="tag" key={key}>{t('home', `hero.tags.${key}`)}</span>
                ))}
              </div>
              <a className="play-first-hero__how" href="#how-to-play">
                {t('home', 'hero.secondary')} <span aria-hidden="true">↓</span>
              </a>
            </div>
            <HomepageCareerStarter />
          </div>
        </section>

        <section className="site-section site-section--seo-intro" id="what-is-copero">
          <div className="site-container seo-intro-grid">
            <div className="section-heading section-heading--wide">
              <p className="eyebrow">{t('home', 'about.eyebrow')}</p>
              <h2>{t('home', 'about.title')}</h2>
            </div>
            <div className="seo-copy">
              {ABOUT_PARAGRAPH_KEYS.map((key) => (
                <p key={key}>{t('home', `about.paragraphs.${key}`)}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section" id="how-to-play">
          <div className="site-container">
            <div className="section-heading">
              <p className="eyebrow">{t('home', 'howTo.eyebrow')}</p>
              <h2>{t('home', 'howTo.title')}</h2>
              <p className="lead">{t('home', 'howTo.body')}</p>
            </div>
            <div className="card-grid card-grid--two seo-step-grid">
              {STEP_KEYS.map((key, index) => (
                <article className="content-card" key={key}>
                  <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{t('home', `howTo.steps.${key}.title`)}</h3>
                  <p>{t('home', `howTo.steps.${key}.body`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section site-section--split" id="mechanics">
          <div className="site-container">
            <div className="section-heading section-heading--wide">
              <p className="eyebrow">{t('home', 'modes.eyebrow')}</p>
              <h2>{t('home', 'modes.title')}</h2>
              <p className="lead">{t('home', 'modes.body')}</p>
            </div>
            <div className="mode-grid">
              <article className="mode-card mode-card--accent">
                <span className="mode-card__label">01</span>
                <h3>{t('home', 'modes.classic.title')}</h3>
                <p>{t('home', 'modes.classic.body')}</p>
              </article>
              <article className="mode-card">
                <span className="mode-card__label">02</span>
                <h3>{t('home', 'modes.purist.title')}</h3>
                <p>{t('home', 'modes.purist.body')}</p>
              </article>
            </div>

            <div className="section-heading section-heading--wide section-heading--spaced">
              <p className="eyebrow">{t('home', 'mechanics.eyebrow')}</p>
              <h2>{t('home', 'mechanics.title')}</h2>
              <p className="lead">{t('home', 'mechanics.body')}</p>
            </div>
            <div className="card-grid card-grid--two">
              {MECHANIC_KEYS.map((key) => (
                <article className="content-card content-card--rule" key={key}>
                  <h3>{t('home', `mechanics.items.${key}.title`)}</h3>
                  <p>{t('home', `mechanics.items.${key}.body`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container result-story">
            <div>
              <p className="eyebrow eyebrow--gold">{t('home', 'career.eyebrow')}</p>
              <h2>{t('home', 'career.title')}</h2>
              <p className="lead">{t('home', 'career.body')}</p>
              <a className="button button--primary" href="#play">
                {t('home', 'career.cta')}
              </a>
            </div>
            <CareerResultPreview />
          </div>
        </section>

        <section className="site-section" id="faq">
          <div className="site-container">
            <div className="section-heading">
              <p className="eyebrow">{t('home', 'faq.eyebrow')}</p>
              <h2>{t('home', 'faq.title')}</h2>
            </div>
            <div className="faq-grid">
              {FAQ_KEYS.map((key) => (
                <article className="faq-card" key={key}>
                  <h3>{t('home', `faq.items.${key}.question`)}</h3>
                  <p>{t('home', `faq.items.${key}.answer`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="final-cta">
              <p className="eyebrow">{t('home', 'finalCta.eyebrow')}</p>
              <h2>{t('home', 'finalCta.title')}</h2>
              <p className="lead">{t('home', 'finalCta.body')}</p>
              <a className="button button--primary" href="#play">
                {t('home', 'finalCta.button')}
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
