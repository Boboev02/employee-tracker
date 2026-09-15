import {
  IsString, IsOptional, IsIn, IsArray, IsUUID, IsBoolean,
  IsObject, IsDateString, MinLength, MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const TASK_STATUSES = ['NEW', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE', 'OVERDUE'] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
// Проверяем формат UUID без привязки к версии: сейчас всё v4, но
// жёсткая проверка сломала бы обновление, встреться id другой версии.
export const PARTICIPANT_ROLES = ['co_executor', 'observer', 'reviewer', 'approver'] as const;

/** Форма шлёт '' вместо undefined — приводим, иначе @IsUUID/@IsDateString ругаются. */
const EmptyToUndefined = () =>
  Transform(({ value }) => (value === '' || value === null ? undefined : value));

const Trimmed = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateTaskDto {
  @IsString({ message: 'Название задачи обязательно' })
  @Trimmed()
  @MinLength(1, { message: 'Название задачи не может быть пустым' })
  @MaxLength(500, { message: 'Название задачи слишком длинное' })
  title: string;

  @IsOptional() @IsString() @MaxLength(20000)
  description?: string;

  @IsOptional() @IsIn(TASK_PRIORITIES, { message: 'Недопустимый приоритет' })
  priority?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID(undefined, { message: 'Некорректный исполнитель' })
  assigneeId?: string;

  @IsOptional() @IsArray() @IsUUID(undefined, { each: true, message: 'Некорректный исполнитель' })
  assigneeIds?: string[];

  @IsOptional() @IsArray() @IsUUID(undefined, { each: true })
  coAssigneeIds?: string[];

  @IsOptional() @EmptyToUndefined() @IsUUID()
  teamId?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID(undefined, { message: 'Некорректный отдел' })
  departmentId?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID(undefined, { message: 'Некорректный проект' })
  projectId?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID(undefined, { message: 'Некорректная карточка товара' })
  productId?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID()
  parentId?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID()
  taskTypeId?: string;

  @IsOptional() @EmptyToUndefined()
  @IsDateString({}, { message: 'Некорректная дата дедлайна' })
  dueDate?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value.map((t: any) => String(t).trim()).filter(Boolean) : value)
  tags?: string[];

  @IsOptional() @IsObject()
  customFields?: Record<string, any>;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() @Trimmed() @MinLength(1) @MaxLength(500)
  title?: string;

  @IsOptional() @IsString() @MaxLength(20000)
  description?: string;

  @IsOptional() @IsIn(TASK_PRIORITIES, { message: 'Недопустимый приоритет' })
  priority?: string;

  @IsOptional() @EmptyToUndefined() @IsUUID()
  assigneeId?: string;

  @IsOptional() @IsArray() @IsUUID(undefined, { each: true })
  assigneeIds?: string[];

  @IsOptional() @EmptyToUndefined() @IsDateString({}, { message: 'Некорректная дата дедлайна' })
  dueDate?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];
}

export class MoveTaskDto {
  @IsIn(TASK_STATUSES, { message: 'Недопустимый статус' })
  status: string;
}

export class AddCommentDto {
  @IsString({ message: 'Текст комментария обязателен' })
  @Trimmed()
  @MinLength(1, { message: 'Комментарий не может быть пустым' })
  @MaxLength(10000, { message: 'Комментарий слишком длинный' })
  content: string;
}

export class AddChecklistDto {
  @IsString({ message: 'Текст пункта обязателен' })
  @Trimmed()
  @MinLength(1, { message: 'Пункт не может быть пустым' })
  @MaxLength(500)
  text: string;

  @IsOptional() @EmptyToUndefined() @IsUUID()
  assigneeId?: string;
}

export class UpdateChecklistDto {
  @IsOptional() @IsString() @Trimmed() @MinLength(1) @MaxLength(500)
  text?: string;

  @IsOptional() @IsBoolean()
  isDone?: boolean;

  @IsOptional() @EmptyToUndefined() @IsUUID()
  assigneeId?: string;
}

export class AddParticipantDto {
  @IsUUID(undefined, { message: 'Некорректный пользователь' })
  userId: string;

  @IsIn(PARTICIPANT_ROLES, { message: 'Недопустимая роль участника' })
  role: string;
}
