import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogEntity } from "../../entities/audit-log.entity";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditService],
  exports: [AuditService]
})
export class AuditModule {}
