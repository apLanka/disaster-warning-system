import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
  /** What is being counted, in the plural: "reports" unless said otherwise. */
  noun?: string;
}

const WINDOW = 2;

function pageNumbers(page: number, lastPage: number): number[] {
  const from = Math.max(1, page - WINDOW);
  const to = Math.min(lastPage, page + WINDOW);
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

export function Pagination({
  page,
  limit,
  total,
  onChange,
  noun = 'reports',
}: PaginationProps) {
  if (total === 0) return null;

  const lastPage = Math.max(1, Math.ceil(total / limit));
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  const step =
    'border-border hover:bg-page flex size-8 items-center justify-center rounded-lg border text-sm disabled:opacity-40';

  return (
    <div className="text-muted flex items-center justify-between gap-4 text-sm">
      <p>
        Showing {first}–{last} of {total} {noun}
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className={step}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        {pageNumbers(page, lastPage).map((number) => (
          <button
            key={number}
            type="button"
            aria-label={`Page ${number}`}
            aria-current={number === page ? 'page' : undefined}
            onClick={() => onChange(number)}
            className={`${step} ${number === page ? 'bg-navy border-navy text-white hover:bg-navy' : ''}`}
          >
            {number}
          </button>
        ))}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= lastPage}
          onClick={() => onChange(page + 1)}
          className={step}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </nav>
    </div>
  );
}
