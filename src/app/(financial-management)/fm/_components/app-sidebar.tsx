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
    Receipt,
    Inbox,
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
    Plus, BanknoteArrowUpIcon, HandCoins, Coins, Shovel,

} from "lucide-react";

import {NavMain} from "./nav-main";
import {Separator} from "@/components/ui/separator";
import {ScrollArea} from "@/components/ui/scroll-area";
import {cn} from "@/lib/utils";
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
                    icon: Landmark,
                    isActive: true,
                    items: [
                        {
                            title: "Management",
                            url: "/fm/treasury/bank-management/account-management",
                            icon: HandCoins,
                        },
                        {
                            title: "Bank Deposit",
                            url: "/fm/treasury/bank-management/bank-deposit",
                            icon: BanknoteArrowUpIcon,
                        },
                        {
                            title: "Cheque Monitoring",
                            url: "/fm/treasury/bank-management/cheque-monitoring",
                            icon: Receipt,
                        },
                    ]
                },
                {
                    title: "Collection",
                    url: "#",
                    icon: Inbox,
                    isActive: true,
                    items: [
                        {
                            title: "Cashiering",
                            url: "/fm/treasury/collection-posting/cashiering",
                            icon: Coins,
                        },

                        {
                            title: "Settlement",
                            url: "/fm/treasury/collection-posting/settlement",
                            icon: Scale
                        },
                        {
                            title: "Treasury",
                            url: "/fm/treasury/collection-posting/treasury",
                            icon: Shovel
                        }, {
                            title: "Reports", url: "#", icon: FileSpreadsheet,
                            items: [
                                {
                                    title: "Daily Report",
                                    url: "/fm/treasury/collection-posting/reports/daily-collection-report",
                                    icon: Coins
                                },
                                {
                                    title: "Collection Overview",
                                    url: "/fm/treasury/collection-posting/reports/collection-overview",
                                    icon: Coins
                                }
                            ]
                        }

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

export async function AppSidebar(props: ComponentProps<typeof Sidebar>) {
    // 1. Fetch data on the server using the shared action
    const items = await getSidebarNavigation("fm");

    return (
        <AppSidebarClient 
            {...props} 
            initialItems={items} 
            subsystemTitle="Financial Management"
        />
    );
}
