import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./modules/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
