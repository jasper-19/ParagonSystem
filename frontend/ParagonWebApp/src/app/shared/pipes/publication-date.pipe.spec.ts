import { formatPublicationDate } from './publication-date.pipe';

describe('publication date preferences', () => {
  it('applies timezone rollover, date ordering and a 24-hour midnight', () => {
    expect(formatPublicationDate('2026-11-14T16:00:00Z', {
      timezone: 'Asia/Manila', dateFormat: 'DD/MM/YYYY', timeFormat: '24h',
    })).toBe('15/11/2026 00:00');
  });
  it('supports 12-hour time, fallback timezone and invalid dates', () => {
    const settings = { timezone: 'invalid', dateFormat: 'MM/DD/YYYY', timeFormat: '12h' } as const;
    expect(formatPublicationDate('2026-11-14T16:00:00Z', settings)).toBe('11/15/2026 12:00 AM');
    expect(formatPublicationDate('invalid', settings)).toBe('');
  });
});
