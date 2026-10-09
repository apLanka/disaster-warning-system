import { Home } from 'lucide-react';

export function SheltersPage() {
  const shelters = [
    {
      name: 'Gampaha Maha Vidyalaya Shelter',
      district: 'Gampaha',
      capacity: 350,
      occupied: 210,
      status: 'OPEN',
    },
    {
      name: 'Negombo Community Hall',
      district: 'Gampaha',
      capacity: 200,
      occupied: 180,
      status: 'OPEN',
    },
    {
      name: 'Kelaniya Raja Maha Vihara Centre',
      district: 'Gampaha',
      capacity: 500,
      occupied: 120,
      status: 'OPEN',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
          <Home className="size-6 text-orange" />
          District Shelters
        </h1>
        <p className="text-sm text-muted mt-1">
          Active evacuation shelters, bed capacities, and current occupancy
          levels.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-page/50 text-xs font-semibold text-muted">
            <tr>
              <th className="px-6 py-4">Shelter Name</th>
              <th className="px-6 py-4">District</th>
              <th className="px-6 py-4">Capacity</th>
              <th className="px-6 py-4">Occupancy</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shelters.map((s) => (
              <tr key={s.name} className="hover:bg-page/40 transition-colors">
                <td className="px-6 py-4 font-bold text-ink">{s.name}</td>
                <td className="px-6 py-4 text-ink">{s.district}</td>
                <td className="px-6 py-4 text-ink">{s.capacity} persons</td>
                <td className="px-6 py-4 font-bold text-orange">
                  {s.occupied} persons
                </td>
                <td className="px-6 py-4">
                  <span className="bg-success-tint text-success px-3 py-0.5 rounded-full text-xs font-semibold">
                    {s.status}
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
