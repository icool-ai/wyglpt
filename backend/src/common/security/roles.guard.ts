import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = req.headers["x-role"];
    return typeof role === "string" && ["admin", "finance", "customer_service"].includes(role);
  }
}
