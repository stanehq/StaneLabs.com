import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export const CONTACT_TOPICS = ['Consulta inicial', 'Ciberseguridad', 'Seguridad operativa', 'Datos sensibles'] as const;

export class ContactDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[^\r\n\x00]+$/)
  name!: string;

  @Transform(trim)
  @IsEmail()
  @MaxLength(180)
  @Matches(/^[^\r\n\x00]+$/)
  email!: string;

  @Transform(trim)
  @IsString()
  @IsIn(CONTACT_TOPICS)
  topic!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  website?: string;
}
