// tax-calendar/components/MetricCards.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Clock, AlertCircle, FileCheck, TrendingUp } from 'lucide-react';

interface MetricCardProps {
  title:   string;
  value:   string | number;
  sub:     string;
  icon:    React.ReactNode;
  accent?: string;
}

function MetricCard({ title, value, sub, icon, accent }: MetricCardProps) {
  return (
    <Card className="shadow-none border-border">
      <CardContent className="pt-6 pb-5 px-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-2">{title}</p>
            <p className={`text-2xl font-bold tracking-tight ${accent ?? 'text-foreground'}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
          <div className="text-primary mt-0.5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  upcomingDeadlines: number;
  overdueFilings:    number;
  filedThisPeriod:   number;
  complianceRate:    number;
}

export function TaxMetricCards({ upcomingDeadlines, overdueFilings, filedThisPeriod, complianceRate }: Props) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4 w-full">
      <MetricCard title="Total Upcoming Deadlines" value={upcomingDeadlines} sub="Next 7 days" icon={<Clock className="h-4 w-4" />} accent="text-orange-600 dark:text-orange-400" />
      <MetricCard title="Overdue Filings" value={overdueFilings} sub="Requires immediate action" icon={<AlertCircle className="h-4 w-4" />} accent="text-red-600 dark:text-red-400" />
      <MetricCard title="Filed This Period" value={filedThisPeriod} sub="Successfully completed" icon={<FileCheck className="h-4 w-4" />} accent="text-green-600 dark:text-green-400" />
      <MetricCard title="Compliance Rate" value={`${complianceRate}%`} sub="On-time filings" icon={<TrendingUp className="h-4 w-4" />} accent="text-blue-600 dark:text-blue-400" />
    </div>
  );
}