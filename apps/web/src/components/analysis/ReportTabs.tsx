import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabDefinition<Id extends string> {
  id: Id;
  label: string;
  panel: ReactNode;
}

interface ReportTabsProps<Id extends string> {
  tabs: TabDefinition<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
  label: string;
}

/**
 * Tabs the way the ARIA pattern describes: one tab stop, arrow keys move between
 * tabs (wrapping), Home and End jump to the ends.
 */
export function ReportTabs<Id extends string>({
  tabs,
  selected,
  onSelect,
  label,
}: ReportTabsProps<Id>) {
  const buttons = useRef(new Map<Id, HTMLButtonElement>());

  function move(index: number) {
    const target = tabs[(index + tabs.length) % tabs.length];
    if (!target) return;
    onSelect(target.id);
    buttons.current.get(target.id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const moves: Record<string, number | undefined> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    move(next);
  }

  const current = tabs.find((tab) => tab.id === selected) ?? tabs[0];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={label}
        className="border-border flex gap-1 border-b"
      >
        {tabs.map((tab, index) => {
          const active = tab.id === current?.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) buttons.current.set(tab.id, node);
                else buttons.current.delete(tab.id);
              }}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
                active
                  ? 'border-orange text-ink'
                  : 'text-muted hover:text-ink border-transparent'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {current && (
        <div
          role="tabpanel"
          id={`panel-${current.id}`}
          aria-labelledby={`tab-${current.id}`}
          tabIndex={0}
        >
          {current.panel}
        </div>
      )}
    </div>
  );
}
