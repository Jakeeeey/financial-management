// src/app/(supply-chain-management)/scm/_components/app-sidebar.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  Bot,
  Command,
  Settings2,
  SquareTerminal,
} from "lucide-react";

import { NavMain } from "./nav-main";
import { Separator } from "@/components/ui/separator";
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
      title: "Dashboard",
      url: "/fm/",
      icon: BookOpen,
      isActive: true,
    },
    {
      title: "Asset Management",
      url: "/fm/asset-management",
      icon: SquareTerminal,
      isActive: true,
      // items: [{ title: "Purchase Order", url: "/scm/supplier-management/purchase-order" }],
    },
    {
      title: "Chart Of Accounts",
      url: "/fm/chart-of-accounts",
      icon: SquareTerminal,
      isActive: true,
      // items: [{ title: "Purchase Order", url: "/scm/supplier-management/purchase-order" }],
    },
    {
      title: "Line Discount",
      url: "/fm/line-discount",
      icon: SquareTerminal,
      isActive: true,
      // items: [{ title: "Purchase Order", url: "/scm/supplier-management/purchase-order" }],
    },
    {
      title: "Discount Type",
      url: "/fm/discount-type",
      icon: SquareTerminal,
      isActive: true,
      // items: [{ title: "Purchase Order", url: "/scm/supplier-management/purchase-order" }],
    },
    {
      title: "Supplier Registration",
      url: "/fm/supplier-registration",
      icon: Bot,
      isActive: true,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/main-dashboard">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Command className="size-4" />
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
        <NavMain items={data.navMain} />
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
