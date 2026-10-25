import React from 'react';

/**
 * Renders the automated checks breakdown, strictly separating exact
 * deterministic checks from fallible heuristic signals.
 *
 * @param {Object} props
 * @param {Array<{ label: string, status: string }>} [props.exactChecks]
 * @param {Array<{ label: string, status: string }>} [props.signals]
 * @param {boolean} [props.isError]
 */
export default function VerificationDetails({
  exactChecks = [
    { label: 'Citations point to sources sent to the model:', status: 'passed' },
    { label: 'Numbers found in cited evidence:', status: 'passed' },
    { label: 'Calculation operands found in source:', status: 'passed' },
    { label: 'Answer sentences covered by claims:', status: 'passed' },
  ],
  signals = [
    { label: 'Claim 1 overlaps its cited text:', status: 'strong' },
    { label: 'Claim 2 overlaps its cited text:', status: 'strong' },
    { label: 'Model check needed for borderline claims:', status: 'none' },
  ],
  isError = false,
}) {
  if (isError) {
    return (
      <div className="rounded-[8px] border border-bordercol bg-surfaceSecondary p-4 space-y-2">
        <span className="text-xs font-semibold text-textPrimary">Check details</span>
        <p className="text-xs text-textSecondary">Checks unavailable</p>
      </div>
    );
  }

  return (
    <div className="rounded-[8px] border border-bordercol bg-surfaceSecondary p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-bordercol pb-2">
        <span className="text-xs font-semibold text-textPrimary">Check details</span>
        <span className="text-[11px] text-textSecondary">Automated checks</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* EXACT CHECKS (Deterministic) */}
        <div className="space-y-2 md:border-r md:border-bordercol md:pr-4">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-textPrimary tracking-wide uppercase">
              EXACT CHECKS
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-chipNeutralBg text-chipNeutralText border border-bordercol">
              deterministic
            </span>
          </div>
          <ul className="space-y-1.5 text-xs text-textPrimary">
            {exactChecks.map((item, idx) => (
              <li key={idx} className="flex items-start justify-between">
                <span className="text-textSecondary">{item.label}</span>
                <span className="font-medium text-chipReadyText font-mono ml-2 shrink-0">
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* SIGNALS (Heuristic, can be wrong) */}
        <div className="space-y-2 md:pl-1">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-semibold text-textPrimary tracking-wide uppercase">
              SIGNALS
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-chipCautionBg text-chipCautionText border border-yellow-500/20">
              heuristic, can be wrong
            </span>
          </div>
          <ul className="space-y-1.5 text-xs text-textPrimary">
            {signals.map((item, idx) => (
              <li key={idx} className="flex items-start justify-between">
                <span className="text-textSecondary">{item.label}</span>
                <span className="font-medium text-textPrimary font-mono ml-2 shrink-0">
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pt-2 border-t border-bordercol">
        <p className="text-[11px] text-textSecondary">
          Heuristic checks are signals, not proof. Open the source to confirm.
        </p>
      </div>
    </div>
  );
}
