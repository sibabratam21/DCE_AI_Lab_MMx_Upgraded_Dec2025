
import React from 'react';
import { ColumnSummaryItem } from '../types';

interface ColumnSummaryTableProps {
  summary: ColumnSummaryItem[];
}

export const ColumnSummaryTable: React.FC<ColumnSummaryTableProps> = ({ summary }) => {
  if (!summary || summary.length === 0) {
    return null;
  }

  // The summary data is pre-sorted by App.tsx. No need for redundant sorting here.

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 mt-3">
        <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
            <tr>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                Role
            </th>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                Assigned Columns
            </th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
            {summary.filter(item => item.columns.length > 0).map(({ role, columns }) => (
            <tr key={role}>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-gray-800">{role}</td>
                <td className="px-3 py-2 whitespace-normal text-sm text-gray-600">{columns.join(', ')}</td>
            </tr>
            ))}
        </tbody>
        </table>
    </div>
  );
};
