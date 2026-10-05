import { useState } from 'react';

import { COLD_START_SOLVES, LEDGER_SPARK_HEIGHT, LEDGER_SPARK_WIDTH } from '@/lib/constants';

import type { LedgerEntry, LedgerProfilePoint, WeaknessLedger } from '@/types/models';

const toPct = (value: number) => Math.round(value * 100);

const sameEntry = (a: LedgerEntry | null, b: LedgerEntry) =>
  a !== null && a.topic === b.topic && a.bucket === b.bucket;

// Light = practice shortfall (baseGap), dark = contest evidence (penalty).
// finalGap is already clamped to 1 on the server, so penalty only fills what's left.
const SplitBar = ({ entry }: { entry: LedgerEntry }) => {
  const baseWidth = Math.min(entry.baseGap, entry.finalGap);
  const penaltyWidth = entry.finalGap - baseWidth;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="bg-red-300" style={{ width: `${baseWidth * 100}%` }} />
      <div className="bg-red-700" style={{ width: `${penaltyWidth * 100}%` }} />
    </div>
  );
};

// "no contest" and "clean" are different facts: no evidence vs. evidence of zero fails
const ContestMarker = ({ entry }: { entry: LedgerEntry }) => {
  if (entry.contestOpportunities === 0) {
    return <span className="font-mono text-xs text-slate-400">no contest</span>;
  }
  if (entry.contestFails === 0) {
    return <span className="font-mono text-xs text-slate-500">clean</span>;
  }
  return (
    <span className="font-mono text-xs text-red-700">
      {entry.contestFails}/{entry.contestOpportunities} failed
    </span>
  );
};

const Sparkline = ({ profile }: { profile: LedgerProfilePoint[] }) => {
  const lastWithData = profile.reduce((last, p, i) => (p.finalGap !== null ? i : last), 0);
  const points = profile.slice(0, lastWithData + 1);
  const step = points.length > 1 ? LEDGER_SPARK_WIDTH / (points.length - 1) : 0;
  const y = (gap: number) => LEDGER_SPARK_HEIGHT - gap * LEDGER_SPARK_HEIGHT;

  return (
    <svg
      width={LEDGER_SPARK_WIDTH + 4}
      height={LEDGER_SPARK_HEIGHT + 4}
      viewBox={`-2 -2 ${LEDGER_SPARK_WIDTH + 4} ${LEDGER_SPARK_HEIGHT + 4}`}
      className="hidden shrink-0 sm:block"
      aria-hidden="true"
    >
      {points.map((p, i) =>
        p.inZone ? (
          <rect
            key={`zone-${p.bucket}`}
            x={i * step - 3}
            y={-2}
            width={6}
            height={LEDGER_SPARK_HEIGHT + 4}
            className="fill-slate-200"
          />
        ) : null
      )}
      {points.slice(1).map((p, i) => {
        const prev = points[i];
        if (prev.finalGap === null || p.finalGap === null) return null;
        return (
          <line
            key={`line-${p.bucket}`}
            x1={i * step}
            y1={y(prev.finalGap)}
            x2={(i + 1) * step}
            y2={y(p.finalGap)}
            className="stroke-red-400"
            strokeWidth={1.5}
          />
        );
      })}
      {points.map((p, i) =>
        p.finalGap === null ? null : (
          <circle
            key={`dot-${p.bucket}`}
            cx={i * step}
            cy={y(p.finalGap)}
            r={p.inZone ? 2 : 1.25}
            className={p.inZone ? 'fill-red-700' : 'fill-red-400'}
          />
        )
      )}
    </svg>
  );
};

interface LedgerRowProps {
  entry: LedgerEntry;
  rank?: number;
  isTop?: boolean;
  showBucket?: boolean;
  isSelected: boolean;
  onSelect: (entry: LedgerEntry) => void;
}

const LedgerRow = ({
  entry,
  rank,
  isTop = false,
  showBucket = false,
  isSelected,
  onSelect,
}: LedgerRowProps) => (
  <button
    type="button"
    onMouseEnter={() => onSelect(entry)}
    onFocus={() => onSelect(entry)}
    onClick={() => onSelect(entry)}
    className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left ${
      isSelected ? 'bg-slate-50 ring-1 ring-inset ring-slate-200' : 'hover:bg-slate-50'
    }`}
  >
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] ${
        isTop ? 'bg-red-700 text-white' : 'border border-slate-200 text-slate-400'
      }`}
    >
      {rank ?? '–'}
    </span>
    <span className="w-32 shrink-0 truncate text-sm text-slate-800 sm:w-44">
      {entry.topic}
      {showBucket && (
        <span className="ml-1 font-mono text-xs text-slate-400">@ {entry.bucket}</span>
      )}
    </span>
    <span className="w-10 shrink-0 text-right font-mono text-sm text-red-700">
      {toPct(entry.finalGap)}%
    </span>
    <div className="min-w-0 flex-1">
      <SplitBar entry={entry} />
    </div>
    <span className="hidden w-24 shrink-0 md:block">
      <ContestMarker entry={entry} />
    </span>
    <Sparkline profile={entry.profile} />
  </button>
);

