import { WARNING_LEVEL_LABELS, type WarningLevel } from '@repo/types';

import { LEVEL_CLASSES } from '../../lib/warningLevels';

export function LevelChip({ level }: { level: WarningLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase ${LEVEL_CLASSES[level]}`}
    >
      {WARNING_LEVEL_LABELS[level]}
    </span>
  );
}
