export default function FeatureCard({ title, description, icon }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-blue-500">
      <div className="mb-4 text-3xl">{icon}</div>

      <h3 className="mb-3 text-xl font-bold text-purple-400">
        {title}
      </h3>

      <p className="leading-7 text-slate-400">
        {description}
      </p>
    </div>
  );
}