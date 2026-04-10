import { Body, Controller, Param, Patch, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AiService } from "./ai.service";
import { DeepAgentsService } from "./deepagents.service";
import { BillsQueryDto } from "./dto/bills-query.dto";
import { AskDto } from "./dto/ask.dto";
import { StreamChatDto } from "./dto/stream-chat.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LlmService } from "../llm/llm.service";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly llm: LlmService,
    private readonly deepagents: DeepAgentsService
  ) {}

  @Post("ticket-triage")
  async triage(@Body() body: { ticketId: string; issueType: string }) {
    return this.ai.generateTicketTriage(body);
  }

  @Post("ticket-summary")
  async summary(@Body() body: { title: string; description: string }) {
    return this.ai.summarizeTicket(body);
  }

  @Post("kpi-insight")
  async insight(@Body() body: { metric: string; current: number; previous: number }) {
    return this.ai.explainKpi(body);
  }

  @Post("candidate/submit")
  async submitCandidate(@Body() body: { actionType: any; reason: string; payload: Record<string, unknown> }) {
    return this.ai.requestExecution({
      actionType: body.actionType,
      reason: body.reason,
      payload: body.payload,
      requiresApproval: true
    });
  }

  @Patch("candidate/execute/:approvalId")
  async execute(@Param("approvalId") approvalId: string) {
    return this.ai.executeApproved(approvalId);
  }

  @Post("bills-query")
  async billsQuery(@Body() body: BillsQueryDto) {
    return this.ai.queryBillsByQuestion(body);
  }

  @Post("ask")
  async ask(@Body() body: AskDto) {
    // #region agent log
    fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1cd619'},body:JSON.stringify({sessionId:'1cd619',runId:'ask-401-debug',hypothesisId:'H5',location:'backend/src/modules/ai/ai.controller.ts:ask',message:'ai ask endpoint entered',data:{questionLength:typeof body?.question==='string'?body.question.length:0,thinking:Boolean(body?.thinking)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return this.ai.askQuestion(body);
  }

  /**
   * 先查库（与 /ai/ask 相同），再 SSE：首包 meta 含真实 items/analysis，随后流式润色正文，末包可选 extras（洞察/建议）。
   */
  @Post("ask-stream")
  async askStream(@Body() body: AskDto, @Res() res: Response) {
    await this.ai.streamAskQuestion(res, body);
  }

  /**
   * SSE（text/event-stream）：把 DeepSeek 流式 token 转发给前端，实现「逐字/逐段」显示。
   * 事件体 JSON：`{ kind: "reasoning" | "content", text: string }`，结束为 `data: [DONE]`。
   */
  @Post("chat-stream")
  async chatStream(@Body() body: StreamChatDto, @Res() res: Response) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const system = [
      "你是物业运维综合问答助手。",
      "请用简洁、可执行的中文回答用户问题。",
      "若问题与业务数据无关，也可正常对话。"
    ].join("");

    const model = body.thinking ? "deepseek-reasoner" : undefined;

    try {
      for await (const chunk of this.llm.streamChatCompletion({
        system,
        user: body.question,
        model
      })) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write("data: [DONE]\n\n");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.write(`data: ${JSON.stringify({ event: "error", message: msg })}\n\n`);
    }
    res.end();
  }

  /**
   * LangChain DeepAgents 最小链路：DeepSeek + 示例工具调用 + SSE 流式返回。
   */
  @Post("deepagents-stream")
  async deepAgentsStream(@Body() body: StreamChatDto, @Res() res: Response) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    try {
      for await (const chunk of this.deepagents.streamChat({
        question: body.question,
        thinking: body.thinking
      })) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write("data: [DONE]\n\n");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // #region agent log
      fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e152f2'},body:JSON.stringify({sessionId:'e152f2',runId:'deepagents-schema-debug',hypothesisId:'H4',location:'backend/src/modules/ai/ai.controller.ts:deepAgentsStream:catch',message:'deepagents stream controller catch',data:{errorMessage:msg.slice(0,300),questionLength:typeof body?.question==='string'?body.question.length:0,thinking:Boolean(body?.thinking)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      res.write(`data: ${JSON.stringify({ event: "error", message: msg })}\n\n`);
    }
    res.end();
  }
}
