import {
  IsString, IsOptional, IsIn, IsArray, IsUUID,
  IsDateString, MinLength, MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Форма шлёт '' вместо undefined — приводим, иначе @IsUUID/@IsDateString ругаются. */
const EmptyToUndefined = () =>
  Transform(({ value }) => (value === '' || value === null ? undefined : value));

const Trimmed = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// Значения сверены со schema.prisma (комментарий у Project.status) и фронтендом.
export const PROJECT_STATUSES = ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'ARCHIVED'] as const;

export class CreateProjectDto {
  @IsString({ message: 'Название проекта обязательно' })
  @Trimmed() @MinLength(1, { message: 'Название не может быть пустым' }) @MaxLength(300)
  name: string;

  @IsOptional() @IsString() @MaxLength(20000) description?: string;
  @IsOptional() @IsString() @MaxLength(32)    color?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID(undefined, { message: 'Некорректный отдел' })
  departmentId?: string;

  @IsOptional() @EmptyToUndefined() @IsDateString({}, { message: 'Некорректная дата начала' })
  startDate?: string;

  @IsOptional() @EmptyToUndefined() @IsDateString({}, { message: 'Некорректная дата завершения' })
  dueDate?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @Trimmed() @MinLength(1) @MaxLength(300) name?: string;
  @IsOptional() @IsString() @MaxLength(20000) description?: string;
  @IsOptional() @IsString() @MaxLength(32)    color?: string;

  @IsOptional() @IsIn(PROJECT_STATUSES, { message: 'Недопустимый статус проекта' })
  status?: string;

  @IsOptional() @EmptyToUndefined() @IsDateString() startDate?: string;
  @IsOptional() @EmptyToUndefined() @IsDateString() dueDate?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class AddProjectMemberDto {
  @IsUUID(undefined, { message: 'Некорректный пользователь' })
  userId: string;

  @IsOptional() @IsString() @Trimmed() @MaxLength(60)
  role?: string;
}

export class AddProjectCommentDto {
  @IsString({ message: 'Текст комментария обязателен' })
  @Trimmed() @MinLength(1, { message: 'Комментарий не может быть пустым' }) @MaxLength(10000)
  content: string;
}
