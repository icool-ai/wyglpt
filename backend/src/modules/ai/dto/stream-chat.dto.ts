import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { Type } from "class-transformer";

export class StreamChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  question!: string;

  /** 使用 deepseek-reasoner，可流式输出 reasoning_content + content */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  thinking?: boolean;
}
