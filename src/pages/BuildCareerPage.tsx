import { HomepageCareerStarter } from '../components/home/HomepageCareerStarter'
import { SiteFooter } from '../components/layout/SiteFooter'
import { SiteHeader } from '../components/layout/SiteHeader'
import { getBuildCareerContent } from '../data/buildCareerContent'
import { useI18n, type Locale } from '../i18n/config'

const UI_LABELS: Record<Locale, {
  live: string
  ageToRetirement: string
  lockAttribute: string
  buildAnother: string
  facts: string
}> = {
  es: { live: 'EN VIVO', ageToRetirement: '16 AÑOS → RETIRO', lockAttribute: 'BLOQUEA UN ATRIBUTO POR RONDA', buildAnother: 'Crear otra historia', facts: 'Datos del juego' },
  en: { live: 'LIVE', ageToRetirement: 'AGE 16 → RETIREMENT', lockAttribute: 'LOCK ONE ATTRIBUTE PER ROUND', buildAnother: 'Build another story', facts: 'Game facts' },
  'zh-cn': { live: '进行中', ageToRetirement: '16 岁 → 退役', lockAttribute: '每回合锁定一项属性', buildAnother: '创建另一段生涯', facts: '游戏特点' },
  de: { live: 'LIVE', ageToRetirement: 'ALTER 16 → KARRIEREENDE', lockAttribute: 'PRO RUNDE EIN ATTRIBUT SPERREN', buildAnother: 'Neue Geschichte erstellen', facts: 'Spieldetails' },
  it: { live: 'LIVE', ageToRetirement: '16 ANNI → RITIRO', lockAttribute: 'BLOCCA UN ATTRIBUTO PER TURNO', buildAnother: 'Crea un’altra storia', facts: 'Dettagli del gioco' },
  'pt-br': { live: 'AO VIVO', ageToRetirement: '16 ANOS → APOSENTADORIA', lockAttribute: 'BLOQUEIE UM ATRIBUTO POR RODADA', buildAnother: 'Criar outra história', facts: 'Detalhes do jogo' },
  ko: { live: '진행 중', ageToRetirement: '16세 → 은퇴', lockAttribute: '라운드마다 능력치 하나 확정', buildAnother: '다른 이야기 만들기', facts: '게임 정보' },
}

