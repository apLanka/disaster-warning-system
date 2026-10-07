import {
  CircleCheck,
  CircleX,
  FileText,
  Megaphone,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

export type NavBadge = 'pendingReports' | 'activeWarnings';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** A count shown next to the label. */
  badge?: NavBadge;
  /** Only active on this exact path, not on paths below it. */
  end?: boolean;
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
    badge: 'pendingReports',
  },
  { to: '/reports/verified', label: 'Verified Reports', icon: CircleCheck },
  { to: '/reports/rejected', label: 'Rejected Reports', icon: CircleX },
  { to: '/warnings/new', label: 'Issue Warning', icon: Megaphone },
  {
    to: '/warnings',
    label: 'Warnings',
    icon: TriangleAlert,
    badge: 'activeWarnings',
    end: true,
  },
];
