import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";

import * as iconv from "iconv-lite";

import { Repository } from "typeorm";

import { OwnerHouseholdEntity } from "../../entities/owner-household.entity";

import { CreateOwnerHouseholdDto } from "./dto/create-owner-household.dto";

import { ListOwnersQueryDto } from "./dto/list-owners-query.dto";

import { UpdateOwnerHouseholdDto } from "./dto/update-owner-household.dto";



export type OwnerHouseholdDto = {

  id: string;

  room: string;

  name: string;

  memberCount: number;

  phone: string;

  tags: string[];

  createdAt: string;

};



export type OwnerListPageResult = {

  items: OwnerHouseholdDto[];

  total: number;

  page: number;

  pageSize: number;

};



@Injectable()

export class OwnersService implements OnModuleInit {

  constructor(

    @InjectRepository(OwnerHouseholdEntity)

    private readonly repo: Repository<OwnerHouseholdEntity>

  ) {}



  async onModuleInit() {

    const n = await this.repo.count();

    if (n > 0) return;

    const now = new Date();

    await this.repo.save([

      {

        id: "oh_demo_1",

        room: "1-1201",

        ownerName: "张三",

        memberCount: 3,

        phone: "13800112001",

        tags: JSON.stringify(["自住", "已认证"]),

        createdAt: now

      },

      {

        id: "oh_demo_2",

        room: "1-1202",

        ownerName: "李四",

        memberCount: 2,

        phone: "13900888992",

        tags: JSON.stringify(["出租"]),

        createdAt: now

      },

      {

        id: "oh_demo_3",

        room: "2-0803",

        ownerName: "王五",

        memberCount: 4,

        phone: "13600212108",

        tags: JSON.stringify(["自住", "车位"]),

        createdAt: now

      }

    ]);

  }



