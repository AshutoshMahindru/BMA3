import Link from 'next/link';

const families = [
  { slug: 'formats', label: 'Formats' },
  { slug: 'categories', label: 'Categories' },
  { slug: 'portfolio', label: 'Portfolio' },
  { slug: 'channels', label: 'Channels' },
  { slug: 'operating-models', label: 'Operating Models' },
  { slug: 'geography', label: 'Geography' },
  { slug: 'review', label: 'Scope Review' },
];

export default function ScopeEditorsIndexPage() {
  return (
    <div className="px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Scope Dimension Editors</h1>
        <p className="text-sm text-gray-500 mt-2">
          Canonical SpecOS scope editor routes for the reusable planning dimensions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {families.map((family) => (
          <Link
            key={family.slug}
            href={`/dashboard/scope/${family.slug}`}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-[#1E5B9C]/30 hover:shadow-md transition"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1E5B9C]">Dimension</p>
            <h2 className="mt-3 text-lg font-semibold text-gray-900">{family.label}</h2>
            <p className="mt-2 text-sm text-gray-500">
              {family.slug === 'review'
                ? 'Review live coverage, bundle validation, and dimension completeness before compute runs.'
                : 'Review the live node inventory and compare it against the canonical reference set.'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
