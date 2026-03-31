import { Module } from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { TicketsController } from "./tickets.controller";
import { ApprovalsModule } from "../approvals/approvals.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TicketEntity } from "../../entities/ticket.entity";
import { UserEntity } from "../../entities/user.entity";

@Module({
  imports: [ApprovalsModule, TypeOrmModule.forFeature([TicketEntity, UserEntity])],
  providers: [TicketsService],
  controllers: [TicketsController],
  exports: [TicketsService]
})
export class TicketsModule {}
