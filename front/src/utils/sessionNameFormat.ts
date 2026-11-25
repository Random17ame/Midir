/** Presentation-only naming preferences. Weekdays use local Date.getDay() order. */
export const namingWeekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const defaultNameTemplate = '{encounter} {label} {run} {date}';
export type CountMode = 'daily' | 'weekly' | 'rolling' | 'scheduled';
export interface CountRule { mode: CountMode; weekDay: number; weekTime: string; hours: number }
export interface GroupSchedule {
  enabled: boolean; label: string; days: number[]; start: string; end: string;
  template: string; count: CountRule;
}
export interface SessionNamePreferences {
  includeRun: boolean;
  count: CountRule;
  schedules: GroupSchedule[];
  includeDate: boolean;
  includeTime: boolean;
  customEnabled: boolean;
  applyEveryDay: boolean;
  template: string;
  labels: string[];
}
const clockValid = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export function normalizeCountRule(raw: unknown, fallback: CountMode = 'daily'): CountRule {
  const r = raw && typeof raw === 'object' ? raw as Partial<CountRule> : {};
  return {
    mode: r.mode && ['daily','weekly','rolling','scheduled'].includes(r.mode) ? r.mode : fallback,
    weekDay: typeof r.weekDay === 'number' && Number.isInteger(r.weekDay) && r.weekDay >= 0 && r.weekDay <= 6 ? r.weekDay : 4,
    weekTime: clockValid(r.weekTime) ? r.weekTime : '07:00',
    hours: typeof r.hours === 'number' && Number.isFinite(r.hours) ? Math.max(1, Math.min(168, r.hours)) : 12,
  };
}
export function newGroupSchedule(): GroupSchedule {
  return { enabled: true, label: '', days: [], start: '18:00', end: '04:00', template: defaultNameTemplate, count: normalizeCountRule(undefined, 'scheduled') };
}
function normalizeSchedule(raw: unknown): GroupSchedule {
  const r = raw && typeof raw === 'object' ? raw as Partial<GroupSchedule> : {};
  return { enabled: r.enabled !== false, label: typeof r.label === 'string' ? r.label : '',
    days: Array.isArray(r.days) ? [...new Set(r.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))] : [],
    start: typeof r.start === 'string' ? r.start : '18:00', end: typeof r.end === 'string' ? r.end : '04:00',
    template: typeof r.template === 'string' ? r.template : defaultNameTemplate,
    count: normalizeCountRule(r.count, 'scheduled') };
}
export function normalizeSessionNamePreferences(raw?: unknown): SessionNamePreferences {
  const p = raw && typeof raw === 'object' ? raw as Partial<SessionNamePreferences> : {};
  return {
    includeRun: p.includeRun === true,
    count: normalizeCountRule(p.count),
    schedules: Array.isArray(p.schedules) ? p.schedules.map(normalizeSchedule) : [],
    includeDate: p.includeDate !== false,
    includeTime: p.includeTime !== false,
    customEnabled: p.customEnabled === true,
    applyEveryDay: p.applyEveryDay === true,
    template: typeof p.template === 'string' ? p.template : defaultNameTemplate,
    labels: namingWeekdays.map((_, i) => Array.isArray(p.labels) && typeof p.labels[i] === 'string' ? p.labels[i] : ''),
  };
}
export const namingTokens = ['encounter', 'label', 'weekday', 'run', 'date', 'time'] as const;
export function validSessionNameTemplate(template: string): boolean {
  if (!template.trim()) return false;
  const stripped = template.replace(/\{([a-z]+)\}/g, (match, key: string) =>
    (namingTokens as readonly string[]).includes(key) ? '' : match);
  return !/[{}]/.test(stripped);
}
export function recordingLocalDate(startTime?: number, fallback = new Date()): Date {
  const date = new Date(Number(startTime) * 1000);
  return Number(startTime) > 0 && Number.isFinite(date.getTime()) ? date : fallback;
}
const pad = (n: number) => String(n).padStart(2, '0');
function dateText(d: Date): string {
  return `${pad(d.getMonth()+1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(-2)}`;
}
function timeText(d: Date): string {
  return `${d.getHours()%12 || 12}:${pad(d.getMinutes())}${d.getHours() < 12 ? 'a' : 'p'}`;
}
export function validGroupSchedule(g: GroupSchedule): boolean {
  return !!g.label.trim() && g.days.length > 0 && clockValid(g.start) && clockValid(g.end) && validSessionNameTemplate(g.template);
}
function atClock(d: Date, clock: string, dayOffset = 0): Date {
  const [h,m] = clock.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()+dayOffset, h, m);
}
export interface ScheduleMatch { index: number; group: GroupSchedule; start: Date; end: Date }
/** First matching enabled rule wins; the weekday is the window's start day. */
export function matchGroupSchedule(p: SessionNamePreferences, date: Date): ScheduleMatch | undefined {
  for (const [index,group] of p.schedules.entries()) {
    if (!group.enabled || !validGroupSchedule(group)) continue;
    for (const offset of [0,-1]) {
      const start = atClock(date, group.start, offset);
      const end = atClock(date, group.end, offset + (group.end <= group.start ? 1 : 0));
      if (group.days.includes(start.getDay()) && date >= start && date < end) return {index,group,start,end};
    }
  }
  return undefined;
}
export function activeNameTemplate(p: SessionNamePreferences, date: Date): string | undefined {
  const group = matchGroupSchedule(p,date);
  if (group) return group.group.template;
  return p.customEnabled && (p.applyEveryDay || p.labels[date.getDay()]?.trim()) && validSessionNameTemplate(p.template)
    ? p.template : undefined;
}
export function nextDailyRun(date: Date, sessions: readonly {id: string; startTime: number}[]): number {
  const ids = new Set<string>();
  for (const session of sessions) {
    if (!session.id || session.id === 'live' || !(session.startTime > 0)) continue;
    const d = new Date(session.startTime * 1000);
    if (d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate()) ids.add(session.id);
  }
  return ids.size + 1;
}
export function needsRunNumber(p: SessionNamePreferences, date: Date): boolean {
  const template = activeNameTemplate(p,date);
  return template ? template.includes('{run}') : p.includeRun;
}
function countBounds(date: Date, rule: CountRule, match?: ScheduleMatch): [number, number] {
  if (rule.mode === 'scheduled' && match) return [+match.start,+match.end];
  if (rule.mode === 'rolling') return [+date-rule.hours*3600000,+date+1];
  if (rule.mode === 'weekly') {
    const delta = (date.getDay()-rule.weekDay+7)%7;
    let start = atClock(date,rule.weekTime,-delta);
    if (start > date) start = atClock(start,rule.weekTime,-7);
    return [+start,+atClock(start,rule.weekTime,7)];
  }
  return [+atClock(date,'00:00'),+atClock(date,'00:00',1)];
}
/** Count saved metadata only; a group never borrows sessions assigned to another rule. */
export function nextRunNumber(date: Date, sessions: readonly {id: string; startTime: number}[], p: SessionNamePreferences): number {
  const match = matchGroupSchedule(p,date);
  const [start,end] = countBounds(date,match?.group.count || p.count,match);
  const ids = new Set<string>();
  for (const session of sessions) {
    if (!session.id || session.id === 'live' || !Number.isFinite(session.startTime) || session.startTime <= 0) continue;
    const ms = session.startTime*1000;
    if (ms < start || ms >= end) continue;
    if (match && matchGroupSchedule(p,new Date(ms))?.index !== match.index) continue;
    ids.add(session.id);
  }
  return ids.size+1;
}
export function formatSessionName(encounter: string, date: Date, p: SessionNamePreferences, run?: number): string {
  const base = encounter.trim() || 'Session';
  const datePart = dateText(date), timePart = timeText(date);
  const match = matchGroupSchedule(p,date);
  const template = activeNameTemplate(p, date);
  if (template) {
    const values: Record<string, string> = {
      encounter: base, label: match?.group.label.trim() || p.labels[date.getDay()]?.trim() || '', weekday: namingWeekdays[date.getDay()],
      run: run === undefined ? '' : String(run), date: datePart, time: timePart,
    };
    const custom = template.replace(/\{([a-z]+)\}/g, (_, key: string) => values[key] || '').replace(/\s+/g, ' ').trim();
    if (custom) return custom;
  }
  const suffix = [p.includeTime ? timePart : '', p.includeDate ? datePart : ''].filter(Boolean).join(' ');
  const numbered = p.includeRun && run !== undefined ? `${base} ${run}` : base;
  return suffix ? `${numbered} @ ${suffix}` : numbered;
}
