// CollectionStatCards.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { PhilippinePeso, ShieldAlert, FileCheck, CircleAlert } from 'lucide-react';
import { formatPeso } from '../../accounts-receivable/utils';

interface CollectionStatCardsProps {
  totalOutstanding: number;
  totalCommitted: number;
  brokenPromisesCount: number;
  pendingFollowUps: number;
}

export function CollectionStatCards({
  totalOutstanding,
  totalCommitted,
  brokenPromisesCount,
  pendingFollowUps,
}: CollectionStatCardsProps) {
  const stats = [
    {
      label: 'TOTAL OUTSTANDING AR',
      value: formatPeso(totalOutstanding),
      desc: 'Current ledger exposure',
      icon: <PhilippinePeso className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      className: 'border-blue-500/10 dark:border-blue-500/20 bg-blue-500/[0.02]',
    },
    {
      label: 'TOTAL COMMITTED (PTP)',
      value: formatPeso(totalCommitted),
      desc: `${((totalCommitted / (totalOutstanding || 1)) * 100).toFixed(1)}% of outstanding`,
      icon: <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      className: 'border-emerald-500/10 dark:border-emerald-500/20 bg-emerald-500/[0.02]',
    },
    {
      label: 'BROKEN PROMISES',
      value: brokenPromisesCount,
      desc: 'Requires immediate follow-up',
      icon: <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
      className: 'border-rose-500/10 dark:border-rose-500/20 bg-rose-500/[0.02]',
    },
    {
      label: 'PENDING ACTION',
      value: pendingFollowUps,
      desc: 'Invoices without commitment',
      icon: <CircleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      className: 'border-amber-500/10 dark:border-amber-500/20 bg-amber-500/[0.02]',
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {stats.map((stat, idx) => (
        <motion.div
          key={idx}
          whileHover={{ y: -2, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className={`flex flex-col gap-1 rounded-xl border p-4 shadow-sm backdrop-blur-md transition-all duration-300 ${stat.className}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{stat.label}</span>
            <div className="p-1.5 rounded-lg bg-muted/45">{stat.icon}</div>
          </div>
          <div className="text-lg font-black text-foreground mt-1 tabular-nums">{stat.value}</div>
          <div className="text-[10px] text-muted-foreground/75 leading-tight font-medium mt-1">{stat.desc}</div>
        </motion.div>
      ))}
    </div>
  );
}
