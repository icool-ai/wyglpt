import { Injectable } from "@nestjs/common";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

@Injectable()
export class LlmService {
  async chatCompletion(input: {
    system: string;
    user: string;
    model?: string;
    temperature?: number;
  }): Promise<string> {
    const provider = process.env.LLM_PROVIDER || "deepseek";
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) throw new Error("LLM_API_KEY is not set");

    const baseUrl =
      process.env.LLM_BASE_URL ||
      (provider === "qwen"
        ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
        : "https://api.deepseek.com/v1");

    const endpoint = `${baseUrl}/chat/completions`;
    const model = process.env.LLM_MODEL || input.model || (provider === "qwen" ? "qwen-plus" : "deepseek-chat");
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
}

