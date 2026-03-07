// src/app/(supply-chain-management)/scm/_components/app-sidebar.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Boxes,
  Building2,
  FileSpreadsheet,
  FolderOpenDot,
  NotebookText,
  BadgeCent,
  BadgePercent,
  Tag,
  Tags,
  Banknote,
  PiggyBank,
  ScrollText,
  Files,
  FolderOpen,
  ArrowUpRightSquare,
  ArrowDownLeftSquare,
  FileCheck2,
  CalendarCheck
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
      icon: Boxes,
      isActive: true,
    },
    {
      title: "Chart Of Accounts",
      url: "/fm/chart-of-accounts",
      icon: NotebookText,
      isActive: true,
    },
    {
      title: "File Management",
      url: "#",
      icon: FolderOpenDot,
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
    {
      title: "Supplier Registration",
      url: "/fm/supplier-registration",
      icon: Building2,
      isActive: true,
    },
    {
      title: "Accounting",
      url: "#",
      icon: BadgeCent,
      isActive: true,
      items: [
        {
          title: "Accounts Payable",
          url: "/fm/accounting/accounts-payable",
          icon: Banknote,
        },
        {
          title: "Accounts Receivable",
          url: "/fm/accounting/accounts-receivable",
          icon: PiggyBank,
        }
      ],
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
          icon: ScrollText,
        },
        {
          title: "CWT",
          url: "/fm/reports/cwt",
          icon: Files,
        },
        {
          title: "VAT",
          url: "#",
          icon: FolderOpen,
          items: [
            {
              title: "VAT Selling",
              url: "/fm/reports/vat/vat-selling",
              icon: ArrowUpRightSquare,
            },
            {
              title: "VAT Purchases",
              url: "/fm/reports/vat/vat-purchases",
              icon: ArrowDownLeftSquare,
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
          icon: CalendarCheck,
        }
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
