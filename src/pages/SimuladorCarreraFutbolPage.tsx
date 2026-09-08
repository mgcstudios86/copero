import heroImage from '../assets/hero.png'
import { HomepageCareerStarter } from '../components/home/HomepageCareerStarter'
import { SiteFooter } from '../components/layout/SiteFooter'
import { SiteHeader } from '../components/layout/SiteHeader'
import { useI18n } from '../i18n/config'
import { simuladorCarreraFutbolContent, simulatorSections } from '../data/simulador-carrera-futbol'

function SimulatorSectionVisual({ index, stages }: { index: number; stages: { title: string; detail: string }[] }) {
  const visual = index % 6

  if (visual === 0) {
    return (
      <div className="simulator-visual simulator-player-card" aria-hidden="true">
        <div className="simulator-player-card__image-wrap">
          <img src={heroImage} alt="" />
          <span className="simulator-player-card__rating">84</span>
          <span className="simulator-player-card__position">ST</span>
        </div>
        <div className="simulator-player-card__name">YOUR PLAYER</div>
        <div className="simulator-player-card__stats">
          <span><strong>88</strong><small>PAC</small></span>
          <span><strong>85</strong><small>SHO</small></span>
          <span><strong>79</strong><small>PAS</small></span>
          <span><strong>86</strong><small>DRI</small></span>
        </div>
      </div>
    )
  }

  if (visual === 1) {
    return (
      <div className="simulator-visual simulator-pitch" aria-hidden="true">
        <div className="simulator-pitch__line simulator-pitch__line--half" />
        <div className="simulator-pitch__circle" />
        <div className="simulator-pitch__box simulator-pitch__box--top" />
        <div className="simulator-pitch__box simulator-pitch__box--bottom" />
        {['GK', 'CB', 'CM', 'LW', 'ST', 'RW'].map((position, positionIndex) => (
          <span className={`simulator-pitch__player simulator-pitch__player--${positionIndex + 1}`} key={position}>{position}</span>
        ))}
      </div>
    )
  }

  if (visual === 2) {
    return (
      <div className="simulator-visual simulator-transfer-board" aria-hidden="true">
        <div className="simulator-transfer-board__header"><span>TRANSFER DESK</span><strong>LIVE</strong></div>
        {[['01', '+12', 'FIRST CLUB'], ['02', '+18', 'BREAKTHROUGH'], ['03', '+27', 'BIG MOVE'], ['04', '+34', 'LEGACY']].map(([step, value, label]) => (
          <div className="simulator-transfer-board__row" key={step}>
            <span>{step}</span><strong>{label}</strong><b>{value}</b>
          </div>
        ))}
      </div>
    )
  }

  if (visual === 3) {
    return (
      <div className="simulator-visual simulator-trophy-case" aria-hidden="true">
        <div className="simulator-trophy-case__trophy">★</div>
        <div className="simulator-trophy-case__label">CAREER HONOURS</div>
        <div className="simulator-trophy-case__grid">
          <span><strong>4</strong><small>LEAGUES</small></span>
          <span><strong>2</strong><small>CUPS</small></span>
          <span><strong>1</strong><small>EUROPE</small></span>
          <span><strong>87</strong><small>PEAK OVR</small></span>
        </div>
      </div>
    )
  }

  if (visual === 4) {
    return (
      <div className="simulator-visual simulator-attribute-board" aria-hidden="true">
        <div className="simulator-attribute-board__top"><span>DRAFT PROFILE</span><strong>8 PICKS</strong></div>
        {['PACE', 'SHOOTING', 'PASSING', 'DRIBBLING', 'DEFENCE', 'PHYSICAL'].map((attribute, attributeIndex) => (
          <div className="simulator-attribute-board__row" key={attribute}>
            <span>{attribute}</span>
            <i><b style={{ width: `${58 + attributeIndex * 6}%` }} /></i>
            <strong>{74 + attributeIndex * 2}</strong>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="simulator-visual simulator-career-map" aria-hidden="true">
      <div className="simulator-career-map__line" />
      {stages.slice(0, 4).map((stage, stageIndex) => (
        <div className={`simulator-career-map__stop simulator-career-map__stop--${stageIndex + 1}`} key={stage.title}>
          <span>{stageIndex + 1}</span>
          <div><strong>{stage.title}</strong><small>{stage.detail}</small></div>
        </div>
      ))}
    </div>
  )
}

export function SimuladorCarreraFutbolPage() {
  const { locale } = useI18n()
  const content = simuladorCarreraFutbolContent[locale]
  const sections = simulatorSections(locale)

  return (
    <div className="marketing-page build-career-page simulator-landing-page">
      <SiteHeader playHref="#simulador-carrera" />
      <main>
        <section className="site-section build-career-hero simulator-hero">
          <div className="site-container build-career-hero__grid">
            <div className="build-career-hero__copy">
              <p className="eyebrow">{content.hero.eyebrow}</p>
              <h1>{content.hero.title}</h1>
              <p className="lead">{content.hero.lead}</p>
              <div className="build-career-hero__actions">
                <a className="button button--primary" href="#simulador-carrera">{content.hero.primary}</a>
                <a className="button button--secondary" href="#guia-simulador">{content.hero.secondary}</a>
              </div>
              <ul className="build-career-facts" aria-label={content.hero.factsLabel}>
                {content.hero.facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            </div>

            <aside className="career-route-board" aria-label={content.route.label}>
              <div className="career-route-board__top">
                <span>{content.route.label}</span>
                <strong>{content.route.live}</strong>
              </div>
              <div className="career-route-board__player">
                <span className="career-route-board__shirt">10</span>
                <div>
                  <strong>{content.route.player}</strong>
                  <small>{content.route.age}</small>
                </div>
              </div>
              <ol className="career-route-board__stages">
                {content.route.stages.map((stage, index) => (
                  <li key={stage.title}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div><strong>{stage.title}</strong><small>{stage.detail}</small></div>
                  </li>
                ))}
              </ol>
              <p>{content.route.footer}</p>
            </aside>
          </div>
        </section>

        <section className="site-section build-career-player simulator-create-player" id="simulador-carrera">
          <div className="site-container">
            <HomepageCareerStarter entry="simulador_carrera_futbol" />
          </div>
        </section>

        <section className="site-section site-section--seo-intro simulator-guide-intro" id="guia-simulador">
          <div className="site-container simulator-guide-intro__grid">
            <div className="simulator-guide-intro__media" aria-hidden="true">
              <img src={heroImage} alt="" />
              <div className="simulator-guide-intro__overlay">
                <span>CAREER MODE</span>
                <strong>01 → 29</strong>
              </div>
            </div>
            <div>
              <div className="section-heading section-heading--wide">
                <p className="eyebrow">{content.intro.eyebrow}</p>
                <h2>{content.intro.title}</h2>
              </div>
              <div className="seo-copy simulator-copy">
                {content.intro.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </div>
          </div>
        </section>

        {sections.map((section, index) => (
          <section className={`site-section simulator-content-section ${index % 2 === 1 ? 'simulator-content-section--alt' : ''}`} key={section.title}>
            <div className={`site-container simulator-content-grid ${index % 2 === 1 ? 'simulator-content-grid--reverse' : ''}`}>
              <div className="simulator-content-grid__copy">
                <div className="section-heading section-heading--wide">
                  <p className="eyebrow">{section.eyebrow}</p>
                  <h2>{section.title}</h2>
                </div>
                <div className="seo-copy simulator-copy">
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </div>
              <SimulatorSectionVisual index={index} stages={content.route.stages} />
            </div>
          </section>
        ))}

        <section className="site-section simulator-faq-section" id="simulador-faq">
          <div className="site-container">
            <div className="section-heading simulator-faq-heading">
              <p className="eyebrow">{content.faq.eyebrow}</p>
              <h2>{content.faq.title}</h2>
            </div>
            <div className="build-career-faq-list">
              {content.faq.items.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="final-cta build-career-final-cta simulator-final-cta">
              <div>
                <p className="eyebrow">{content.finalCta.eyebrow}</p>
                <h2>{content.finalCta.title}</h2>
                <p className="lead">{content.finalCta.body}</p>
                <a className="button button--primary" href="#simulador-carrera">{content.finalCta.button}</a>
              </div>
              <div className="simulator-final-cta__badge" aria-hidden="true"><span>10</span><strong>YOUR STORY</strong></div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
