"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 'var(--sp-3xl)' }}>
      {/* PAGE HEADER */}
      <div style={{ marginBottom: 'var(--sp-2xl)' }}>
        <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.96px', color: 'var(--ink)', margin: 0, marginBottom: 'var(--sp-sm)' }}>
          {t('about.title')}
        </h1>
        <p style={{ fontSize: 16, color: 'var(--body)', margin: 0 }}>
          {t('about.subtitle')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xl)' }}>
        {/* OVERVIEW SECTION */}
        <section className="card" style={{ padding: 'var(--sp-2xl)', borderRadius: 'var(--r-xl)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: 0, marginBottom: 'var(--sp-md)' }}>
            {t('about.overviewTitle')}
          </h2>
          <p style={{ fontSize: 16, color: 'var(--body)', lineHeight: 1.65, margin: 0 }}>
            {t('about.overviewBody')}
          </p>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section className="card" style={{ padding: 'var(--sp-2xl)', borderRadius: 'var(--r-xl)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: 0, marginBottom: 'var(--sp-lg)' }}>
            {t('about.howTitle')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-lg)' }}>
            {[
              { step: "1", title: t('about.step1Title'), desc: t('about.step1Desc') },
              { step: "2", title: t('about.step2Title'), desc: t('about.step2Desc') },
              { step: "3", title: t('about.step3Title'), desc: t('about.step3Desc') },
              { step: "4", title: t('about.step4Title'), desc: t('about.step4Desc') },
              { step: "5", title: t('about.step5Title'), desc: t('about.step5Desc') },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ display: 'flex', gap: 'var(--sp-lg)' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--primary-pale)', color: 'var(--ink-deep)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 2,
                }}>
                  {step}
                </div>
                <div>
                  <h3 style={{ fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--body)', lineHeight: 1.65, margin: 0, marginTop: 'var(--sp-xs)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TECH STACK SECTION */}
        <section className="card" style={{ padding: 'var(--sp-2xl)', borderRadius: 'var(--r-xl)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: 0, marginBottom: 'var(--sp-lg)' }}>
            {t('about.techTitle')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-lg)' }}>
            {[
              { category: t('about.catAI'), tech: t('about.techAI') },
              { category: t('about.catBackend'), tech: t('about.techBackend') },
              { category: t('about.catFrontend'), tech: t('about.techFrontend') },
              { category: t('about.catExtension'), tech: t('about.techExtension') },
              { category: t('about.catDevOps'), tech: t('about.techDevOps') },
              { category: t('about.catExplainability'), tech: t('about.techExplainability') },
            ].map(({ category, tech }) => (
              <div key={category} className="card-inner" style={{ padding: 'var(--sp-lg)', borderRadius: 'var(--r-lg)' }}>
                <p style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--mute)', margin: 0, marginBottom: 'var(--sp-xs)' }}>
                  {category}
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>{tech}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
