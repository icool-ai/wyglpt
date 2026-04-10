import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./modules/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const auth = req.headers?.authorization;
    // #region agent log
    fetch('http://127.0.0.1:7440/ingest/32c6740f-0b28-44ac-9021-1be15ccf10a9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1cd619'},body:JSON.stringify({sessionId:'1cd619',runId:'ask-401-debug',hypothesisId:'H6',location:'backend/src/main.ts:app.use',message:'backend request entry',data:{url:req.url,method:req.method,hasAuthorization:Boolean(auth),bearerPrefix:typeof auth==='string'?auth.startsWith('Bearer '):false},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const fromEnv = process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  const corsOrigins =
    fromEnv && fromEnv.length > 0
      ? fromEnv
      : [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          /^https?:\/\/localhost(?::\d+)?$/,
          /^https?:\/\/127\.0\.0\.1(?::\d+)?$/
        ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"]
  });

  const config = new DocumentBuilder()
    .setTitle("Property Smart Platform API")
    .setDescription("MVP API with approval gates and strict auditing")
    .setVersion("0.1.0")
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, doc);

  await app.listen(process.env.BACKEND_PORT || 3001);
}

void bootstrap();
