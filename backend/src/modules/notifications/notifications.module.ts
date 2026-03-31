import { Global, Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationEntity } from "../../entities/notification.entity";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity])],
  providers: [NotificationsService],
  exports: [NotificationsService]
})
export class NotificationsModule {}
