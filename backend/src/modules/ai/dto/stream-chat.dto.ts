import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

class ChatHistoryItemDto {
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  content!: string;
}

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

  /** 近几轮上下文（按时间正序），不含当前 question */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[];
}
