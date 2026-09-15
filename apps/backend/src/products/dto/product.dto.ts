import {
  IsString, IsOptional, IsIn, IsArray, IsUUID, IsDefined,
  IsDateString, MinLength, MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Форма шлёт '' вместо undefined — приводим, иначе @IsUUID/@IsDateString ругаются. */
const EmptyToUndefined = () =>
  Transform(({ value }) => (value === '' || value === null ? undefined : value));

const Trimmed = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export const MARKETPLACES = ['WB', 'OZON'] as const;

export class CreateProductDto {
  @IsString({ message: 'Название товара обязательно' })
  @Trimmed() @MinLength(1, { message: 'Название не может быть пустым' }) @MaxLength(500)
  name: string;

  @IsOptional() @IsString() @Trimmed() @MaxLength(120)
  articleId?: string;

  @IsOptional() @IsIn(MARKETPLACES, { message: 'Маркетплейс: WB или OZON' })
  marketplace?: string;

  @IsOptional() @IsString() @Trimmed() @MaxLength(200)  brand?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(200)  model?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(300)  categoryName?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(60)   tnved?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(60)   okpd?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(300)  declaration?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(120)  gtdNumber?: string;
  @IsOptional() @IsString() @MaxLength(2000)            gtdUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000)            url?: string;
  @IsOptional() @IsString() @MaxLength(2000)            ozonUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000)            photoUrl?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(60)   status?: string;
}

/** Поля из allowed-списка updateProduct — все, что разрешено менять. */
export class UpdateProductDto {
  @IsOptional() @IsString() @Trimmed() @MinLength(1) @MaxLength(500) name?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(120)  articleId?: string;
  @IsOptional() @IsIn(MARKETPLACES)                     marketplace?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(200)  brand?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(200)  model?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(300)  categoryName?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(60)   tnved?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(60)   okpd?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(300)  declaration?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(120)  gtdNumber?: string;
  @IsOptional() @IsString() @MaxLength(2000)            gtdUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000)            url?: string;
  @IsOptional() @IsString() @MaxLength(2000)            ozonUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000)            photoUrl?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(60)   status?: string;
  @IsOptional() @IsString() @Trimmed() @MaxLength(120)  barcode?: string;
  @IsOptional() @IsString() @MaxLength(20000)           descriptionWb?: string;
  @IsOptional() @IsString() @MaxLength(20000)           descriptionOzon?: string;
  @IsOptional() @IsString() @MaxLength(20000)           notes?: string;
  @IsOptional() @EmptyToUndefined() @IsUUID()           stageId?: string;
}

export class SetProductFieldDto {
  @IsUUID(undefined, { message: 'Некорректное поле' })
  fieldId: string;

  // value обязателен по типу (сервис ждёт его), но допускает любое значение,
  // включая '' и null — это штатная очистка характеристики.
  // Тип не сужаем: движок полей хранит строки, числа, даты, булевы и массивы.
  @IsDefined({ message: 'Значение поля обязательно' })
  value: any;

  // link был в сервисе, но отсутствовал в описании контроллера.
  // Без него whitelist молча выбрасывал бы ссылки на ГТД.
  @IsOptional() @IsString() @MaxLength(2000)
  link?: string;
}

export class CreateProductTaskDto {
  @IsString({ message: 'Название задачи обязательно' })
  @Trimmed() @MinLength(1) @MaxLength(500)
  title: string;

  @IsOptional() @IsString() @MaxLength(20000) description?: string;
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) priority?: string;
  @IsOptional() @EmptyToUndefined() @IsUUID() assigneeId?: string;
  @IsOptional() @EmptyToUndefined() @IsDateString() dueDate?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class AddTrademarkDto {
  @IsString({ message: 'Название товарного знака обязательно' })
  @Trimmed() @MinLength(1) @MaxLength(300)
  name: string;

  @IsOptional() @IsString() @Trimmed() @MaxLength(120)
  status?: string;
}

export class AddKitDto {
  @IsString({ message: 'Название набора обязательно' })
  @Trimmed() @MinLength(1) @MaxLength(300)
  kitName: string;
}

export class SetOzonTokenDto {
  @IsString({ message: 'Токен обязателен' }) @MaxLength(500)
  token: string;

  @IsString({ message: 'Client ID обязателен' }) @MaxLength(200)
  clientId: string;
}
