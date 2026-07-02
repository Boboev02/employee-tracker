import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';
import { PrismaService } from '../prisma/prisma.service';

// Словарь ключевых слов для каждого типа отдела
const KEYWORDS: Record<string, string[]> = {
  'Дизайн': [
    'фото', 'фотк', 'картинк', 'изображен', 'баннер', 'дизайн', 'инфографик',
    'обложк', 'видео', 'контент', 'визуал', 'логотип', 'макет', 'шаблон',
    'цвет', 'шрифт', 'иконк', 'иллюстрац', 'редактир', 'photoshop',
    'главн', 'слайд', 'презентац', 'брендинг', 'упаковк', 'этикетк',
  ],
  'Продвижение': [
    'реклам', 'продвижен', 'seo', 'трафик', 'конверс', 'продаж', 'маркетинг',
    'кампани', 'таргет', 'клик', 'ставк', 'бюджет', 'wb продвижен', 'ozon продвижен',
    'акци', 'скидк', 'промо', 'купон', 'отзыв', 'рейтинг', 'позиц',
    'ключев', 'запрос', 'поиск', 'выдач', 'топ', 'вывести', 'поднять',
    'охват', 'показ', 'ctr', 'roi', 'аудитор', 'блогер', 'инфлюенс',
  ],
  'Логистика': [
    'доставк', 'отправ', 'поставк', 'груз', 'транспорт', 'склад', 'хранен',
    'фулфилмент', 'ffb', 'fbo', 'fbs', 'поставщик', 'закуп', 'заказ',
    'остаток', 'запас', 'товар прибыл', 'отгрузк', 'накладн', 'декларац',
    'таможн', 'импорт', 'экспорт', 'логист', 'курьер', 'сдать', 'принять',
    'приемк', 'перемещен', 'перевозк', 'маркировк', 'честный знак',
  ],
  'Бухгалтерия': [
    'оплат', 'счёт', 'счет', 'бухгалтер', 'налог', 'финанс', 'деньги',
    'платёж', 'платеж', 'перевод', 'акт', 'договор', 'накладн', 'инвойс',
    'ндс', 'усн', 'отчёт', 'отчет', 'декларац', 'бюджет', 'расход',
    'доход', 'прибыл', 'убыток', 'касс', 'эквайринг', 'банк', 'расчет',
    'себестоимост', 'маржа', 'зарплат', 'аванс', 'премия',
  ],
  'Склад': [
    'склад', 'остатки', 'излишки', 'упаковк', 'короб', 'паллет', 'стеллаж',
    'ячейк', 'инвентаризац', 'пересчёт', 'пересчет', 'приход', 'расход',
    'брак', 'возврат', 'списан', 'комплектац', 'разборк', 'сортировк',
    'маркировать', 'наклейк', 'штрихкод', 'весов', 'размер',
  ],
};

@Controller('api/v1/ai')
@UseGuards(RbacGuard)
export class AiClassifyController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('classify-department')
  @RequirePermissions('task:create', 'task:read:self')
  async classifyDepartment(
    @CurrentUser() user: any,
    @Body() body: { title: string },
  ) {
    if (!body.title?.trim() || body.title.length < 4) {
      return { departmentId: null, departmentName: null };
    }

    const departments = await this.prisma.department.findMany({
      where: { orgId: user.orgId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    if (!departments.length) return { departmentId: null, departmentName: null };

    const titleLower = body.title.toLowerCase();

    // Считаем очки для каждого отдела по совпадению ключевых слов
    let bestDept: any = null;
    let bestScore = 0;

    for (const dept of departments) {
      const keywords = KEYWORDS[dept.name] ?? [];
      let score = 0;
      for (const kw of keywords) {
        if (titleLower.includes(kw)) score += kw.length; // длиннее слово = больше очков
      }
      if (score > bestScore) { bestScore = score; bestDept = dept; }
    }

    if (bestDept && bestScore > 0) {
      return { departmentId: bestDept.id, departmentName: bestDept.name, color: bestDept.color };
    }

    return { departmentId: null, departmentName: null };
  }
}
