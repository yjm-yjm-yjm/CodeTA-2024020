const BASE = "/api";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function token() {
  return localStorage.getItem("codeta_token") || "";
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      String((body as { error?: string }).error || res.statusText),
      res.status
    );
  }
  return body as T;
}
