import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || id === "null" || id === "undefined") {
      return new NextResponse("Valid Image ID Required", { status: 400 });
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${id}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
        },
      },
    );

    if (!response.ok) return new NextResponse("Not Found", { status: 404 });

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error: unknown) {
    return new NextResponse((error as Error)?.message || "Internal Server Error", { status: 500 });
  }
}
