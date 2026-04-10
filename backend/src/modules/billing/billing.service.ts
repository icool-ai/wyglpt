import { InjectRepository } from "@nestjs/typeorm";
import { BadRequestException, Injectable, NotFoundException, StreamableFile } from "@nestjs/common";
import { Repository } from "typeorm";
import * as iconv from "iconv-lite";
import { AuditService } from "../audit/audit.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { BillEntity, BillStatus } from "../../entities/bill.entity";
import { ListBillsQueryDto } from "./dto/list-bills-query.dto";

export type BillDto = {
  id: string;
  type: string;
  owner: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  status: BillStatus;
  pay: string;
  createdAt: string;
};

export type BillListPageResult = {
  items: BillDto[];
  total: number;
  page: number;
  pageSize: number;
};

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(BillEntity)
    private readonly billsRepo: Repository<BillEntity>,
    private readonly approvals: ApprovalsService,
    private readonly audit: AuditService
  ) {}

  async list() {
    const rows = await this.billsRepo.find({ order: { createdAt: "DESC" } });
    return rows.map((x) => this.toDto(x));
  }

  async requestCreate(payload: { type: string; owner: string; periodStart: string; periodEnd: string; amount: number }) {
    return this.approvals.create("billing_create", payload);
  }

  async requestCollect(id: string) {
    await this.mustFind(id);
    return this.approvals.create("billing_collect", { billId: id, op: "collect" });
  }

  async search(query: ListBillsQueryDto): Promise<BillListPageResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const qb = this.billsRepo.createQueryBuilder("b").orderBy("b.createdAt", "DESC");
    if (query.id) qb.andWhere("b.id LIKE :id", { id: `%${query.id}%` });
    if (query.type) qb.andWhere("b.type LIKE :type", { type: `%${query.type}%` });
    if (query.owner) qb.andWhere("b.owner LIKE :owner", { owner: `%${query.owner}%` });
    if (query.periodStart) qb.andWhere("b.periodStart LIKE :periodStart", { periodStart: `%${query.periodStart}%` });
    if (query.periodEnd) qb.andWhere("b.periodEnd LIKE :periodEnd", { periodEnd: `%${query.periodEnd}%` });
    if (query.amountMin != null) qb.andWhere("b.amount >= :min", { min: query.amountMin });
    if (query.amountMax != null) qb.andWhere("b.amount <= :max", { max: query.amountMax });
    if (query.pay) {
      const st = BillingService.payToStatus(query.pay);
      qb.andWhere("b.status = :st", { st });
    }

    qb.skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items: items.map((x) => this.toDto(x)), total, page, pageSize };
  }

  getImportTemplateBuffer(): Buffer {
    const header = "单号,类型,业主/房号,账期开始,账期结束,金额,支付/对账";
    const example =
      "B-8891,物业费,1-1201 张三,2026-03-01,2026-03-31,1280,待支付\r\n" +
      "B-8892,水电费,1-1202 李四,2026-02-01,2026-02-28,216.5,对账中\r\n";
    const body = `\uFEFF${header}\r\n${example}`;
    return Buffer.from(body, "utf8");
  }

  private static csvEscapeCell(cell: string): string {
    if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
    return cell;
  }

  private static normalizeHeaderCell(s: string): string {
    return s
      .replace(/^\uFEFF/, "")
      .replace(/\u200B/g, "")
      .replace(/\u3000/g, " ")
      .replace(/\u00A0/g, " ")
      .trim();
  }

  private static parseDelimitedLine(line: string, delimiter: "," | ";"): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // Excel CSV: doubled quotes inside quoted cell
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (!inQuotes && ch === delimiter) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }

    out.push(cur);
    return out;
  }

  private static decodeBufferToText(buf: Buffer): string {
    // UTF-16 LE with BOM
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.subarray(2).toString("utf16le").replace(/^\uFEFF/, "");
    }

    const utf8 = buf.toString("utf8").replace(/^\uFEFF/, "");
    if (utf8.includes("单号") && utf8.includes("类型")) return utf8;

    try {
      const gbk = iconv.decode(buf, "gbk");
      if (gbk.includes("单号") && gbk.includes("类型")) return gbk;
    } catch {
      /* ignore */
    }

    return utf8;
  }

  private static payToStatus(pay: string): BillStatus {
    const p = (pay ?? "").trim();
    if (p === "已支付") return "paid";
    if (p === "待支付") return "issued";
    if (p === "对账中") return "partially_paid";
    if (p === "逾期") return "overdue";
    return "issued";
  }

  async importAndRequestApproval(buf: Buffer): Promise<{
    id: string;
    created: number;
    skipped: number;
    errors: { line: number; message: string }[];
  }> {
    const parsed = await this.importFromCsv(buf);
    const rows = parsed.rows;
    if (!rows.length) {
      throw new BadRequestException("没有可导入的新增账单（可能是文件为空或全部单号已存在）");
    }
    const approval = await this.requestBatchCreate(rows);
    return { id: approval.id, created: parsed.created, skipped: parsed.skipped, errors: parsed.errors };
  }

  importEmptyToApprovalError(): never {
    throw new BadRequestException("请上传 CSV 文件（字段名 file）");
  }

  private async importFromCsv(buf: Buffer): Promise<{
    rows: {
      id: string;
      type: string;
      owner: string;
      periodStart: string;
      periodEnd: string;
      amount: number;
      status: BillStatus;
    }[];
    created: number;
    skipped: number;
    errors: { line: number; message: string }[];
  }> {
    const text = BillingService.decodeBufferToText(buf);
    let rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    // 兼容 Excel 可能带的 sep=; 行
    while (rawLines.length && /^sep\s*=/i.test(rawLines[0].trim())) rawLines = rawLines.slice(1);

    if (rawLines.length < 2) throw new BadRequestException("文件为空或仅有表头");

    const headerLine = rawLines[0];
    const expected = ["单号", "类型", "业主/房号", "账期开始", "账期结束", "金额", "支付/对账"].map((h) =>
      BillingService.normalizeHeaderCell(h),
    );

    let delim: "," | ";" = ",";
    let headerParts = BillingService.parseDelimitedLine(headerLine, delim);
    let norm = headerParts.map((h) => BillingService.normalizeHeaderCell(h));
    if (norm.length < 7) {
      delim = ";";
      headerParts = BillingService.parseDelimitedLine(headerLine, delim);
      norm = headerParts.map((h) => BillingService.normalizeHeaderCell(h));
    }
    const headerOk = norm.slice(0, 7).length === 7 && expected.every((e, i) => norm[i] === e);
    if (!headerOk) {
      throw new BadRequestException(
        `表头与模板不一致。需前 7 列依次为：单号、类型、业主/房号、账期开始、账期结束、金额、支付/对账。当前解析首行为：${norm
          .slice(0, 10)
          .join(" | ") || "(空)"}`,
      );
    }

    const rows: {
      id: string;
      type: string;
      owner: string;
      periodStart: string;
      periodEnd: string;
      amount: number;
      status: BillStatus;
    }[] = [];
    let created = 0;
    let skipped = 0;
    const errors: { line: number; message: string }[] = [];

    for (let i = 1; i < rawLines.length; i++) {
      const lineNo = i + 1;
      const cols = BillingService.parseDelimitedLine(rawLines[i], delim).map((c) => c.trim());
      while (cols.length < 7) cols.push("");
      const [id, type, owner, periodStart, periodEnd, amountStr, payStr] = cols;

      if (
        ![id, type, owner, periodStart, periodEnd, amountStr, payStr].some((x) => String(x ?? "").trim().length > 0)
      )
        continue;

      const amount = Number(amountStr);
      const status = BillingService.payToStatus(payStr);

      if (!id || !type || !owner || !periodStart || !periodEnd || Number.isNaN(amount)) {
        errors.push({ line: lineNo, message: "单号/类型/业主/账期开始/账期结束/金额为必填，且金额需为数字" });
        continue;
      }

      const exist = await this.billsRepo.findOne({ where: { id } });
      if (exist) {
        skipped++;
        continue;
      }

      rows.push({ id, type, owner, periodStart, periodEnd, amount, status });
      created++;
    }

    return { rows, created, skipped, errors };
  }

  async requestBatchCreate(
    rows: { id: string; type: string; owner: string; periodStart: string; periodEnd: string; amount: number; status: BillStatus }[],
  ) {
    const approval = await this.approvals.create("billing_batch_create", { rows });
    return { id: approval.id };
  }

  async getExportCsvBuffer(): Promise<Buffer> {
    const rows = await this.billsRepo.find({ order: { createdAt: "DESC" } });
    const header = "单号,类型,业主/房号,账期开始,账期结束,金额,支付/对账";
    const lines = rows.map((row) => {
      const pay = this.payFromStatus(row.status);
      return [
        row.id,
        row.type ?? "",
        row.owner ?? "",
        row.periodStart ?? "",
        row.periodEnd ?? "",
        String(row.amount),
        pay,
      ]
        .map((cell) => BillingService.csvEscapeCell(String(cell ?? "")))
        .join(",");
    });
    const body = `\uFEFF${header}\r\n${lines.join("\r\n")}${lines.length ? "\r\n" : ""}`;
    return Buffer.from(body, "utf8");
  }

  async getExportCsvStreamableFile(): Promise<StreamableFile> {
    const buf = await this.getExportCsvBuffer();
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return new StreamableFile(buf, {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="billing_export_${stamp}.csv"`,
    });
  }

  async executeApproved(actionType: string, payload: Record<string, unknown>) {
    if (actionType === "billing_create") {
      const id = `bill_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
      const row = await this.billsRepo.save({
        id,
        type: String(payload.type || ""),
        owner: String(payload.owner ?? payload.customerName ?? ""),
        periodStart: String((payload as any).periodStart || payload.period || ""),
        periodEnd: String((payload as any).periodEnd || ""),
        amount: Number(payload.amount || 0),
        status: "issued",
        createdAt: new Date()
      });

      await this.audit.recordStrictAudit({
        actor: "approver",
        action: "billing_create",
        entityType: "bill",
        entityId: row.id,
        diff: { id: row.id, status: row.status }
      });
      return this.toDto(row);
    }

    if (actionType === "billing_batch_create") {
      const candidate = payload as {
        rows?: Array<{
          id: string;
          type: string;
          owner: string;
          periodStart: string;
          periodEnd: string;
          amount: number;
          status: BillStatus;
        }>;
      };
      const inputRows = Array.isArray(candidate?.rows) ? candidate.rows : [];
      let created = 0;
      let skipped = 0;
      const errors: { id: string; message: string }[] = [];

      for (const r of inputRows) {
        if (!r?.id) continue;
        const exist = await this.billsRepo.findOne({ where: { id: r.id } });
        if (exist) {
          skipped++;
          continue;
        }
        try {
          const saved = await this.billsRepo.save({
            id: r.id,
            type: r.type ?? "",
            owner: r.owner ?? "",
            periodStart: r.periodStart ?? "",
            periodEnd: r.periodEnd ?? "",
            amount: Number(r.amount ?? 0),
            status: r.status ?? "issued",
            createdAt: new Date(),
          });
          await this.audit.recordStrictAudit({
            actor: "approver",
            action: "billing_batch_create",
            entityType: "bill",
            entityId: saved.id,
            diff: { id: saved.id, status: saved.status },
          });
          created++;
        } catch (e: unknown) {
          errors.push({ id: r.id, message: e instanceof Error ? e.message : "保存失败" });
        }
      }

      return { created, skipped, errors };
    }

    if (actionType === "billing_collect") {
      const bill = await this.mustFind(String(payload.billId));
      bill.status = "paid";
      const saved = await this.billsRepo.save(bill);
      return this.toDto(saved);
    }

    return null;
  }

  private async mustFind(id: string) {
    const bill = await this.billsRepo.findOne({ where: { id } });
    if (!bill) throw new NotFoundException("Bill not found");
    return bill;
  }

  private toDto(row: BillEntity): BillDto {
    return {
      id: row.id,
      type: row.type ?? "",
      owner: row.owner ?? "",
      periodStart: row.periodStart ?? "",
      periodEnd: row.periodEnd ?? "",
      amount: Number(row.amount),
      status: row.status,
      pay: this.payFromStatus(row.status),
      createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt)
    };
  }

  private payFromStatus(status: BillStatus): string {
    if (status === "paid") return "已支付";
    if (status === "issued") return "待支付";
    if (status === "partially_paid") return "对账中";
    if (status === "overdue") return "逾期";
    return "待支付";
  }
}
