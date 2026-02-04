// src/app/(financial-management)/fm/treasury/disbursement/page.tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "../_components/nav-user";
import SupplierRepresentativeModulePage from "@/modules/financial-management/supplier-registration/SupplierRepresentativeModulePage";

// ✅ Wire the module you asked for
//  import { DisbursementModule } from "@/modules/financial-management/treasury/disbursement"

const headerUser = {
  name: "Jake Dave M. De Guzman",
  email: "jakedavedeguzman@vertex.com",
  // avatar: "/avatars/shadcn.jpg",
};

export default function Page() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="
          sticky top-2 z-50
          flex h-16 shrink-0 items-center justify-between
          border-b bg-background shadow-sm
          before:content-[''] before:absolute before:inset-x-0 before:-top-2 before:h-2 before:bg-background
        "
      >
        <div className="flex h-full items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">FM</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Supplier Registration</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* ✅ No translate hacks; keep true centering */}
        <div className="flex h-full items-center px-4">
          <NavUser user={headerUser} />
        </div>
      </header>

      <SupplierRepresentativeModulePage />

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">{/*<DisbursementModule />*/}</div>
      </ScrollArea>
    </div>
  );
}
