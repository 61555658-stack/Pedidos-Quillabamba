export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || "No pudimos completar la solicitud.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}