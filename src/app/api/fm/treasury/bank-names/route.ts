import {NextResponse } from "next/server";
import { cookies } from "next/headers";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    try {
        const springRes = await fetch(`${getSpringBaseUrl()}/api/v1/banks`, {
            headers: { "Authorization": `Bearer ${token}` },
            cache: "no-store",
        });

        if (!springRes.ok) throw new Error(await springRes.text());
        return NextResponse.json(await springRes.json());
    } catch {
        return NextResponse.json({ message: "BFF Error" }, { status: 502 });
    }
}