import type { ClosingCategory, ClosingGroup } from '../domain/closing';
import { BarCard } from './BarCard';
import { GROUP_ICONS } from './icons';

/** One line under each heading so the split is explained in words, never by colour alone (FR-6.3). */
export const GROUP_NOTES: Record<ClosingCategory, string> = {
  day: 'Close before midnight.',
  night: 'Open past midnight, some until morning.',
  closed: 'Not opening tonight.',
  unknown: "The map doesn't list hours we can read.",
};

const barCount = (n: number) => `${n} ${n === 1 ? 'bar' : 'bars'}`;

/** The four groups, always in display order (FR-4.2), each with icon, heading and count. */
export function ResultGroups({ groups }: { groups: readonly ClosingGroup[] }) {
  return (
    <div className="groups">
      {groups.map((group) => {
        const Icon = GROUP_ICONS[group.category];
        const headingId = `group-${group.category}`;
        return (
          <section key={group.category} className={`group group--${group.category}`} aria-labelledby={headingId}>
            <header className="group__header">
              <h2 id={headingId} className="group__title">
                <Icon className="group__icon" />
                <span>{group.label}</span>
                <span className="group__count">{barCount(group.items.length)}</span>
              </h2>
              <p className="group__note">{GROUP_NOTES[group.category]}</p>
            </header>
            {group.items.length > 0 ? (
              <ol className="group__list">
                {group.items.map((item) => (
                  <BarCard key={item.bar.id} item={item} />
                ))}
              </ol>
            ) : (
              <p className="group__empty">None in this area.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
