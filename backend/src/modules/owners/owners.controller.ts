import {

  BadRequestException,

  Body,

  Controller,

  Delete,

  Get,

  Param,

  Patch,

  Post,

  Query,

  StreamableFile,

  UploadedFile,

  UseGuards,

  UseInterceptors

} from "@nestjs/common";

import { FileInterceptor } from "@nestjs/platform-express";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";

import { CreateOwnerHouseholdDto } from "./dto/create-owner-household.dto";

import { ListOwnersQueryDto } from "./dto/list-owners-query.dto";

import { UpdateOwnerHouseholdDto } from "./dto/update-owner-household.dto";

import { OwnersService } from "./owners.service";



@Controller("owners")

@UseGuards(JwtAuthGuard)

export class OwnersController {

  constructor(private readonly owners: OwnersService) {}



  @Get()

  list(@Query() query: ListOwnersQueryDto) {

    return this.owners.list(query);

  }



  @Get("import-template")

  downloadTemplate(): StreamableFile {

    const buf = this.owners.getImportTemplateBuffer();

    return new StreamableFile(buf, {

      type: "text/csv; charset=utf-8",

      disposition: 'attachment; filename="owner_import_template.csv"'

    });

  }



  @Get("export")

  async exportCsv(): Promise<StreamableFile> {

    const buf = await this.owners.getExportCsvBuffer();

    return new StreamableFile(buf, {

      type: "text/csv; charset=utf-8",

      disposition: 'attachment; filename="owners_export.csv"'

    });

  }



  @Post()

  create(@Body() body: CreateOwnerHouseholdDto) {

    return this.owners.create(body);

  }



  @Post("import")

  @UseInterceptors(

    FileInterceptor("file", {

      limits: { fileSize: 5 * 1024 * 1024 }

    })

  )

  importCsv(@UploadedFile() file: Express.Multer.File | undefined) {

    if (!file?.buffer?.length) {

      throw new BadRequestException("请上传 CSV 文件（字段名 file）");

    }

    return this.owners.importFromCsv(file.buffer);

  }



  @Patch(":id")

  update(@Param("id") id: string, @Body() body: UpdateOwnerHouseholdDto) {

    return this.owners.update(id, body);

  }



  @Delete(":id")

  remove(@Param("id") id: string) {

    return this.owners.remove(id);

  }

}

