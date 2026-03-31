import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { RolesGuard } from "../../common/security/roles.guard";

@Global()
@Module({
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }]
})
export class AuthzModule {}
