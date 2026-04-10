import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class AskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  question!: string;

  /** 是否启用推理模型（DeepSeek `deepseek-reasoner`） */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  thinking?: boolean;

  /** 是否把思考过程返回给前端展示（仅在 thinking=true 时有意义） */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  showReasoning?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

