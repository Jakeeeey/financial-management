export const HISTORY_YEARS = [2026, 2025, 2024];
export const HISTORY_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export interface HistoryNode {
  id: string;
  name: string;
  budget: number;
  trend: number[]; 
  children?: HistoryNode[];
  level: 'division' | 'department' | 'coa';
  itemCount?: number;
}

export const BUDGET_HISTORY_DATA: HistoryNode[] = [
  {
    id: "may-industrial",
    name: "Industrial Division",
    budget: 2000000,
    trend: [45, 48, 42, 50, 55],
    level: 'division',
    children: [
      {
        id: "may-industrial-production",
        name: "Production Department",
        budget: 1500000,
        trend: [50, 52, 48, 55, 60],
        level: 'department',
        children: [
          { id: "may-ind-prod-101", name: "101 - Raw Materials", budget: 800000, trend: [60, 65, 58, 70, 75], level: 'coa' },
          { id: "may-ind-prod-102", name: "102 - Direct Labor", budget: 500000, trend: [40, 42, 38, 45, 48], level: 'coa' },
          { id: "may-ind-prod-103", name: "103 - Factory Overhead", budget: 200000, trend: [20, 22, 18, 25, 28], level: 'coa' },
        ]
      },
      {
        id: "may-industrial-qa",
        name: "Quality Assurance",
        budget: 500000,
        trend: [30, 32, 28, 35, 38],
        level: 'department',
        children: [
          { id: "may-ind-qa-201", name: "201 - Lab Supplies", budget: 300000, trend: [25, 28, 22, 30, 35], level: 'coa' },
          { id: "may-ind-qa-202", name: "202 - Equipment Maintenance", budget: 200000, trend: [15, 18, 12, 20, 25], level: 'coa' },
        ]
      }
    ]
  },
  {
    id: "may-corporate",
    name: "Corporate Division",
    budget: 1500000,
    trend: [40, 42, 38, 45, 48],
    level: 'division',
    children: [
      {
        id: "may-corp-hr",
        name: "Human Resources",
        budget: 500000,
        trend: [30, 32, 28, 35, 38],
        level: 'department',
        children: [
          { id: "may-corp-hr-301", name: "301 - Recruitment Costs", budget: 200000, trend: [20, 22, 18, 25, 28], level: 'coa' },
          { id: "may-corp-hr-302", name: "302 - Employee Training", budget: 300000, trend: [25, 28, 22, 30, 35], level: 'coa' },
        ]
      }
    ]
  },
  {
    id: "may-logistics",
    name: "Logistics Division",
    budget: 1000000,
    trend: [50, 55, 48, 60, 65],
    level: 'division',
    children: []
  }
];

