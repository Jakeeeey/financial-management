"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Briefcase,
  ListTree,
  Landmark,
  Calculator,
  TrendingUp,
  Lock,
  Send,
  Building,
  Receipt,
  Inbox,
  Store,
  Scale,
  LineChart,
  Wallet,
  BookOpen,
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardList,
  List,
  FileOutput,
  CreditCard,
  History,
  ShoppingCart,
  FileMinus,
  FilePlus,
  PackageSearch,
  Truck,
  UserPlus,
  CalendarClock,
  Boxes,
  BadgePercent,
  FileBarChart,
  NotebookPen,
  RefreshCcw,
  Layers,
  FileSpreadsheet,
  FileText,
  Files,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  FileCheck2,
  CalendarDays,
  FolderTree,
  Tag,
  Tags,
  CheckCheckIcon,
  Plus,

} from "lucide-react";

import { NavMain } from "./nav-main";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
  navMain: [
    {
      title: "Asset Management",
      url: "/fm/asset-management",
      icon: Briefcase,
      isActive: true,
    },
    {
      title: "Chart Of Accounts",
      url: "/fm/chart-of-accounts",
      icon: ListTree,
      isActive: true,
    },
    /*{
      title: "Treasury",
      url: "#",
      icon: Landmark,
      items: [
        {
          title: "Budgeting",
          url: "#",
          icon: Briefcase,
          items: [
            { title: "Dashboard", url: "/fm/treasury/budgeting/dashboard-v1", icon: Briefcase },
            { title: "Budget Requests", url: "/fm/treasury/budgeting/budget-records", icon: Briefcase },
            { title: "Budget Approvals", url: "/fm/treasury/budgeting/budget-approvals", icon: Briefcase },
            { title: "Audit Trails", url: "/fm/treasury/budgeting/budget-audit-trail", icon: Briefcase },
            { title: "Reports", url: "/fm/treasury/budgeting/reports", icon: Briefcase },
          ],
        },
        { title: "Disbursement", url: "/fm/treasury/disbursement", icon: Briefcase },
        { title: "Remittances", url: "/fm/treasury/remittances", icon: Briefcase },
      ],
    },*/
    {
      title: "Treasury",
      url: "#",
      icon: Landmark,
      items: [
        {
          title: "Budgeting",
          url: "#",
          icon: Calculator,
          isActive: true,
          items: [
            {
              title: "Current Budget",
              url: "/fm/treasury/budgeting/current-budget",
              icon: TrendingUp,
            },
            {
              title: "Non Current Budget",
              url: "/fm/treasury/budgeting/non-current-budget",
              icon: Lock,
            },
            {
              title: "User Expense Limit",
              url: "/fm/treasury/budgeting/user-expense-limit",
              icon: Wallet,
            }
          ]
        },
        {
          title: "Expense Approval",
          url: "#",
          icon: Receipt,
          isActive: true,
          items: [
            {
              title: "Salesman Expense",
              url: "/fm/treasury/salesman-expense-approval",
              icon: Receipt,
            },
            {
              title: "Bulk Approval",
              url: "/fm/treasury/bulk-approval",
              icon: CheckCheckIcon,
            }
          ]
        },
        {
          title: "Disbursement",
          url: "/fm/treasury/disbursement",
          icon: Send,
        },
        {
          title: "Bank Management",
          url: "#",
          icon: Building,
          isActive: true,
          items: [
            {
              title: "Cheque Monitoring",
              url: "/fm/treasury/bank-management/cheque-monitoring",
              icon: Receipt,
            },
          ]
        },
        {
          title: "Collection Posting",
          url: "#",
          icon: Inbox,
          isActive: true,
          items: [
            {
              title: "Cashiering",
              url: "/fm/treasury/collection-posting/cashiering",
              icon: Store,
            },
          ]
        },
        {
          title: "Bank Reconciliation",
          url: "/fm/treasury/bank-reconciliation",
          icon: Scale,
        },
        {
          title: "Business Analytics",
          url: "#",
          icon: LineChart,
          isActive: true,
          items: [
            {
              title: "Cash Management",
              url: "/fm/treasury/business-analytics/cash-management",
              icon: Wallet,
            },
          ]
        },
      ],
    },
    {
      title: "Accounting",
      url: "#",
      icon: BookOpen,
      isActive: true,
      items: [
        {
          title: "Accounts Payable",
          url: "/fm/accounting/accounts-payable",
          icon: ArrowDownToLine,
        },
        {
          title: "Accounts Receivable",
          url: "/fm/accounting/accounts-receivable",
          icon: ArrowUpToLine,
        },
        {
          title: "Assets",
          url: "#",
          icon: Briefcase,
          isActive: true,
          items: [
            {
              title: "Current Assets",
              url: "/fm/accounting/assets/current-asset",
              icon: Briefcase,
            },
            {
              title: "Non Current Assets",
              url: "/fm/accounting/assets/non-current-asset",
              icon: Briefcase,
            }
          ]
        },
        {
          title: "Claims",
          url: "#",
          icon: ClipboardList,
          isActive: true,
          items: [
            {
              title: "CCM's List",
              url: "/fm/accounting/claims-management/ccm-list",
              icon: List,
            },
            {
              title: "Generate Transmittal",
              url: "/fm/accounting/claims-management/generate-transmittal",
              icon: FileOutput,
            },
            {
              title: "For Receiving",
              url: "/fm/accounting/claims-management/for-receiving",
              icon: Inbox,
            },
            {
              title: "For Payment",
              url: "/fm/accounting/claims-management/for-payment",
              icon: CreditCard,
            },
            {
              title: "Transmittal History",
              url: "/fm/accounting/claims-management/transmittal-history",
              icon: History,
            }
          ]
        },
        {
          title: "Purchase Order",
          url: "/fm/accounting/purchase-order",
          icon: ShoppingCart,
        },
        {
          title: "Customer Debit Memo",
          url: "/fm/accounting/customer-debit-memo",
          icon: FileMinus,
        },
        {
          title: "Customer Credit Memo",
          url: "/fm/accounting/customer-credit-memo",
          icon: FilePlus,
        },
        {
          title: "Procurement",
          url: "/fm/accounting/procurement",
          icon: PackageSearch,
        },
        {
          title: "Supplier Debit Memo",
          url: "/fm/accounting/supplier-debit-memo",
          icon: FileMinus,
        },
        {
          title: "Supplier Credit Memo",
          url: "/fm/accounting/supplier-credit-memo",
          icon: FilePlus,
        },
        {
          title: "Supplier Management",
          url: "#",
          icon: Truck,
          isActive: true,
          items: [
            {
              title: "Supplier Registration",
              url: "/fm/supplier-registration",
              icon: UserPlus,
              isActive: true,
            },
            {
              title: "Delivery Terms",
              url: "/fm/accounting/supplier-management/delivery-terms",
              icon: CalendarClock,
            },
            {
              title: "Payment Terms",
              url: "/fm/accounting/supplier-management/payment-terms",
              icon: CreditCard,
            },
            {
              title: "Product Per Supplier",
              url: "#",
              icon: Boxes,
            },
            {
              title: "Discount Setting",
              url: "#",
              icon: BadgePercent,
            }
          ]
        },
      ],
    },
    {
      title: "Price Control",
      url: "#",
      icon: FileSpreadsheet,
      isActive: true,
      items: [
        {
          title: "Product Pricing",
          url: "/fm/price-control/product-pricing",
          icon: FileText,
        },
        {
          title: "Price Change Requests",
          url: "/fm/price-control/price-change-requests",
          icon: FileText,
        },
        {
          title: "Price Type Creation",
          url: "/fm/price-control/price-type-creation",
          icon: Plus,
        },
      ],
    },

    {
      title: "Financial Statements",
      url: "#",
      icon: FileBarChart,
      isActive: true,
      items: [
        {
          title: "Journal Entry",
          url: "/fm/financial-statements/journal-entry",
          icon: NotebookPen,
        },
        {
          title: "Trial Balance",
          url: "/fm/financial-statements/trial-balance",
          icon: Scale,
        },
        {
          title: "Statement of Financial Position",
          url: "/fm/financial-statements/statement-of-financial-position",
          icon: Landmark,
        },
        {
          title: "Statement of Financial Performance",
          url: "/fm/financial-statements/statement-of-financial-performance",
          icon: TrendingUp,
        },
        {
          title: "Statement of Cash Flow",
          url: "/fm/financial-statements/statement-of-cash-flow",
          icon: RefreshCcw,
        },
        {
          title: "Statement of Changes in Equity",
          url: "/fm/financial-statements/statement-of-changes-in-equity",
          icon: Layers,
        },
      ]
    },
    {
      title: "Reports",
      url: "#",
      icon: FileSpreadsheet,
      isActive: true,
      items: [
        {
          title: "EWT",
          url: "/fm/reports/ewt",
          icon: FileText,
        },
        {
          title: "CWT",
          url: "/fm/reports/cwt",
          icon: Files,
        },
        {
          title: "VAT",
          url: "#",
          icon: Percent,
          items: [
            {
              title: "VAT Selling",
              url: "/fm/reports/vat/vat-selling",
              icon: ArrowUpRight,
            },
            {
              title: "VAT Purchases",
              url: "/fm/reports/vat/vat-purchases",
              icon: ArrowDownRight,
            }
          ]
        },
        {
          title: "FWT",
          url: "/fm/reports/fwt",
          icon: FileCheck2,
        },
        {
          title: "Tax Calendar",
          url: "/fm/reports/tax-calendar",
          icon: CalendarDays,
        }
      ],
    },
    {
      title: "File Management",
      url: "#",
      icon: FolderTree,
      items: [
        {
          title: "Discount",
          url: "#",
          icon: BadgePercent,
          items: [
            {
              title: "Discount Type",
              url: "/fm/file-management/discount/discount-type",
              icon: Tag,
            },
            {
              title: "Line Discount",
              url: "/fm/file-management/discount/line-discount",
              icon: Tags,
            },
          ],
        },
      ],
    },

  ],
};

export function AppSidebar({
  className,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      {...props}
      className={cn(
        "border-r border-sidebar-border/60 dark:border-white/20",
        "shadow-sm dark:shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_16px_40px_-24px_rgba(0,0,0,0.9)]",
        className
      )}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/main-dashboard">
                <div className="flex aspect-square size-10 items-center justify-center overflow-hidden">
                  <Image
                    src="/vertex_logo_black.png"
                    alt="VOS Logo"
                    width={40}
                    height={40}
                    className="h-9 w-10 object-contain"
                    priority
                  />
                </div>

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">VOS Web</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Financial Management
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <Separator />

      <SidebarContent>
        <div className="px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground">
          Platform
        </div>

        <ScrollArea
          className={cn(
            "min-h-0 flex-1",
            "[&_[data-radix-scroll-area-viewport]>div]:block",
            "[&_[data-radix-scroll-area-viewport]>div]:w-full",
            "[&_[data-radix-scroll-area-viewport]>div]:min-w-0"
          )}
        >
          <div className="w-full min-w-0">
            <NavMain items={data.navMain} />
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="p-0">
        <Separator />
        <div className="py-3 text-center text-xs text-muted-foreground">
          VOS Web v2.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
