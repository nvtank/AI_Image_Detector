"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('about.title')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('about.subtitle')}</p>
      </div>

      <div className="space-y-6">
        <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">{t('about.overviewTitle')}</h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {t('about.overviewBody')}
          </p>
        </section>

        <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">{t('about.howTitle')}</h2>
          <div className="space-y-4">
            {[
              { step: "1", title: t('about.step1Title'), desc: t('about.step1Desc') },
              { step: "2", title: t('about.step2Title'), desc: t('about.step2Desc') },
              { step: "3", title: t('about.step3Title'), desc: t('about.step3Desc') },
              { step: "4", title: t('about.step4Title'), desc: t('about.step4Desc') },
              { step: "5", title: t('about.step5Title'), desc: t('about.step5Desc') },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                  {step}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">{t('about.techTitle')}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { category: t('about.catAI'), tech: t('about.techAI') },
              { category: t('about.catBackend'), tech: t('about.techBackend') },
              { category: t('about.catFrontend'), tech: t('about.techFrontend') },
              { category: t('about.catExtension'), tech: t('about.techExtension') },
              { category: t('about.catDevOps'), tech: t('about.techDevOps') },
              { category: t('about.catExplainability'), tech: t('about.techExplainability') },
            ].map(({ category, tech }) => (
              <div key={category} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{category}</p>
                <p className="font-medium text-slate-700 dark:text-slate-200">{tech}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
