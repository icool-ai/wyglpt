/**
 * 后端 API 根路径。
 * - 推荐：`NEXT_PUBLIC_API_BASE_URL=/api-backend`（经 Next 反向代理，同源无 CORS）
 * - 直连：`http://127.0.0.1:3001`（需后端开启 CORS；勿与当前站点同源同端口，否则请求仍打到 Next）
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  let base = "/api-backend";
  if (raw) {
    const cut = raw.replace(/\/+$/, "");
    if (cut && cut !== "/") base = cut;
  }
  if (typeof window !== "undefined" && base.startsWith("http")) {
    try {
      const apiOrigin = new URL(base).origin;
      if (apiOrigin === window.location.origin) {
        return "/api-backend";
      }
    } catch {
      /* ignore */
    }
  }
  return base;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  // #region agent log
  fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1cd619'},body:JSON.stringify({sessionId:'1cd619',runId:'ask-401-debug',hypothesisId:'H1',location:'frontend/lib/api.ts:authHeaders',message:'resolved accessToken presence',data:{hasToken:Boolean(token),tokenLength:token?token.length:0},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1cd619'},body:JSON.stringify({sessionId:'1cd619',runId:'ask-401-debug',hypothesisId:'H2',location:'frontend/lib/api.ts:apiFetchJson',message:'about to fetch json api',data:{url,method:init?.method??'GET',hasAuthorizationHeader:Boolean(headers.Authorization),baseUrl:getApiBaseUrl()},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const res = await fetch(url, {
    ...init,
    headers
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    // #region agent log
    fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1cd619'},body:JSON.stringify({sessionId:'1cd619',runId:'ask-401-debug',hypothesisId:'H7',location:'frontend/lib/api.ts:apiFetchJson:notOk',message:'api returned non-2xx',data:{url,status:res.status,hasAuthorizationHeader:Boolean(headers.Authorization)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const message = parseErrorBody(text, res.status);
    const err = new Error(message) as ApiRequestError;
    err.status = res.status;
    throw err;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const html = text.trimStart().startsWith("<");
    throw new Error(
      html
        ? "接口返回了网页而非 JSON，多为代理指错了端口（前端请用 3000，后端在 3001，勿与 next dev 同端口）"
        : "响应不是合法 JSON",
    );
  }
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

/** 发起请求并返回流（SSE），成功时 res.ok 且 body 可读；非 2xx 仍抛 ApiRequestError */
export async function apiFetchStream(url: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
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
  return res;
}

export type LlmStreamChunk =
  | { kind: "reasoning"; text: string }
  | { kind: "content"; text: string }
  | { event: "error"; message: string };

/**
 * 解析后端转发的 OpenAI/SSE：`data: {json}\\n` 或 `data: [DONE]`。
 */
export async function readSseDataLines(
  response: Response,
  onData: (data: LlmStreamChunk | Record<string, unknown>) => void
): Promise<void> {
  const body = response.body;
  if (!body) throw new Error("响应无 body");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let lineEnd: number;
    while ((lineEnd = buffer.indexOf("\n")) >= 0) {
      const rawLine = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 1);
      const line = rawLine.replace(/\r$/, "").trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        onData(JSON.parse(payload) as LlmStreamChunk | Record<string, unknown>);
      } catch {
        /* ignore */
      }
    }
  }
}

