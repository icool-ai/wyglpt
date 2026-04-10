import { Injectable } from "@nestjs/common";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

@Injectable()
export class LlmService {
  private resolveProvider() {
    const provider = process.env.LLM_PROVIDER || "deepseek";
    const apiKey = process.env.LLM_API_KEY?.trim();
    if (!apiKey) throw new Error("LLM_API_KEY is not set");

    const rawBase =
      process.env.LLM_BASE_URL?.trim() ||
      (provider === "qwen"
        ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
        : "https://api.deepseek.com");

    const baseUrl = rawBase.replace(/\/+$/, "");

    return { provider, apiKey, baseUrl };
  }

  private resolveModel(inputModel?: string) {
    const provider = process.env.LLM_PROVIDER || "deepseek";
    return process.env.LLM_MODEL || inputModel || (provider === "qwen" ? "qwen-plus" : "deepseek-chat");
  }

  async chatCompletion(input: {
    system: string;
    user: string;
    model?: string;
    temperature?: number;
  }): Promise<string> {
    const { apiKey, baseUrl } = this.resolveProvider();
    const endpoint = `${baseUrl}/chat/completions`;
    const model = this.resolveModel(input.model);
    const temperature = Number(process.env.LLM_TEMPERATURE || input.temperature || 0.2);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user }
        ],
        temperature
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`LLM request failed: ${res.status} ${text}`);
    }

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("LLM response missing message.content");
    return content;
  }

  /**
   * 获取包含“思考链”的输出（DeepSeek `deepseek-reasoner` 会返回 reasoning_content）。
   * - 对不支持 reasoning_content 的模型，reasoningContent 会是空字符串。
   */
  async chatCompletionWithReasoning(input: {
    system: string;
    user: string;
    model?: string;
    temperature?: number;
  }): Promise<{ content: string; reasoningContent: string }> {
    const { apiKey, baseUrl } = this.resolveProvider();
    const endpoint = `${baseUrl}/chat/completions`;
    const model = this.resolveModel(input.model);
    const temperature = Number(process.env.LLM_TEMPERATURE || input.temperature || 0.2);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user }
        ],
        temperature
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`LLM request failed: ${res.status} ${text}`);
    }

    const data: any = await res.json();
    const msg = data?.choices?.[0]?.message;
    const content = msg?.content;
    if (typeof content !== "string") throw new Error("LLM response missing message.content");

    const reasoningContent = typeof msg?.reasoning_content === "string" ? msg.reasoning_content : "";
    return { content, reasoningContent };
  }

  /**
   * OpenAI 兼容流式接口（SSE：`data: {...}\\n\\n`），解析出 reasoning / 正文增量。
   */
  async *streamChatCompletion(input: {
    system: string;
    user: string;
    model?: string;
    temperature?: number;
  }): AsyncGenerator<{ kind: "reasoning" | "content"; text: string }> {
    const { apiKey, baseUrl } = this.resolveProvider();
    const endpoint = `${baseUrl}/chat/completions`;
    const model = this.resolveModel(input.model);
    const temperature = Number(process.env.LLM_TEMPERATURE || input.temperature || 0.2);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user }
        ],
        temperature,
        stream: true
      })
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`LLM stream failed: ${res.status} ${text}`);
    }

    yield* this.parseOpenAiSseStream(res.body);
  }

  private async *parseOpenAiSseStream(
    body: ReadableStream<Uint8Array>
  ): AsyncGenerator<{ kind: "reasoning" | "content"; text: string }> {
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
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { reasoning_content?: string; content?: string } }>;
          };
          const delta = json?.choices?.[0]?.delta;
          if (!delta) continue;
          if (typeof delta.reasoning_content === "string" && delta.reasoning_content.length > 0) {
            yield { kind: "reasoning", text: delta.reasoning_content };
          }
          if (typeof delta.content === "string" && delta.content.length > 0) {
            yield { kind: "content", text: delta.content };
          }
        } catch {
          /* 忽略非 JSON 行 */
        }
      }
    }
  }
}

