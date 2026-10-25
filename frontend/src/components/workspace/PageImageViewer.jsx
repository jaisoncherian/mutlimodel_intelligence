import React from 'react';

/**
 * @param {Object} props
 * @param {number} props.currentPage
 * @param {Array<any>} [props.tableRows]
 * @param {string} [props.activeCitation]
 */
export default function PageImageViewer({
  currentPage = 3,
  tableRows = [
    { quarter: 'Q1 2025', revenue: '125,400', cost: '83,200', units: '4,850', highlighted: true },
    { quarter: 'Q2 2025', revenue: '138,750', cost: '91,600', units: '5,120', highlighted: false },
    { quarter: 'Q3 2025', revenue: '142,300', cost: '94,150', units: '5,260', highlighted: false },
    { quarter: 'Q4 2025', revenue: '167,900', cost: '108,400', units: '5,940', highlighted: true },
  ],
  activeCitation = 'S1',
}) {
  return (
    <div className="bg-white text-slate-900 rounded-[6px] border border-slate-300 p-4 shadow-md space-y-3">
      <div className="border-b border-slate-200 pb-2">
        <h3 className="text-xs font-bold text-slate-900">
          Page {currentPage} — Quarterly Financial Table
        </h3>
        <p className="text-[10px] text-slate-600 mt-0.5">Primary accounting transcript</p>
      </div>

      <div className="overflow-hidden border border-slate-200 rounded">
        <table className="w-full text-left text-[11px] divide-y divide-slate-200">
          <thead className="bg-slate-50 text-slate-700 font-semibold">
            <tr>
              <th className="py-1.5 px-2">Quarter</th>
              <th className="py-1.5 px-2">Revenue (USD)</th>
              <th className="py-1.5 px-2">Operating Cost (USD)</th>
              <th className="py-1.5 px-2">Units Produced</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono text-slate-900">
            {tableRows.map((row, idx) => {
              const isHighlighted =
                row.highlighted ||
                (activeCitation === 'S1' &&
                  (row.quarter === 'Q1 2025' || row.quarter === 'Q4 2025'));
              return (
                <tr
                  key={idx}
                  className={isHighlighted ? 'highlight-row bg-indigo-50 text-indigo-950' : ''}
                >
                  <td
                    className={`py-1.5 px-2 ${
                      isHighlighted ? 'font-semibold text-indigo-950' : ''
                    }`}
                  >
                    {row.quarter}
                  </td>
                  <td
                    className={`py-1.5 px-2 ${
                      isHighlighted ? 'font-bold text-indigo-950' : ''
                    }`}
                  >
                    {row.revenue}
                  </td>
                  <td
                    className={`py-1.5 px-2 ${
                      isHighlighted ? 'text-indigo-950' : ''
                    }`}
                  >
                    {row.cost}
                  </td>
                  <td
                    className={`py-1.5 px-2 ${
                      isHighlighted ? 'text-indigo-950' : ''
                    }`}
                  >
                    {row.units}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 p-2 rounded border border-slate-200">
        <p className="text-[10px] text-slate-600 leading-tight">
          Table note: revenue and operating cost are in US dollars. The highest revenue occurred in Q4
          2025.
        </p>
      </div>
    </div>
  );
}
