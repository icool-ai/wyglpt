import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { ListBillsQueryDto } from "./dto/list-bills-query.dto";

@Controller("billing")
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("bills")
  async list() {
    return this.billing.list();
  }

  @Post("bills")
  async create(@Body() body: { type: string; owner: string; periodStart: string; periodEnd: string; amount: number }) {
    return this.billing.requestCreate(body);
  }

  @Get("bills/query")
  async query(@Query() query: ListBillsQueryDto) {
    return this.billing.search(query);
  }

  @Get("bills/import-template")
  importTemplate(): StreamableFile {
    const buf = this.billing.getImportTemplateBuffer();
    return new StreamableFile(buf, {
      type: "text/csv; charset=utf-8",
      disposition: 'attachment; filename="billing_import_template.csv"',
    });
  }

  @Get("bills/export")
  async exportCsv(): Promise<StreamableFile> {
    return await this.billing.getExportCsvStreamableFile();
  }

  @Post("bills/import")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async importCsv(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) {
      return this.billing.importEmptyToApprovalError();
    }
    return this.billing.importAndRequestApproval(file.buffer);
  }

  @Patch("bills/:id/collect")
  async collect(@Param("id") id: string) {
    return this.billing.requestCollect(id);
  }
}
