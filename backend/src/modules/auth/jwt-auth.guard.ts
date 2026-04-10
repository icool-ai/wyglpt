import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  // Let Nest handle validation errors; we only keep this hook for explicitness.
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ url?: string; method?: string; headers?: Record<string, string | undefined> }>();
    const auth = req?.headers?.authorization || req?.headers?.Authorization;
    // #region agent log
    fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1cd619'},body:JSON.stringify({sessionId:'1cd619',runId:'ask-401-debug',hypothesisId:'H3',location:'backend/src/modules/auth/jwt-auth.guard.ts:canActivate',message:'jwt guard received request',data:{url:req?.url??'',method:req?.method??'',hasAuthorization:Boolean(auth),bearerPrefix:typeof auth==='string'?auth.startsWith('Bearer '):false},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext
  ): TUser {
    const req = context.switchToHttp().getRequest<{ url?: string; method?: string }>();
    const infoObj = info as { name?: string; message?: string } | undefined;
    const errObj = err as { message?: string } | undefined;
    // #region agent log
    fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1cd619'},body:JSON.stringify({sessionId:'1cd619',runId:'ask-401-debug',hypothesisId:'H8',location:'backend/src/modules/auth/jwt-auth.guard.ts:handleRequest',message:'jwt guard handleRequest result',data:{url:req?.url??'',method:req?.method??'',hasUser:Boolean(user),errMessage:errObj?.message??'',infoName:infoObj?.name??'',infoMessage:infoObj?.message??''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (err || !user) {
      // #region agent log
      console.log("[DEBUG_AUTH_401]", JSON.stringify({ url: req?.url ?? "", method: req?.method ?? "", hasUser: Boolean(user), errMessage: errObj?.message ?? "", infoName: infoObj?.name ?? "", infoMessage: infoObj?.message ?? "" }));
      // #endregion
      throw (err as Error) || new UnauthorizedException(infoObj?.message || "Unauthorized");
    }
    return user;
  }
}

