import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getSpringBaseUrl = () => {
  const url = process.env.SPRING_API_BASE_URL;
  return (url || "http://localhost:8080").replace(/\/$/, "");
};

const toSafeInteger = (value: string | null, fallback: number, minimum: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
};

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" ? value as Record<string, unknown> : {}
);

const normalizeUser = (value: unknown) => {
  const user = asRecord(value);

  return {
    id: user.id ?? user.user_id ?? user.userId,
    firstName: user.firstName ?? user.user_fname ?? "",
    middleName: user.middleName ?? user.user_mname ?? "",
    lastName: user.lastName ?? user.user_lname ?? "",
    email: user.email ?? user.user_email ?? "",
    tinNumber: user.tinNumber ?? user.user_tin ?? "",
    contactNumber: user.contact ?? user.user_contact ?? "",
    isDeleted: user.isDeleted ?? user.is_deleted ?? false,
  };
};

const isActiveUser = (user: ReturnType<typeof normalizeUser>) => {
  if (typeof user.isDeleted === "boolean") return !user.isDeleted;
  if (typeof user.isDeleted === "number") return user.isDeleted === 0;
  return true;
};

const matchesSearch = (user: ReturnType<typeof normalizeUser>, search: string) => {
  if (!search) return true;

  const searchable = [
    user.firstName,
    user.middleName,
    user.lastName,
    `${user.firstName} ${user.lastName}`,
    user.email,
    user.tinNumber,
    user.contactNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(search.toLowerCase());
};

const sortUsers = (left: ReturnType<typeof normalizeUser>, right: ReturnType<typeof normalizeUser>) => (
  `${left.firstName} ${left.lastName} ${left.id ?? ""}`.localeCompare(
    `${right.firstName} ${right.lastName} ${right.id ?? ""}`,
  )
);

const paginateUsers = (
  users: ReturnType<typeof normalizeUser>[],
  page: number,
  size: number,
) => {
  const start = page * size;
  const data = users.slice(start, start + size);

  return {
    data,
    page,
    pageSize: size,
    total: users.length,
    hasMore: start + data.length < users.length,
  };
};

const fetchLegacyLookup = async (
  baseUrl: string,
  token: string,
  search: string,
  page: number,
  size: number,
) => {
  const legacyResponse = await fetch(`${baseUrl}/users?sort=firstName`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!legacyResponse.ok) return null;

  const legacyText = await legacyResponse.text();
  const parsed = legacyText ? JSON.parse(legacyText) as unknown : [];
  const payload = asRecord(parsed);
  const rawUsers = Array.isArray(parsed)
    ? parsed
    : Array.isArray(payload.data)
      ? payload.data
      : [];
  const users = rawUsers
    .map(normalizeUser)
    .filter(isActiveUser)
    .filter((user) => matchesSearch(user, search))
    .sort(sortUsers);

  return paginateUsers(users, page, size);
};

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search")?.trim() || "";
  const page = toSafeInteger(searchParams.get("page"), 0, 0);
  const size = Math.min(toSafeInteger(searchParams.get("size"), 25, 1), 100);

  const params = new URLSearchParams({
    search,
    page: String(page),
    size: String(size),
  });

  try {
    const springRes = await fetch(
      `${getSpringBaseUrl()}/users/lookup?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    const responseText = await springRes.text();
    if (!springRes.ok) {
      if ([400, 404, 405].includes(springRes.status)) {
        const legacyPayload = await fetchLegacyLookup(
          getSpringBaseUrl(),
          token,
          search,
          page,
          size,
        );

        if (legacyPayload) return NextResponse.json(legacyPayload);
      }

      return NextResponse.json(
        {
          message: "Unable to load user lookup",
          detail: responseText.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const parsed = responseText ? JSON.parse(responseText) as unknown : {};
    const payload = asRecord(parsed);
    const rawUsers = Array.isArray(parsed)
      ? parsed
      : Array.isArray(payload.data)
        ? payload.data
        : [];

    const data = rawUsers.map(normalizeUser);

    return NextResponse.json({
      data,
      page: toNumber(payload.page, page),
      pageSize: toNumber(payload.pageSize ?? payload.size, size),
      total: toNumber(payload.total, data.length),
      hasMore: Boolean(payload.hasMore ?? payload.hasNext ?? false),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Unable to load user lookup",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
