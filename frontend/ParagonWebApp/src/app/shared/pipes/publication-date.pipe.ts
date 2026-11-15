import { Pipe, PipeTransform, inject } from '@angular/core';
import { GlobalSettingsService } from '../../core/services/global-settings.service';
import { GeneralGlobalSettings } from '../../models/global-settings.model';

export function formatPublicationDate(
  value: string | number | Date,
  settings: Pick<GeneralGlobalSettings, 'timezone' | 'dateFormat' | 'timeFormat'>,
  mode: 'date' | 'time' | 'datetime' = 'datetime',
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  let formatter: Intl.DateTimeFormat;
  const options: Intl.DateTimeFormatOptions = {
    timeZone: settings.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: settings.timeFormat === '24h' ? 'h23' : 'h12',
  };
  try { formatter = new Intl.DateTimeFormat('en-US', options); }
  catch { formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Asia/Manila' }); }
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  const formattedDate = settings.dateFormat === 'MM/DD/YYYY'
    ? `${parts['month']}/${parts['day']}/${parts['year']}`
    : settings.dateFormat === 'DD/MM/YYYY'
      ? `${parts['day']}/${parts['month']}/${parts['year']}`
      : `${parts['year']}-${parts['month']}-${parts['day']}`;
  const formattedTime = `${parts['hour']}:${parts['minute']}${parts['dayPeriod'] ? ' ' + parts['dayPeriod'] : ''}`;
  return mode === 'date' ? formattedDate : mode === 'time' ? formattedTime : `${formattedDate} ${formattedTime}`;
}

// Signal reads keep OnPush views reactive when organization preferences change.
@Pipe({ name: 'publicationDate', standalone: true, pure: false })
export class PublicationDatePipe implements PipeTransform {
  private readonly settings = inject(GlobalSettingsService);
  private lastKey = '';
  private lastValue = '';
  transform(value: string | number | Date | null | undefined, mode: 'date' | 'time' | 'datetime' = 'datetime'): string {
    if (value == null) return '';
    const settings = this.settings.publicSettings()?.general ?? {
      timezone: 'Asia/Manila', dateFormat: 'YYYY-MM-DD', timeFormat: '12h',
    };
    const key = JSON.stringify([value, mode, settings.timezone, settings.dateFormat, settings.timeFormat]);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.lastValue = formatPublicationDate(value, settings, mode);
    }
    return this.lastValue;
  }
}
