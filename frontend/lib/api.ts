/**
 * 后端 API 根路径。
 * - 推荐：`NEXT_PUBLIC_API_BASE_URL=/api-backend`（经 Next 反向代理，同源无 CORS）
 * - 直连：`http://127.0.0.1:3001`（需后端开启 CORS）
 */
export function getApiBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  return "/api-backend";
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** 由 apiFetchJson 在非 2xx 时抛出，便于按 HTTP 状态区分提示 */
export type ApiRequestError = Error & { status: number };

function parseErrorBody(text: string, status: number): string {
  let message = `请求失败 (${status})`;
  try {
    const j = JSON.parse(text) as { message?: string | string[] };
    if (j.message !== undefined && j.message !== null) {
      message = Array.isArray(j.message) ? j.message.join("；") : String(j.message);
    } else if (text?.trim()) {
      message = text.trim().slice(0, 300);
    }
  } catch {
    if (text?.trim()) message = text.trim().slice(0, 300);
  }
  return message;
}

export async function apiFetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    ...authHeaders()
  };

  const res = await fetch(url, {
    ...init,
    headers
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const message = parseErrorBody(text, res.status);
    const err = new Error(message) as ApiRequestError;
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as T;
}

/**
 * 下载二进制/文件流（如 CSV 模板），失败时抛出与 apiFetchJson 一致的 ApiRequestError。
 */
export async function apiDownloadBlob(url: string, init?: RequestInit): Promise<Blob> {
  const headers: Record<string, string> = {
    Accept: "*/*",
    ...(init?.headers as Record<string, string> | undefined),
    ...authHeaders()
  };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const message = parseErrorBody(text, res.status);
    const err = new Error(message) as ApiRequestError;
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

