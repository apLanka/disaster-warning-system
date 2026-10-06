import { SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '../components/ui/EmptyState';
import { usePageTitle } from '../hooks/usePageTitle';
import { PENDING_PATH } from '../lib/routes';

export function NotFoundPage() {
  usePageTitle('Page not found');

  return (
    <EmptyState
      icon={<SearchX className="size-10" />}
      title="Page not found"
      description="The page you are looking for does not exist."
      action={
        <Link to={PENDING_PATH} className="text-orange font-semibold">
          Go to pending reports
        </Link>
      }
    />
  );
}
