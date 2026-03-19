// components/MetricCard.tsx
import { Card, CardContent } from '@/components/ui/card';
import type { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  sub?:  string;
  icon:  ReactNode;
}

export function MetricCard({ title, value, sub, icon }: MetricCardProps) {
  return (
    <Card className="shadow-none border-border">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <span className="text-primary">{icon}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}