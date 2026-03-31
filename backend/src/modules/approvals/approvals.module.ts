import { Module } from "@nestjs/common";
import { ApprovalsService } from "./approvals.service";
import { ApprovalsController } from "./approvals.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApprovalRequestEntity } from "../../entities/approval-request.entity";

@Module({
  imports: [TypeOrmModule.forFeature([ApprovalRequestEntity])],
  providers: [ApprovalsService],
  controllers: [ApprovalsController],
  exports: [ApprovalsService]
})
export class ApprovalsModule {}
