import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email адрес' })
  // Только trim, без toLowerCase: в базе email хранится как ввели при
  // регистрации, а поиск идёт точным совпадением. Нормализация регистра
  // отрезала бы доступ тем, кто регистрировался с заглавными буквами.
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  email: string;

  @IsString({ message: 'Пароль обязателен' })
  @MinLength(8, { message: 'Пароль должен содержать минимум 8 символов' })
  @MaxLength(128, { message: 'Пароль слишком длинный' })
  @Matches(/[A-Za-zА-Яа-я]/, { message: 'Пароль должен содержать буквы' })
  password: string;

  @IsString({ message: 'Имя обязательно' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2, { message: 'Имя должно содержать минимум 2 символа' })
  @MaxLength(120, { message: 'Имя слишком длинное' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'Название организации слишком длинное' })
  orgName?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный email адрес' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  email: string;

  @IsString({ message: 'Пароль обязателен' })
  @MaxLength(128)
  password: string;
}
