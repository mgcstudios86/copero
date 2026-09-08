import { Link } from 'react-router-dom'
import { SiteFooter } from '../components/layout/SiteFooter'
import { SiteHeader } from '../components/layout/SiteHeader'
import { localizePath, useI18n } from '../i18n/config'

export type InfoPageKind = 'about' | 'contact' | 'privacy' | 'terms'

const SUPPORT_EMAIL = 'support@copero.top'

const SECTION_KEYS: Record<InfoPageKind, readonly string[]> = {
  about: ['project', 'gameplay', 'languages', 'independence'],
  contact: ['include', 'privacy', 'legal', 'response'],
  privacy: ['local', 'account', 'analytics', 'technical', 'thirdParty', 'retention', 'changes'],
  terms: ['service', 'license', 'saves', 'thirdParty', 'ownership', 'availability', 'liability', 'changes'],
}

export function InfoPage({ page }: { page: InfoPageKind }) {
  const { locale, t } = useI18n()
  const updated = page === 'privacy' || page === 'terms' ? t('pages', `${page}.updated`) : null

  return (
    <div className="marketing-page info-page">
      <SiteHeader />
      <main className="info-page__main">
        <section className="site-section info-page__hero">
          <div className="site-container info-page__container">
            <p className="eyebrow">{t('pages', `${page}.eyebrow`)}</p>
            <h1>{t('pages', `${page}.title`)}</h1>
            <p className="lead">{t('pages', `${page}.intro`)}</p>
            {updated && <p className="info-page__updated">{updated}</p>}
          </div>
        </section>

        {page === 'contact' && (
          <section className="site-section info-page__channel-section">
            <div className="site-container info-page__container">
              <article className="info-contact-card">
                <div>
                  <p className="eyebrow">{t('pages', 'contact.channelLabel')}</p>
                  <h2>{t('pages', 'contact.channelTitle')}</h2>
                  <p>{t('pages', 'contact.channelBody')}</p>
                </div>
                <a className="button button--primary" href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
              </article>
            </div>
          </section>
        )}

        <section className="site-section info-page__content-section">
          <div className="site-container info-page__container info-page__sections">
            {SECTION_KEYS[page].map((key) => (
              <article className="info-section" key={key}>
                <h2>{t('pages', `${page}.sections.${key}.title`)}</h2>
                <p>{t('pages', `${page}.sections.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="site-section info-page__back-section">
          <div className="site-container info-page__container">
            <Link className="button button--secondary" to={localizePath('/', locale)}>
              ← {t('common', 'actions.backHome')}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
