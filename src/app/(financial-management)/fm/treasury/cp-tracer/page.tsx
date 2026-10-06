import {cookies} from "next/headers";
import {NavUser} from "@/components/shared/app-sidebar/nav-user";
import {Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator} from "@/components/ui/breadcrumb";
import {Separator} from "@/components/ui/separator";
import {SidebarTrigger} from "@/components/ui/sidebar";
import CPTracerModule from "@/modules/financial-management/treasury/cp-tracer/CPTracerModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function userFromToken(token: string | undefined) {
    try {
        const payload = JSON.parse(Buffer.from(token?.split(".")[1] || "", "base64url").toString("utf8")) as Record<string, unknown>;
        const first = payload.Firstname ?? payload.firstName ?? payload.first_name;
        const last = payload.Lastname ?? payload.lastName ?? payload.last_name;
        const email = payload.email ?? payload.Email;
        const name = [first, last].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(" ");
        return {
            name: name || (typeof email === "string" && email) || "User",
            email: typeof email === "string" ? email : "",
            avatar: "/avatars/shadcn.jpg",
        };
    } catch {
        return {name: "User", email: "", avatar: "/avatars/shadcn.jpg"};
    }
}

export default async function Page() {
    const token = (await cookies()).get("vos_access_token")?.value;
    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-3 shadow-sm sm:h-16 sm:px-4">
                <div className="flex min-w-0 items-center gap-2">
                    <SidebarTrigger className="-ml-1 shrink-0" />
                    <Separator orientation="vertical" className="hidden h-4 sm:block" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block"><BreadcrumbLink href="#">FM</BreadcrumbLink></BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem className="hidden md:block"><BreadcrumbLink href="#">Treasury</BreadcrumbLink></BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden md:block" />
                            <BreadcrumbItem><BreadcrumbPage>CP Tracer</BreadcrumbPage></BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
                <NavUser user={userFromToken(token)} />
            </header>
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
                <CPTracerModule />
            </main>
        </div>
    );
}
