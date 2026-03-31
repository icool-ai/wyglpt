import { ApprovalsService } from "../src/modules/approvals/approvals.service";
import { AuditService } from "../src/modules/audit/audit.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";
import { BillingService } from "../src/modules/billing/billing.service";
import { AiService } from "../src/modules/ai/ai.service";

describe("MVP workflow", () => {
  it("should enforce approval gate for ticket assign", async () => {
    const approvalsStorage: any[] = [];
    const approvalsRepo = {
      save: async (row: any) => {
        approvalsStorage.unshift(row);
        return row;
      },
      find: async () => approvalsStorage,
      findOne: async ({ where }: any) => approvalsStorage.find((x) => x.id === where.id) ?? null
    } as any;

    const auditRepo = { save: async (_row: any) => _row } as any;
    const notificationsRepo = { save: async (_row: any) => _row } as any;

    const ticketsStorage: any[] = [];
    const ticketsRepo = {
      save: async (row: any) => {
        ticketsStorage.unshift(row);
        return row;
      },
      find: async () => ticketsStorage,
      findOne: async ({ where }: any) => ticketsStorage.find((x) => x.id === where.id) ?? null
    } as any;

    const usersRepo = { findOne: async () => null } as any;

    const billsRepo = {
      save: async (row: any) => row,
      find: async () => [],
      findOne: async () => null
    } as any;

    const approvals = new ApprovalsService(approvalsRepo);
    const audit = new AuditService(auditRepo);
    const notifications = new NotificationsService(notificationsRepo);
    const tickets = new TicketsService(ticketsRepo, usersRepo, approvals, audit, notifications);
    const billing = new BillingService(billsRepo, approvals, audit);

    const llmStub = { chatCompletion: async () => "{}" } as any;
    const ai = new AiService(approvals, tickets, billing, audit, llmStub);

    const t = await tickets.create({ title: "漏水", description: "卫生间漏水" });
    const candidate = {
      actionType: "ticket_assign" as const,
      reason: "测试：工单分派建议",
      payload: { ticketId: t.id, assignee: "机电班组A" },
      requiresApproval: true
    };
    const request = await ai.requestExecution(candidate);
    expect(request.status).toBe("pending");
  });

  it("should execute approved billing action and produce diff", async () => {
    const approvalsStorage: any[] = [];
    const approvalsRepo = {
      save: async (row: any) => {
        approvalsStorage.unshift(row);
        return row;
      },
      find: async () => approvalsStorage,
      findOne: async ({ where }: any) => approvalsStorage.find((x) => x.id === where.id) ?? null
    } as any;

    const auditRepo = { save: async (_row: any) => _row } as any;
    const notificationsRepo = { save: async (_row: any) => _row } as any;

    const ticketsRepo = {
      save: async (row: any) => row,
      find: async () => [],
      findOne: async () => null
    } as any;

    const usersRepo = { findOne: async () => null } as any;

    const billsStorage: any[] = [];
    const billsRepo = {
      save: async (row: any) => {
        billsStorage.unshift(row);
        return row;
      },
      find: async () => billsStorage,
      findOne: async ({ where }: any) => billsStorage.find((x) => x.id === where.id) ?? null
    } as any;

    const approvals = new ApprovalsService(approvalsRepo);
    const audit = new AuditService(auditRepo);
    const notifications = new NotificationsService(notificationsRepo);
    const tickets = new TicketsService(ticketsRepo, usersRepo, approvals, audit, notifications);
    const billing = new BillingService(billsRepo, approvals, audit);

    const llmStub = { chatCompletion: async () => "{}" } as any;
    const ai = new AiService(approvals, tickets, billing, audit, llmStub);

    const request = await billing.requestCreate({ customerName: "A座101", amount: 1280 });
    await approvals.decide(request.id, "approved");
    const result = (await ai.executeApproved(request.id)) as { status: string };
    expect(result.status).toBe("issued");
  });
});
