import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { TicketsModule } from "./tickets/tickets.module";
import { AiModule } from "./ai/ai.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { AuditModule } from "./audit/audit.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OwnersModule } from "./owners/owners.module";

const dbType = process.env.DB_TYPE || "mysql";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: dbType,
      host: dbType === "mysql" ? process.env.DB_HOST || "localhost" : undefined,
      port: dbType === "mysql" ? Number(process.env.MYSQL_PORT || 3306) : undefined,
      username: dbType === "mysql" ? process.env.MYSQL_USER || "property" : undefined,
      password: dbType === "mysql" ? process.env.MYSQL_PASSWORD || "property123" : undefined,
      // SQLite local run (dev/demo)：不依赖 MySQL 凭据也能启动
      database:
        dbType === "sqlite"
          ? process.env.SQLITE_PATH || "property_mgmt.sqlite"
          : dbType === "mysql"
            ? process.env.MYSQL_DATABASE || "property_mgmt"
            : undefined,
      autoLoadEntities: true,
      synchronize: process.env.TYPEORM_SYNC === "true"
    } as any),
    AuthModule,
    TicketsModule,
    BillingModule,
    DashboardModule,
    AiModule,
    ApprovalsModule,
    AuditModule,
    NotificationsModule,
    OwnersModule
  ]
})
export class AppModule {}
