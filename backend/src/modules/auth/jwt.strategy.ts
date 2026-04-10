import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

type JwtPayload = {
  sub: number;
  username: string;
  roleCode: string;
  iat?: number;
  exp?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "change_me"
    });
  }

  async validate(payload: JwtPayload) {
    // #region agent log
    fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1cd619'},body:JSON.stringify({sessionId:'1cd619',runId:'ask-401-debug',hypothesisId:'H4',location:'backend/src/modules/auth/jwt.strategy.ts:validate',message:'jwt payload validated',data:{hasSub:Boolean(payload?.sub),hasUsername:Boolean(payload?.username),hasRoleCode:Boolean(payload?.roleCode)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return {
      userId: payload.sub,
      username: payload.username,
      roleCode: payload.roleCode
    };
  }
}

