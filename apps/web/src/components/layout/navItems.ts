import {
  ChartColumn,
  CircleCheck,
  CircleX,
  FileText,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Show the number of reports waiting for review next to the label. */
  showPendingCount?: boolean;
}

/**
 * Add an entry here to put a page in the sidebar. Each use case owns its own
 * entries, so the layout itself never needs to change.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    to: '/reports/pending',
    label: 'Pending Reports',
    icon: FileText,
    showPendingCount: true,
  },
  { to: '/reports/verified', label: 'Verified Reports', icon: CircleCheck },
  { to: '/reports/rejected', label: 'Rejected Reports', icon: CircleX },
  { to: '/analysis', label: 'Analysis & Reports', icon: ChartColumn },
];
