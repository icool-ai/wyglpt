import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";



/** 至少传一项；未传的字段保持原值 */



export class UpdateOwnerHouseholdDto {

  @IsOptional()

  @IsString()

  @MinLength(1)

  @MaxLength(32)

  room?: string;



  @IsOptional()

  @IsString()

  @MinLength(1)

  @MaxLength(128)

  ownerName?: string;



  @IsOptional()

  @IsInt()

  @Min(1)

  memberCount?: number;



  @IsOptional()

  @IsString()

  @MinLength(5)

  @MaxLength(32)

  phone?: string;



  @IsOptional()

  @IsString()

  @MaxLength(512)

  tags?: string;

}

