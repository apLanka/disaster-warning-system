import { Boxes } from 'lucide-react';

export function ResourcesPage() {
  const resources = [
    {
      item: 'Clean Drinking Water',
      district: 'Gampaha',
      quantity: '5,000 Litres',
      organization: 'DMC Logistics',
      status: 'Distributed',
    },
    {
      item: 'First Aid & Medical Packs',
      district: 'Gampaha',
      quantity: '350 Kits',
      organization: 'Red Cross Sri Lanka',
      status: 'In Transit',
    },
    {
      item: 'Dry Rations & Food Packs',
      district: 'Gampaha',
      quantity: '1,200 Packs',
      organization: 'Tri-Forces Relief Command',
      status: 'Distributed',
    },
    {
      item: 'Rescue Life Jackets & Boats',
      district: 'Gampaha',
      quantity: '80 Units',
      organization: 'Navy Special Boat Squadron',
      status: 'Deployed',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <Boxes className="size-6 text-orange" />
          Emergency Resources
        </h1>
        <p className="text-sm text-muted mt-1">
          Distribution records, relief supply tracking, and resource requests.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-page/50 text-xs font-semibold text-muted">
            <tr>
              <th className="px-6 py-4">Resource Item</th>
              <th className="px-6 py-4">District</th>
              <th className="px-6 py-4">Allocated Quantity</th>
              <th className="px-6 py-4">Handling Organization</th>
              <th className="px-6 py-4">Deployment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {resources.map((r) => (
              <tr key={r.item} className="hover:bg-page/40 transition-colors">
                <td className="px-6 py-4 font-bold text-ink">{r.item}</td>
                <td className="px-6 py-4 text-ink">{r.district}</td>
                <td className="px-6 py-4 font-bold text-ink">{r.quantity}</td>
                <td className="px-6 py-4 text-ink">{r.organization}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-semibold ${
                      r.status === 'Distributed'
                        ? 'bg-success-tint text-success'
                        : r.status === 'Deployed'
                          ? 'bg-orange-tint text-orange'
                          : 'bg-neutral-tint text-navy'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
