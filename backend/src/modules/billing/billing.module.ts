import { Module } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { ApprovalsModule } from "../approvals/approvals.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BillEntity } from "../../entities/bill.entity";

@Module({
  imports: [ApprovalsModule, TypeOrmModule.forFeature([BillEntity])],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService]
})
export class BillingModule {}
