import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";



export class CreateOwnerHouseholdDto {

  @IsString()

  @MinLength(1)

  @MaxLength(32)

  room!: string;



  @IsString()

  @MinLength(1)

  @MaxLength(128)

  ownerName!: string;



  @IsInt()

  @Min(1)

  memberCount!: number;



  @IsString()

  @MinLength(5)

  @MaxLength(32)

  phone!: string;



  /** 可选：多个标签用英文逗号或分号分隔，如「自住,已认证」 */

  @IsOptional()

  @IsString()

  @MaxLength(512)

  tags?: string;

}

