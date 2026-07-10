"use client";

import React from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText, 
  Building2,
  Users
} from "lucide-react";
import { HistoryNode } from "../constants";

interface HistoryHierarchyTableProps {
  data: HistoryNode[];
  expandedKeys: Set<string>;
  toggleKey: (key: string) => void;
  showCharts?: boolean; // Kept optional in props interface for backward/external interface compatibility if needed
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
};

const getLevelIcon = (level: HistoryNode['level']) => {
  switch (level) {
    case 'division': return <Building2 className="h-4 w-4 text-emerald-500" />;
    case 'department': return <Users className="h-4 w-4 text-amber-500" />;
    case 'coa': return <FileText className="h-4 w-4 text-muted-foreground" />;
    default: return <Folder className="h-4 w-4" />;
  }
};

export function HistoryHierarchyTable({ data, expandedKeys, toggleKey }: HistoryHierarchyTableProps) {
  const renderRow = (node: HistoryNode, depth: number = 0) => {
    const isExpanded = expandedKeys.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSupplementalEntry = node.entryType === "supplemental";
    const supplementalCount = node.supplementalCount || 0;
    const showMergedBadge = node.level === "coa" && !!node.itemCount && node.itemCount > 1;
    const mergedBadgeLabel = supplementalCount > 0
      ? `${supplementalCount} Supplemental`
      : `${node.itemCount || 0} Combined`;
    const mergedBadgeTitle = supplementalCount > 0
      ? `${node.itemCount} merged budget allocations, including ${supplementalCount} supplemental allocation${supplementalCount === 1 ? "" : "s"}.`
      : `${node.itemCount} distinct upstream budget allocations automatically merged.`;

    return (
      <React.Fragment key={node.id}>
        <tr 
          className={`group border-b border-border/40 hover:bg-muted/30 transition-colors ${
            depth === 0 ? "bg-muted/10" : ""
          } ${isSupplementalEntry ? "bg-primary/[0.02]" : ""}`}
        >
          <td className="py-3 px-4">
            <div 
              className="flex items-center gap-2"
              style={{ paddingLeft: `${depth * 24}px` }}
            >
              {hasChildren ? (
                <button 
                  onClick={() => toggleKey(node.id)}
                  className="p-1 hover:bg-muted rounded-md transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <div className="w-5.5" /> 
              )}
              
              <div className={`p-1.5 rounded-lg shrink-0 ${
                node.level === 'division' ? "bg-emerald-500/5" :
                node.level === 'department' ? "bg-amber-500/5" :
                "bg-muted/5"
              }`}>
                {getLevelIcon(node.level)}
              </div>
              
              <span className={`text-xs font-bold tracking-tight line-clamp-1 ${
                isSupplementalEntry ? "text-primary font-bold" : node.level === 'coa' ? "text-muted-foreground font-medium" : "text-foreground"
              }`} title={node.name}>
                {node.name}
              </span>

              {/* Accumulated Supplemental Items Pill Badge */}
              {showMergedBadge ? (
                <span 
                  className="inline-flex items-center px-1.5 py-0.25 rounded-full text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 shrink-0 ml-1.5 animate-in fade-in transition-all"
                  title={mergedBadgeTitle}
                >
                  {mergedBadgeLabel}
                </span>
              ) : null}
            </div>
          </td>
          <td className="py-3 px-4 text-right">
             <div className="flex items-center justify-end gap-3">
                <span className="text-xs font-black tabular-nums text-foreground">
                  {formatCurrency(node.budget)}
                </span>
             </div>
          </td>
        </tr>
        {hasChildren && isExpanded && (
          node.children!.map(child => renderRow(child, depth + 1))
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="rounded-3xl border border-border/50 bg-card shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr className="bg-muted/50 border-b border-border/50">
            <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-2/3">
              Hierarchy Structure (Division / Department / COA)
            </th>
            <th className="py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">
              Approved Budget
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map(node => renderRow(node))}
        </tbody>
      </table>
    </div>
  );
}
