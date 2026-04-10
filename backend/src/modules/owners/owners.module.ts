import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { OwnerHouseholdEntity } from "../../entities/owner-household.entity";
import { OwnersController } from "./owners.controller";
import { OwnersService } from "./owners.service";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([OwnerHouseholdEntity])],
  providers: [OwnersService],
  controllers: [OwnersController],
  exports: [OwnersService]
})
export class OwnersModule {}

