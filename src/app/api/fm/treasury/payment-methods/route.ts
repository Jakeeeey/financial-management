import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    try {
        const res = await fetch(`${getSpringBaseUrl()}/api/v1/collections/payment-methods`, {
            headers: { "Authorization": `Bearer ${token}` },
            cache: "no-store",
        });

        if (!res.ok) throw new Error(await res.text());
        return NextResponse.json(await res.json());
    } catch (err: unknown) {
        return NextResponse.json({ message: String(err) }, { status: 500 });
    }
}