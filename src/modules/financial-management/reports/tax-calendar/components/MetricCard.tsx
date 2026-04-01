// tax-calendar/components/MetricCards.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Clock, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface MetricCardProps {
  title:   string;
  value:   number;
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
  pending: number;
  overdue: number;
  filed:   number;
  paid:    number;
}

export function TaxMetricCards({ pending, overdue, filed, paid }: Props) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4 w-full">
      <MetricCard title="Pending"  value={pending} sub="Awaiting action"              icon={<Clock        className="h-4 w-4" />} accent="text-foreground" />
      <MetricCard title="Overdue"  value={overdue} sub="Requires immediate attention"  icon={<AlertCircle  className="h-4 w-4" />} accent="text-foreground" />
      <MetricCard title="Filed"    value={filed}   sub="Successfully filed"            icon={<FileText     className="h-4 w-4" />} accent="text-foreground" />
      <MetricCard title="Paid"     value={paid}    sub="Completed"                     icon={<CheckCircle2 className="h-4 w-4" />} accent="text-foreground" />
    </div>
  );
}