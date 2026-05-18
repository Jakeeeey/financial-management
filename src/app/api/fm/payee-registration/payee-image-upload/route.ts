import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/fm/payee-registration/payee-image-upload
 * Proxies the upload to Directus assets
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 },
      );
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    
    // Create new FormData for Directus
    const directusFormData = new FormData();
    directusFormData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
      body: directusFormData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.errors?.[0]?.message || "Failed to upload to Directus");
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Payee Image Upload Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
