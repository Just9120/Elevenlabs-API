export type User = { email: string; role: "admin" | "user" };

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return candidate !== null && typeof candidate === "object";
}

function parseBoundedToken(candidate: unknown): string | null {
  if (
    typeof candidate !== "string" ||
    candidate.length === 0 ||
    candidate.length > 4096 ||
    candidate !== candidate.trim()
  ) {
    return null;
  }
  return candidate;
}

export function parseAuthUser(candidate: unknown): User | null {
  if (!isRecord(candidate)) return null;
  if (
    typeof candidate.email !== "string" ||
    candidate.email.length === 0 ||
    candidate.email.length > 320 ||
    candidate.email !== candidate.email.trim() ||
    !candidate.email.includes("@") ||
    (candidate.role !== "admin" && candidate.role !== "user")
  ) {
    return null;
  }
  return { email: candidate.email, role: candidate.role };
}

export function parseAuthenticatedSessionResponse(
  candidate: unknown,
): User | null {
  if (!isRecord(candidate) || candidate.authenticated !== true) return null;
  return parseAuthUser(candidate.user);
}

export function parseCsrfResponse(
  candidate: unknown,
  expectedUser: User,
): string | null {
  if (!isRecord(candidate)) return null;
  const csrf = parseBoundedToken(candidate.csrf_token);
  if (!csrf) return null;
  if (Object.prototype.hasOwnProperty.call(candidate, "user")) {
    const responseUser = parseAuthUser(candidate.user);
    if (
      !responseUser ||
      responseUser.email !== expectedUser.email ||
      responseUser.role !== expectedUser.role
    ) {
      return null;
    }
  }
  return csrf;
}

export function parseBootstrapStatusResponse(candidate: unknown): boolean | null {
  if (!isRecord(candidate) || typeof candidate.bootstrap_required !== "boolean") {
    return null;
  }
  return candidate.bootstrap_required;
}

export function parseLoginContextResponse(candidate: unknown): string | null {
  if (!isRecord(candidate)) return null;
  return parseBoundedToken(candidate.login_csrf_token);
}

export function parseAuthenticatedLoginResponse(
  candidate: unknown,
): { user: User; csrf: string } | null {
  const user = parseAuthenticatedSessionResponse(candidate);
  if (!user) return null;
  const csrf = parseCsrfResponse(candidate, user);
  if (!csrf) return null;
  return { user, csrf };
}
