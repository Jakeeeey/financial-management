export type PettyCashHeaderUser = { name: string; email: string };

export function pettyCashHeaderUser(payload: Record<string, unknown> | null): PettyCashHeaderUser {
  const pick = (keys: string[]) => {
    for (const key of keys) {
      const value = payload?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const first = pick(["Firstname", "FirstName", "firstName", "firstname", "first_name"]);
  const last = pick(["LastName", "Lastname", "lastName", "lastname", "last_name"]);
  const email = pick(["email", "Email"]);
  return { name: [first, last].filter(Boolean).join(" ") || email || "User", email };
}