  async list(query: ListOwnersQueryDto): Promise<OwnerListPageResult> {

    const page = query.page ?? 1;

    const pageSize = query.pageSize ?? 10;

    const q = (query.q ?? "").trim();

    const qb = this.repo

      .createQueryBuilder("o")

      .orderBy("o.room", "ASC");

    if (q.length > 0) {

      const like = `%${q}%`;

      qb.andWhere(

        "(o.room LIKE :like OR o.ownerName LIKE :like OR o.phone LIKE :like OR o.tags LIKE :like)",

        { like }

      );

    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [rows, total] = await qb.getManyAndCount();

    return {

      items: rows.map((r) => this.toDto(r)),

      total,

      page,

      pageSize

    };

  }



  async create(dto: CreateOwnerHouseholdDto): Promise<OwnerHouseholdDto> {

    const exist = await this.repo.findOne({ where: { room: dto.room.trim() } });

    if (exist) throw new BadRequestException("该房号已存在");



    const row = await this.repo.save({

      id: `oh_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,

      room: dto.room.trim(),

      ownerName: dto.ownerName.trim(),

      memberCount: dto.memberCount,

      phone: dto.phone.trim(),

      tags: dto.tags?.trim() ? JSON.stringify(this.parseTagsInput(dto.tags)) : JSON.stringify([]),

      createdAt: new Date()

    });

    return this.toDto(row);

  }



  async update(id: string, dto: UpdateOwnerHouseholdDto): Promise<OwnerHouseholdDto> {

    const row = await this.repo.findOne({ where: { id } });

    if (!row) throw new NotFoundException("记录不存在");



    const has =

      dto.room !== undefined ||

      dto.ownerName !== undefined ||

      dto.memberCount !== undefined ||

      dto.phone !== undefined ||

      dto.tags !== undefined;

    if (!has) throw new BadRequestException("请至少修改一项");



    if (dto.room !== undefined) {

      const nextRoom = dto.room.trim();

      const other = await this.repo.findOne({ where: { room: nextRoom } });

      if (other && other.id !== id) throw new BadRequestException("该房号已存在");

      row.room = nextRoom;

    }

    if (dto.ownerName !== undefined) row.ownerName = dto.ownerName.trim();

    if (dto.memberCount !== undefined) row.memberCount = dto.memberCount;

    if (dto.phone !== undefined) row.phone = dto.phone.trim();

    if (dto.tags !== undefined) {

      row.tags = dto.tags.trim()

        ? JSON.stringify(this.parseTagsInput(dto.tags))

        : JSON.stringify([]);

    }



    await this.repo.save(row);

    return this.toDto(row);

  }



  async remove(id: string): Promise<{ ok: true }> {

    const r = await this.repo.delete({ id });

    if (!r.affected) throw new NotFoundException("记录不存在");

    return { ok: true };

  }



  /** UTF-8 BOM + CSV，便于 Excel 打开中文列 */

  getImportTemplateBuffer(): Buffer {

    const header = "房号,业主姓名,在住成员数,联系电话,标签";

    const example =

      "1-1201,张三,3,13800138000,自住;已认证\r\n" +

      "2-0802,李四,2,13900000000,出租\r\n";

    const body = `\uFEFF${header}\r\n${example}`;

    return Buffer.from(body, "utf8");

  }



  /** 导出当前库中全部业主户，列与导入模板一致，便于核对或编辑后再导入 */

  async getExportCsvBuffer(): Promise<Buffer> {

    const rows = await this.repo.find({ order: { room: "ASC" } });

    const header = "房号,业主姓名,在住成员数,联系电话,标签";

    const lines = rows.map((row) => {

      const dto = this.toDto(row);

      const tagCol = dto.tags.length ? dto.tags.join(";") : "";

      return [dto.room, dto.name, String(dto.memberCount), dto.phone, tagCol]

        .map((cell) => OwnersService.csvEscapeCell(cell))

        .join(",");

    });

    const body = `\uFEFF${header}\r\n${lines.join("\r\n")}${lines.length ? "\r\n" : ""}`;

    return Buffer.from(body, "utf8");

  }



  /** 批量导入 CSV（列与模板/导出一致）；房号已存在则跳过 */

  async importFromCsv(buf: Buffer): Promise<{

    created: number;

    skipped: number;

    errors: { line: number; message: string }[];

  }> {

    const text = OwnersService.decodeBufferToText(buf);

    let rawLines = text.split(/\r?\n/);

    let lines = rawLines.filter((L) => L.trim().length > 0);

    while (lines.length && /^sep\s*=/i.test(lines[0].trim())) {

      lines = lines.slice(1);

    }

    if (lines.length < 2) throw new BadRequestException("文件为空或仅有表头");



    let delim: "," | ";" = ",";

    let headerParts = OwnersService.parseDelimitedLine(lines[0], delim);

    if (headerParts.filter((h) => OwnersService.normalizeHeaderCell(h).length > 0).length < 5) {

      const semi = OwnersService.parseDelimitedLine(lines[0], ";");

      if (semi.length >= 5) {

        delim = ";";

        headerParts = semi;

      }

    }

    const header = headerParts.map((h) => OwnersService.normalizeHeaderCell(h));

    const expected = ["房号", "业主姓名", "在住成员数", "联系电话", "标签"].map((h) =>

      OwnersService.normalizeHeaderCell(h)

    );

    const header5 = header.slice(0, 5);

    const headerOk = header5.length === 5 && expected.every((e, i) => header5[i] === e);

    if (!headerOk) {

      const preview = headerParts.slice(0, 8).join(" | ");

      throw new BadRequestException(

        `表头与模板不一致。需前 5 列依次为：房号、业主姓名、在住成员数、联系电话、标签。当前解析首行为：${preview || "(空)"}。请用 UTF-8 保存，或直接使用本站「下载导入模板」。`

      );

    }



    let created = 0;

    let skipped = 0;

    const errors: { line: number; message: string }[] = [];



    for (let i = 1; i < lines.length; i++) {

      const lineNo = i + 1;

      const cols = OwnersService.parseDelimitedLine(lines[i], delim).map((c) => c.trim());

      while (cols.length < 5) cols.push("");

      const [room, ownerName, mcStr, phone, tagsRaw] = cols;

      if (!room && !ownerName && !mcStr && !phone && !tagsRaw) continue;

      const memberCount = parseInt(mcStr, 10);

      if (!room || !ownerName || Number.isNaN(memberCount) || memberCount < 1 || !phone) {

        errors.push({ line: lineNo, message: "房号、业主姓名、在住成员数（正整数）、联系电话为必填" });

        continue;

      }

      if (phone.length < 5 || phone.length > 32) {

        errors.push({ line: lineNo, message: "联系电话长度需在 5～32 位" });

        continue;

      }

      const exist = await this.repo.findOne({ where: { room } });

      if (exist) {

        skipped++;

        continue;

      }

      try {

        await this.create({

          room,

          ownerName,

          memberCount,

          phone,

          tags: tagsRaw || undefined

        });

        created++;

      } catch (e: unknown) {

        errors.push({

          line: lineNo,

          message: e instanceof Error ? e.message : "保存失败"

        });

      }

    }



    return { created, skipped, errors };

  }



  /** 去掉 Excel/复制粘贴带来的不可见字符，便于表头严格匹配 */

  private static normalizeHeaderCell(s: string): string {

    return s

      .replace(/^\uFEFF/, "")

      .replace(/\u200B/g, "")

      .replace(/\u3000/g, " ")

      .replace(/\u00A0/g, " ")

      .trim();

  }



  /** UTF-8 / UTF-16 LE / GBK（简体中文 Windows 另存 CSV 常为 ANSI） */

  private static decodeBufferToText(buf: Buffer): string {

    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {

      return buf.subarray(2).toString("utf16le").replace(/^\uFEFF/, "");

    }

    const utf8 = buf.toString("utf8").replace(/^\uFEFF/, "");

    if (utf8.includes("房号") && utf8.includes("业主姓名")) {

      return utf8;

    }

    try {

      const gbk = iconv.decode(buf, "gbk");

      if (gbk.includes("房号") && gbk.includes("业主姓名")) {

        return gbk;

      }

    } catch {

      /* ignore */

    }

    return utf8;

  }



  /** 解析单行分隔文本（逗号或分号；支持引号与 "" 转义） */

  private static parseDelimitedLine(line: string, delim: "," | ";"): string[] {

    const out: string[] = [];

    let cur = "";

    let inQ = false;

    const D = delim;

    for (let i = 0; i < line.length; i++) {

      const c = line[i];

      if (inQ) {

        if (c === '"') {

          if (line[i + 1] === '"') {

            cur += '"';

            i++;

          } else {

            inQ = false;

          }

        } else {

          cur += c;

        }

      } else {

        if (c === '"') inQ = true;

        else if (c === D) {

          out.push(cur);

          cur = "";

        } else cur += c;

      }

    }

    out.push(cur);

    return out;

  }



  /** @deprecated 使用 parseDelimitedLine(line, ',') */

  private static parseCsvLine(line: string): string[] {

    return OwnersService.parseDelimitedLine(line, ",");

  }



  private static csvEscapeCell(cell: string): string {

    if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;

    return cell;

  }



  private parseTagsInput(raw: string): string[] {

    return raw

      .split(/[,;，；]/)

      .map((s) => s.trim())

      .filter(Boolean);

  }



  private parseTagsStored(json: string | null): string[] {

    if (!json?.trim()) return [];

    try {

      const v = JSON.parse(json) as unknown;

      if (Array.isArray(v)) return v.map(String);

    } catch {

      /* fallthrough */

    }

    return this.parseTagsInput(json);

  }



  private toDto(row: OwnerHouseholdEntity): OwnerHouseholdDto {

    return {

      id: row.id,

      room: row.room,

      name: row.ownerName,

      memberCount: row.memberCount,

      phone: row.phone,

      tags: this.parseTagsStored(row.tags),

      createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt)

    };

  }

}