const explain = (entry: LedgerEntry) => {
  if (entry.contestOpportunities > 0 && entry.contestFails > 0) {
    return `Solved ${entry.solves} of ${entry.targetCount} — but you failed this in ${entry.contestFails} of ${entry.contestOpportunities} contests.`;
  }
  if (entry.contestOpportunities > 0) {
    return `Solved ${entry.solves} of the ${entry.targetCount} the cohort has. No fails in ${entry.contestOpportunities} contests.`;
  }
  return `Solved ${entry.solves} of the ${entry.targetCount} the cohort has. No contest data yet.`;
};

// Pinned review-comment bar: stays on the last row looked at (no floating tooltip)
const AnnotationBar = ({ entry }: { entry: LedgerEntry }) => {
  const isCapped = entry.baseGap + entry.penalty > 1;
  return (
    <div className="rounded-lg border-l-2 border-slate-400 bg-slate-50 px-4 py-3">
      <p className="font-mono text-sm font-semibold text-slate-800">
        {entry.topic} @ {entry.bucket} — {toPct(entry.finalGap)}% gap
      </p>
      <p className="mt-1 text-sm text-slate-600">{explain(entry)}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-slate-500 underline decoration-dotted">
          how this is calculated
        </summary>
        <p className="mt-1 font-mono text-xs text-slate-500">
          base {entry.baseGap.toFixed(2)} + penalty {entry.penalty.toFixed(2)} ={' '}
          {entry.finalGap.toFixed(2)}
          {isCapped && ' (capped at 1.00)'}
        </p>
      </details>
    </div>
  );
};

interface GapLedgerProps {
  ledger: WeaknessLedger;
}

export const GapLedger = ({ ledger }: GapLedgerProps) => {
  const { topCandidates, nextInLine, outOfZone, zone } = ledger;
  const [selected, setSelected] = useState<LedgerEntry | null>(
    topCandidates[0] ?? nextInLine[0] ?? null
  );

  return (
    <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Why this plan · gap ledger</h2>
        <span className="rounded-md border bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">
          rating {ledger.currentRating} · zone [{zone.low}, {zone.high}]
        </span>
      </div>

      {ledger.coldStart && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You're in cold start — today's plan is picked by tag coverage, not this ranking. The
          ledger drives your plan after your first {COLD_START_SOLVES} solves in CF Tracker.
        </p>
      )}

      {topCandidates.length === 0 ? (
        <p className="text-sm text-slate-500">
          No in-zone gaps — nothing for the plan to rank in [{zone.low}, {zone.high}].
        </p>
      ) : (
        <div className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Top candidates by gap{' '}
            <span className="font-normal normal-case tracking-normal text-slate-400">
              — the input to selection, not today's output
            </span>
          </p>
          {topCandidates.map((entry, i) => (
            <LedgerRow
              key={`${entry.topic}-${entry.bucket}`}
              entry={entry}
              rank={i + 1}
              isTop
              isSelected={sameEntry(selected, entry)}
              onSelect={setSelected}
            />
          ))}

          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex-1 border-t border-dashed border-slate-300" />
            <span className="font-mono text-[11px] text-slate-400">
              top {topCandidates.length} by gap
            </span>
            <div className="flex-1 border-t border-dashed border-slate-300" />
          </div>

          {nextInLine.length > 0 && (
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
              Next in line
            </p>
          )}
          {nextInLine.map((entry, i) => (
            <LedgerRow
              key={`${entry.topic}-${entry.bucket}`}
              entry={entry}
              rank={topCandidates.length + i + 1}
              isSelected={sameEntry(selected, entry)}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      {outOfZone.length > 0 && (
        <details className="border-t pt-3">
          <summary className="cursor-pointer px-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Out of zone{' '}
            <span className="font-normal normal-case tracking-normal text-slate-400">
              — {outOfZone.length} high-gap topics outside your plan window
            </span>
          </summary>
          <div className="mt-2 space-y-1">
            {outOfZone.map((entry) => (
              <LedgerRow
                key={`${entry.topic}-${entry.bucket}`}
                entry={entry}
                showBucket
                isSelected={sameEntry(selected, entry)}
                onSelect={setSelected}
              />
            ))}
          </div>
        </details>
      )}

      {selected && <AnnotationBar entry={selected} />}
    </section>
  );
};