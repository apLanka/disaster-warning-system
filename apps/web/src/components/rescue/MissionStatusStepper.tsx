import {
  Check,
  CheckCircle2,
  Navigation,
  Radio,
  Siren,
  XCircle,
} from 'lucide-react';
import type { MissionStatus } from '@repo/types';
import { MISSION_STATUS } from '@repo/types';

interface MissionStatusStepperProps {
  status: MissionStatus;
  lastUpdated?: string;
  className?: string;
}

const STAGES = [
  {
    key: MISSION_STATUS.ASSIGNED,
    label: 'Assigned',
    subtitle: 'Squad Alerted',
    icon: Radio,
    stepIndex: 0,
  },
  {
    key: MISSION_STATUS.EN_ROUTE,
    label: 'En Route',
    subtitle: 'Squad In Transit',
    icon: Navigation,
    stepIndex: 1,
  },
  {
    key: MISSION_STATUS.ON_SCENE,
    label: 'On Scene',
    subtitle: 'Field Operations',
    icon: Siren,
    stepIndex: 2,
  },
  {
    key: MISSION_STATUS.COMPLETED,
    label: 'Completed',
    subtitle: 'Mission Accomplished',
    icon: CheckCircle2,
    stepIndex: 3,
  },
] as const;

function getStepIndex(st: MissionStatus): number {
  switch (st) {
    case MISSION_STATUS.ASSIGNED:
      return 0;
    case MISSION_STATUS.EN_ROUTE:
      return 1;
    case MISSION_STATUS.ON_SCENE:
      return 2;
    case MISSION_STATUS.COMPLETED:
      return 3;
    case MISSION_STATUS.CANCELLED:
      return -1;
    default:
      return 0;
  }
}

export function MissionStatusStepper({
  status,
  lastUpdated,
  className = '',
}: MissionStatusStepperProps) {
  const currentIndex = getStepIndex(status);
  const isCancelled = status === MISSION_STATUS.CANCELLED;

  return (
    <div
      className={`bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-5 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isCancelled
                  ? 'bg-danger'
                  : status === MISSION_STATUS.COMPLETED
                    ? 'bg-success'
                    : 'bg-orange'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full size-2.5 ${
                isCancelled
                  ? 'bg-danger'
                  : status === MISSION_STATUS.COMPLETED
                    ? 'bg-success'
                    : 'bg-orange'
              }`}
            />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-ink">
            Live Mission Progression
          </span>
        </div>

        {lastUpdated && (
          <span className="text-[11px] text-muted">
            Updated:{' '}
            <strong className="text-ink font-semibold">
              {new Date(lastUpdated).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </strong>
          </span>
        )}
      </div>

      {isCancelled ? (
        <div className="bg-danger-tint border border-danger/30 rounded-xl p-4 flex items-center gap-3 text-danger">
          <XCircle className="size-5 shrink-0" />
          <div className="text-xs">
            <p className="font-bold">Mission Stood Down / Cancelled</p>
            <p className="opacity-90 mt-0.5">
              This deployment was stood down by emergency command. The assigned
              rescue team has returned to available status.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Stepper Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-2 relative">
            {STAGES.map((stage, idx) => {
              const isPast = currentIndex > idx;
              const isCurrent = currentIndex === idx;
              const IconComponent = stage.icon;

              return (
                <div
                  key={stage.key}
                  className="flex flex-col items-center text-center relative z-10"
                >
                  {/* Step Circle */}
                  <div className="relative mb-2">
                    {isCurrent && (
                      <span className="absolute -inset-1.5 rounded-full bg-orange/20 animate-pulse pointer-events-none" />
                    )}

                    <div
                      className={`size-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                        isPast
                          ? 'bg-success text-white shadow-xs'
                          : isCurrent
                            ? 'bg-orange text-white shadow-md ring-4 ring-orange/15 scale-105'
                            : 'border-2 border-border bg-page text-muted'
                      }`}
                    >
                      {isPast ? (
                        <Check className="size-5 stroke-[2.5]" />
                      ) : (
                        <IconComponent className="size-5" />
                      )}
                    </div>
                  </div>

                  {/* Stage Titles */}
                  <span
                    className={`text-xs font-bold transition-colors ${
                      isCurrent
                        ? 'text-orange font-extrabold'
                        : isPast
                          ? 'text-success'
                          : 'text-muted'
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span className="text-[11px] text-muted mt-0.5 hidden sm:block">
                    {stage.subtitle}
                  </span>

                  {isCurrent && (
                    <span className="mt-1 text-[10px] font-bold text-orange bg-orange-tint px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Active
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Connecting Bar */}
          <div className="hidden sm:block absolute top-5 left-1/8 right-1/8 h-0.5 bg-border -z-0">
            <div
              className="h-full bg-success transition-all duration-500"
              style={{
                width: `${Math.min(100, (currentIndex / (STAGES.length - 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
