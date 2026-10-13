import { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';

interface CalloutProps {
  type: 'tip' | 'warning' | 'critical' | 'info';
  children: ReactNode;
}

export function Callout({ type, children }: CalloutProps) {
  const styles = {
    tip: 'border-[#E3E8EE] bg-[#F9FAFC] text-[#131d29] dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-100',
    critical: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100',
    info: 'border-[#E3E8EE] bg-[#F9FAFC] text-[#131d29] dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100',
  };

  const icons = {
    tip: '💡',
    warning: '⚠️',
    critical: '🚨',
    info: 'ℹ️',
  };

  return (
    <div className={`rounded-lg border-l-4 p-4 ${styles[type]}`}>
      <div className="flex gap-3">
        <span className="text-lg">{icons[type]}</span>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

interface ComparisonTableProps {
  headers: string[];
  rows: (string | ReactNode)[][];
}

export function ComparisonTable({ headers, rows }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[#E3E8EE] dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="border-b border-[#E3E8EE] bg-[#F9FAFC] dark:border-zinc-800 dark:bg-zinc-900">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-left font-semibold text-[#131d29] dark:text-zinc-50">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3E8EE] dark:divide-zinc-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-[#F9FAFC] dark:hover:bg-zinc-900">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-[#41505F] dark:text-zinc-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProofPoint({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
      <span className="text-lg">✅</span>
      <div className="flex-1 text-sm text-green-900 dark:text-green-100">{children}</div>
    </div>
  );
}

export function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-1 text-green-600 dark:text-green-400">✓</span>
          <span className="text-[#41505F] dark:text-zinc-300">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CTABlock({ 
  title, 
  description, 
  buttonText, 
  buttonHref 
}: { 
  title: string;
  description: string;
  buttonText: string;
  buttonHref: string;
}) {
  return (
    <div className="rounded-lg border border-[#E3E8EE] bg-[#F9FAFC] p-6 dark:border-blue-900 dark:bg-blue-950">
      <h3 className="mb-2 text-lg font-semibold text-[#131d29] dark:text-blue-100">{title}</h3>
      <p className="mb-4 text-sm text-[#131d29] dark:text-blue-200">{description}</p>
      <a
        href={buttonHref}
        className={buttonVariants()}
      >
        {buttonText}
      </a>
    </div>
  );
}
