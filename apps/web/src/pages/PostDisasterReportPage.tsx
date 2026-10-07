import {
  ArrowLeft,
  Building2,
  MapPinned,
  RefreshCw,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import {
  districtName,
  HAZARD_TYPE_LABELS,
  type PostDisasterReportDto,
} from '@repo/types';

import { describeAnalysisError, generateReport } from '../api/analysis';
import { AlertTimeline } from '../components/analysis/AlertTimeline';
import { BarChart } from '../components/analysis/BarChart';
import { DataStatus } from '../components/analysis/DataStatus';
import { KpiCard } from '../components/analysis/KpiCard';
import { ReportTabs } from '../components/analysis/ReportTabs';
import { ResourceTable } from '../components/analysis/ResourceTable';
import { ShelterTable } from '../components/analysis/ShelterTable';
import { StepChart } from '../components/analysis/StepChart';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { usePageTitle } from '../hooks/usePageTitle';
import { useResource } from '../hooks/useResource';
import {
  formatDayTime,
  formatNumber,
  formatPercent,
  formatPeriod,
} from '../lib/format';
import { analysisScopePath } from '../lib/routes';

const TABS = ['overview', 'shelters', 'resources'] as const;
type TabId = (typeof TABS)[number];

function readTab(value: string | null): TabId {
  return TABS.find((tab) => tab === value) ?? 'overview';
}

function scopeText(report: PostDisasterReportDto): string {
  return report.scope.kind === 'ALL'
    ? 'All affected districts'
    : districtName(report.scope.districtCode);
}

function SectionEmpty({ title }: { title: string }) {
  return (
    <EmptyState icon={<TriangleAlert className="size-10" />} title={title} />
  );
}

/** Screens 3 to 5: the generated report. A report that cannot be built is never shown in part. */
export function PostDisasterReportPage() {
  const { eventId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const district = params.get('district') ?? undefined;
  const tab = readTab(params.get('tab'));
  usePageTitle('Post-disaster report');

  const { data, error, loading, reload } = useResource(
    (signal) => generateReport(eventId, district, signal),
    [eventId, district],
  );

  function selectTab(next: TabId) {
    const nextParams = new URLSearchParams(params);
    if (next === 'overview') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  }

  const back = (
    <Link to={analysisScopePath(eventId)}>
      <Button
        variant="ghost"
        tabIndex={-1}
        icon={<ArrowLeft aria-hidden="true" className="size-4" />}
      >
        Change scope
      </Button>
    </Link>
  );

  if (error !== null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Post-disaster report</h1>
        <Banner
          tone="danger"
          action={
            <Button
              variant="ghost"
              icon={<RefreshCw aria-hidden="true" className="size-4" />}
              onClick={reload}
            >
              Retry
            </Button>
          }
        >
          {describeAnalysisError(error)}
        </Banner>
        {back}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Post-disaster report</h1>
        <div role="status" aria-label="Generating report" className="space-y-3">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const { summary } = data;
  const peak = summary.peakShelterOccupancy;

  return (
    <div className="space-y-4" aria-busy={loading}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{data.event.name}</h1>
          <p className="text-muted text-sm">
            {data.event.eventId} · {HAZARD_TYPE_LABELS[data.event.hazardType]} ·{' '}
            {formatPeriod(data.event.startedAt, data.event.endedAt)}
          </p>
          <p className="text-muted text-sm">
            Scope:{' '}
            <span className="text-ink font-semibold">{scopeText(data)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {back}
          <Button
            icon={<RefreshCw aria-hidden="true" className="size-4" />}
            loading={loading}
            onClick={reload}
          >
            Regenerate
          </Button>
        </div>
      </div>

      <DataStatus status={data.dataStatus} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Alerts Issued"
          value={formatNumber(summary.alertsIssued)}
          icon={<TriangleAlert className="size-5" />}
          tone="warning"
        />
        <KpiCard
          label="Citizens Reached"
          value={formatNumber(summary.citizensReached)}
          detail={`${formatPercent(summary.reachRate)} of ${formatNumber(summary.citizensTargeted)} targeted`}
          icon={<Users className="size-5" />}
          tone="success"
        />
        <KpiCard
          label="Peak Shelter Occupancy"
          value={peak ? formatNumber(peak.value) : '–'}
          detail={
            peak
              ? `of ${formatNumber(peak.capacity)} capacity · ${formatDayTime(peak.at)}`
              : 'No readings recorded'
          }
          icon={<Building2 className="size-5" />}
          tone="neutral"
        />
        <KpiCard
          label="Districts Receiving Resources"
          value={formatNumber(summary.districtsReceivingResources)}
          icon={<MapPinned className="size-5" />}
          tone="danger"
        />
      </div>

      <Card className="space-y-4">
        <ReportTabs
          label="Report sections"
          selected={tab}
          onSelect={selectTab}
          tabs={[
            {
              id: 'overview',
              label: 'Overview',
              panel:
                data.alertTimeline.length === 0 ? (
                  <SectionEmpty title="No warnings were issued for this scope" />
                ) : (
                  <AlertTimeline items={data.alertTimeline} />
                ),
            },
            {
              id: 'shelters',
              label: 'Shelter Occupancy',
              panel:
                data.shelters.length === 0 ? (
                  <SectionEmpty title="No shelter data recorded for this scope" />
                ) : (
                  <div className="space-y-6">
                    <StepChart
                      series={data.occupancyTotalSeries}
                      capacity={peak?.capacity}
                    />
                    <ShelterTable shelters={data.shelters} />
                  </div>
                ),
            },
            {
              id: 'resources',
              label: 'Resource Distribution',
              panel:
                data.resources.length === 0 ? (
                  <SectionEmpty title="No resource distribution recorded for this scope" />
                ) : (
                  <div className="space-y-6">
                    <BarChart
                      bars={data.resourceTotalsByDistrict.map((total) => ({
                        label: districtName(total.districtCode),
                        value: total.quantity,
                      }))}
                      valueLabel="Quantity distributed by district"
                      labelHeading="District"
                    />
                    <ResourceTable rows={data.resources} />
                  </div>
                ),
            },
          ]}
        />
      </Card>

      <p className="text-muted text-xs">
        Report {data.reportId}, generated {formatDayTime(data.generatedAt)}.
      </p>
    </div>
  );
}
