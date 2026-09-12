import { Activity, Database, Map, ShieldCheck } from 'lucide-react';

const items = [
  {
    title: 'Forecast-first air intelligence',
    description:
      'A 72-hour synthetic demo forecast combines weather, PM2.5, PM10, ozone, source attribution, and inversion indicators for Delhi NCR.',
    icon: Activity,
  },
  {
    title: 'Transparent data handling',
    description:
      'The backend serves bundled file-based demo and live-cache artifacts. It does not require a database to run.',
    icon: Database,
  },
  {
    title: 'Map-centered exploration',
    description:
      'Interactive layers show PM2.5 grid fields, fire-source clusters, and HCHO hotspots with graceful fallbacks when services are unavailable.',
    icon: Map,
  },
  {
    title: 'Prototype guardrails',
    description:
      'Outputs are labeled as demo/prototype data so users are not misled into treating them as validated operational predictions.',
    icon: ShieldCheck,
  },
];

export default function AboutPage() {
  return (
    <div className="w-full bg-[#0b0e14] py-12">
      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-400">
            VayuSangam
          </p>
          <h1 className="mb-4 text-4xl font-bold text-gray-100 md:text-5xl">
            Delhi NCR air-quality forecasting prototype
          </h1>
          <p className="text-base leading-7 text-gray-400 md:text-lg">
            VayuSangam is a full-stack demo for exploring weather-pollution forecasts,
            source signals, and explainable atmospheric risk indicators without adding
            database infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-gray-800 bg-[#131821] p-6 shadow-lg"
            >
              <item.icon className="mb-4 h-7 w-7 text-teal-400" />
              <h2 className="mb-2 text-lg font-semibold text-gray-100">{item.title}</h2>
              <p className="text-sm leading-6 text-gray-400">{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
