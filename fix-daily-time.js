const fs = require('fs');
const os = require('os');
const path = os.homedir() + '/employee-tracker/apps/extension/src/content/base-tracker.ts';
let c = fs.readFileSync(path, 'utf8');

// 1. Добавляем sectionDailySeconds map после tabId
c = c.replace(
  `  private tabId = crypto.randomUUID(); // уникальный ID вкладки`,
  `  private tabId = crypto.randomUUID(); // уникальный ID вкладки
  // Накопленное время за день по каждому разделу (не сбрасывается при смене раздела)
  private sectionDailySeconds: Record<string, number> = {};`
);

// 2. При записи leave — добавляем в sectionDailySeconds
c = c.replace(
  `    const section = this.currentSection;
    const leaveEvent = this.platform === 'WILDBERRIES' ? 'wb_section_leave' : 'ozon_section_leave';
    this.sendEvent(leaveEvent as any, {
      section,
      sectionLabel:  this.getSectionLabel(section),
      activeSeconds,
    });
    // Очищаем storage после отправки
    this.clearStorage(section);`,
  `    const section = this.currentSection;
    // Накапливаем дневное время для этого раздела
    if (!this.sectionDailySeconds[section]) this.sectionDailySeconds[section] = 0;
    this.sectionDailySeconds[section] += activeSeconds;
    const leaveEvent = this.platform === 'WILDBERRIES' ? 'wb_section_leave' : 'ozon_section_leave';
    this.sendEvent(leaveEvent as any, {
      section,
      sectionLabel:  this.getSectionLabel(section),
      activeSeconds: this.sectionDailySeconds[section], // отправляем суммарное дневное время
    });
    // Очищаем storage после отправки
    this.clearStorage(section);`
);

// 3. В ping отправляем суммарное дневное время
c = c.replace(
  `  protected async reportActivePing() {
    if (!this.currentSection || this.sectionEnterTime === 0 || this.isIdle) return;
    if (this.isDailyLimitReached()) return;
    const isActive = await this.checkActiveTab();
    if (!isActive) return;

    const activeSeconds = this.getTotalActiveSeconds();
    if (activeSeconds < 10) return;

    const pingEvent = this.platform === 'WILDBERRIES' ? 'wb_section_ping' : 'ozon_section_ping';
    this.sendEvent(pingEvent as any, {
      section:      this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
      activeSeconds,
    });
  }`,
  `  protected async reportActivePing() {
    if (!this.currentSection || this.sectionEnterTime === 0 || this.isIdle) return;
    if (this.isDailyLimitReached()) return;

    const currentSeconds = this.getTotalActiveSeconds();
    if (currentSeconds < 10) return;

    // Суммарное дневное время = уже записанное + текущий сегмент
    const dailyBase = this.sectionDailySeconds[this.currentSection] ?? 0;
    const totalDailySeconds = dailyBase + currentSeconds;

    const pingEvent = this.platform === 'WILDBERRIES' ? 'wb_section_ping' : 'ozon_section_ping';
    this.sendEvent(pingEvent as any, {
      section:      this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
      activeSeconds: totalDailySeconds, // суммарное время за день
    });
  }`
);

// 4. Сбрасываем sectionDailySeconds в полночь
c = c.replace(
  `    setTimeout(() => {
      this.dailyActiveSeconds = 0;
      console.log('[ET] Daily counter reset at midnight');
      // Повторяем каждые 24 часа
      setInterval(() => {
        this.dailyActiveSeconds = 0;
        console.log('[ET] Daily counter reset');
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);`,
  `    setTimeout(() => {
      this.dailyActiveSeconds = 0;
      this.sectionDailySeconds = {};
      console.log('[ET] Daily counter reset at midnight');
      setInterval(() => {
        this.dailyActiveSeconds = 0;
        this.sectionDailySeconds = {};
        console.log('[ET] Daily counter reset');
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);`
);

fs.writeFileSync(path, c);
console.log('✅ Done');
