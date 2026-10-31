import { addDays, type Subscription } from './subscriptions';

export const reminderLeadDays = [0, 1, 3, 7] as const;

export function dueReminders(items: Subscription[], today: string, daysBefore: number) {
  return items.filter(item => item.status === 'active' && item.cancelDate <= addDays(today, daysBefore));
}

export function reminderKey(item: Subscription, today: string) {
  return `${item.id}:${item.cancelDate}:${today}`;
}

const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

// RFC 5545 folds at 75 UTF-8 octets, without splitting a Unicode character.
function foldLine(line: string) {
  let result = '', bytes = 0;
  const encoder = new TextEncoder();
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += character;
    bytes += size;
  }
  return result;
}

export function subscriptionCalendar(items: Subscription[], today: string, daysBefore: number, now = new Date()) {
  if (!reminderLeadDays.includes(daysBefore as typeof reminderLeadDays[number])) throw new Error('Ngày nhắc không hợp lệ.');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Billy//Subscription reminders//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Lịch nhắc hủy gói Billy'];
  for (const item of items.filter(item => item.status === 'active' && item.cancelDate >= today)) {
    const title = `Nhắc hủy ${item.appName} · ${item.customerName}`;
    // 02:00 UTC = 09:00 UTC+7, matching the tracker date convention.
    const date = item.cancelDate.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${escapeText(item.id)}@billy-subscriptions`, `DTSTAMP:${stamp}`, `DTSTART:${date}T020000Z`, `DTEND:${date}T021500Z`, `SUMMARY:${escapeText(title)}`,
      `DESCRIPTION:${escapeText(`Khách: ${item.customerName}\nỨng dụng: ${item.appName}${item.planName ? ` · ${item.planName}` : ''}\nNgày cần hủy: ${item.cancelDate}\nMở Billy để kiểm tra và đánh dấu đã xử lý.`)}`, 'TRANSP:TRANSPARENT');
    for (const offset of daysBefore ? [daysBefore, 0] : [0]) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:${offset ? `-P${offset}D` : 'PT0S'}`, `DESCRIPTION:${escapeText(title)}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
