import { ArrowRight, Map, ShieldAlert, Zap, Activity } from 'lucide-react';
import Link from 'next/link';

import CurrentAqiCard from './components/CurrentAqiCard';

const questions = [
  { q: 'Is it safe outside right now?', href: '/forecast', icon: ShieldAlert },
  { q: 'When will air quality improve?', href: '/forecast', icon: Activity },
  { q: 'Where are the pollution hotspots?', href: '/map', icon: Map },
  { q: "What's driving today's pollution?", href: '/forecast', icon: Zap },
];

const steps = [
  { step: 1, title: 'Live Data Ingestion', desc: 'Real-time assimilation of satellite imagery, CPCB sensors, and Open-Meteo weather grids.' },
  { step: 2, title: 'WRF-Chem + ML', desc: 'Coupled physical modeling and XGBoost bias correction generating a 72-hour deterministic forecast.' },
  { step: 3, title: 'Source Attribution', desc: 'Inversion trapping index and live wind-plume vectoring to pinpoint driving sources.' },
  { step: 4, title: 'Actionable Guidance', desc: 'Transparent, explainable UI delivering data-backed insights for policy and public safety.' },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center">
      <section className="w-full max-w-6xl mx-auto px-6 py-20 md:py-24 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-sm font-medium mb-8 border border-teal-500/20">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          Live Forecasting Active
        </div>

        <h1 
          className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(to right, var(--hero-from), var(--hero-to))' }}
        >
          Predicting the Air <br /> We Breathe.
        </h1>

        <p className="text-lg md:text-xl max-w-2xl mb-12" style={{ color: 'var(--text-muted)' }}>
          VayuSangam is an advanced WRF-Chem and ML-powered intelligence platform delivering 72-hour coupled weather and pollution forecasting for Delhi NCR.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/forecast" prefetch={false} className="px-8 py-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition-all flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(20,184,166,0.3)]">
            Check current air <Activity className="w-5 h-5" />
          </Link>
          <Link 
            href="/map" 
            prefetch={false}
            className="px-8 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 border"
            style={{ backgroundColor: 'var(--btn-bg)', color: 'var(--btn-text)', borderColor: 'var(--panel-border)' }}
          >
            Explore live map <Map className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <CurrentAqiCard />

      <section className="w-full max-w-6xl mx-auto px-6 mb-32">
        <h3 className="text-2xl font-bold mb-8 text-center text-foreground">Start with your question</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {questions.map((item) => (
            <Link key={item.q} href={item.href} prefetch={false} className="group p-6 rounded-2xl bg-panel border border-panelBorder hover:border-teal-500/50 transition-colors flex flex-col justify-between h-full shadow-md">
              <item.icon className="w-8 h-8 text-teal-600 dark:text-teal-500/70 mb-4 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors" />
              <div>
                <h4 className="font-semibold text-lg text-foreground group-hover:text-teal-700 dark:group-hover:text-teal-50 transition-colors">{item.q}</h4>
                <div className="flex items-center gap-2 mt-4 text-sm text-gray-600 dark:text-gray-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  View Data <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="w-full max-w-6xl mx-auto px-6 mb-32">
        <h3 className="text-2xl font-bold mb-12 text-center text-foreground">How VayuSangam Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          <div className="hidden md:block absolute top-8 left-12 right-12 h-0.5 bg-gray-200 dark:bg-gray-800" />
          {steps.map((item) => (
            <div key={item.step} className="relative pt-8 md:pt-0">
              <div className="w-16 h-16 rounded-2xl bg-panel border-2 border-panelBorder flex items-center justify-center text-xl font-bold mb-6 relative z-10 mx-auto md:mx-0 shadow-sm text-foreground">
                {item.step}
              </div>
              <h4 className="font-semibold text-lg mb-2 text-center md:text-left text-foreground">{item.title}</h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm text-center md:text-left leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