export function BuildCareerPage() {
  const { locale } = useI18n()
  const content = getBuildCareerContent(locale)
  const labels = UI_LABELS[locale]

  return (
    <div className="marketing-page build-career-page">
      <SiteHeader playHref="#build-player" />
      <main>
        <section className="site-section build-career-hero">
          <div className="site-container build-career-hero__grid">
            <div className="build-career-hero__copy">
              <p className="eyebrow">{content.hero.eyebrow}</p>
              <h1>{content.hero.title}</h1>
              <p className="lead">{content.hero.lead}</p>
              <div className="build-career-hero__actions">
                <a className="button button--primary" href="#build-player">{content.hero.primary}</a>
                <a className="button button--secondary" href="#career-steps">{content.hero.secondary}</a>
              </div>
              <ul className="build-career-facts" aria-label={labels.facts}>
                {content.hero.facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            </div>

            <aside className="career-route-board" aria-label={content.routePreview.label}>
              <div className="career-route-board__top">
                <span>{content.routePreview.label}</span>
                <strong>{labels.live}</strong>
              </div>
              <div className="career-route-board__player">
                <span className="career-route-board__shirt">10</span>
                <div>
                  <strong>{content.routePreview.player}</strong>
                  <small>{labels.ageToRetirement}</small>
                </div>
              </div>
              <ol className="career-route-board__stages">
                {content.routePreview.stages.map((stage) => (
                  <li key={stage.number}>
                    <span>{stage.number}</span>
                    <div><strong>{stage.title}</strong><small>{stage.detail}</small></div>
                  </li>
                ))}
              </ol>
              <p>{content.routePreview.footer}</p>
            </aside>
          </div>
        </section>

        <section className="site-section build-career-player" id="build-player">
          <div className="site-container">
            <HomepageCareerStarter entry="build_career_page" />
          </div>
        </section>

        <section className="site-section site-section--seo-intro">
          <div className="site-container seo-intro-grid">
            <div className="section-heading section-heading--wide">
              <p className="eyebrow">{content.intro.eyebrow}</p>
              <h2>{content.intro.title}</h2>
            </div>
            <div className="seo-copy">
              {content.intro.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </div>
        </section>

        <section className="site-section" id="career-steps">
          <div className="site-container">
            <div className="section-heading section-heading--wide">
              <p className="eyebrow">{content.stages.eyebrow}</p>
              <h2>{content.stages.title}</h2>
              <p className="lead">{content.stages.body}</p>
            </div>
            <div className="build-career-stage-grid">
              {content.stages.items.map((stage) => (
                <article className="build-career-stage" key={stage.number}>
                  <span>{stage.number}</span>
                  <h3>{stage.title}</h3>
                  <p>{stage.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section build-career-draft-section">
          <div className="site-container build-career-draft-grid">
            <div>
              <p className="eyebrow eyebrow--gold">{content.draft.eyebrow}</p>
              <h2>{content.draft.title}</h2>
              <p className="lead">{content.draft.body}</p>
              <div className="build-career-modes">
                {content.draft.modes.map((mode) => (
                  <article key={mode.name}>
                    <div><strong>{mode.name}</strong><span>{mode.tag}</span></div>
                    <p>{mode.body}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="attribute-board" aria-label={content.draft.title}>
              <div className="attribute-board__rating"><strong>?</strong><span>OVR</span></div>
              <div className="attribute-board__grid">
                {content.draft.attributes.map((attribute, index) => (
                  <div key={attribute}><span>{String(index + 1).padStart(2, '0')}</span><strong>{attribute}</strong></div>
                ))}
              </div>
              <p>{labels.lockAttribute}</p>
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="section-heading section-heading--wide">
              <p className="eyebrow">{content.decisions.eyebrow}</p>
              <h2>{content.decisions.title}</h2>
            </div>
            <div className="build-career-decision-grid">
              {content.decisions.items.map((item) => (
                <article key={item.marker}>
                  <span>{item.marker}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-section build-career-result-section">
          <div className="site-container build-career-result-grid">
            <div>
              <p className="eyebrow eyebrow--gold">{content.result.eyebrow}</p>
              <h2>{content.result.title}</h2>
              <p className="lead">{content.result.body}</p>
              <a className="button button--primary" href="#build-player">{labels.buildAnother}</a>
            </div>
            <article className="build-career-result-card" aria-label={content.result.cardLabel}>
              <div className="build-career-result-card__top">
                <span>{content.result.cardLabel}</span>
                <div><strong>{content.result.rating}</strong><small>{content.result.ratingLabel}</small></div>
              </div>
              <div className="build-career-result-card__identity">
                <span>10</span>
                <div><h3>{content.result.name}</h3><p>{content.result.role}</p></div>
              </div>
              <div className="build-career-result-card__stats">
                {content.result.stats.map((stat) => (
                  <div key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></div>
                ))}
              </div>
              <div className="build-career-result-card__timeline" aria-hidden="true">
                <i /><i /><i /><i />
              </div>
              <p>{content.result.note}</p>
            </article>
          </div>
        </section>

        <section className="site-section" id="build-career-faq">
          <div className="site-container">
            <div className="section-heading">
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
            <div className="final-cta build-career-final-cta">
              <p className="eyebrow">{content.finalCta.eyebrow}</p>
              <h2>{content.finalCta.title}</h2>
              <p className="lead">{content.finalCta.body}</p>
              <a className="button button--primary" href="#build-player">{content.finalCta.button}</a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
