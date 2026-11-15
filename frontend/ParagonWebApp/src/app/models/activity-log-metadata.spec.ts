import { ActivityLog } from './activity-log.model';
import { activityDetailGroups } from './activity-log-metadata';

describe('Additional activity details', () => {
  const log = (metadata: unknown) => ({ metadata } as ActivityLog);
  it('groups readable fields and keeps full reference identifiers', () => {
    const groups = activityDetailGroups(log({ description: 'Duplicate', fields: ['title', 'image'],
      section: 'publishingMedia', outcome: 'success', actorType: 'environment_admin', actorRole: 'admin',
      method: 'PATCH', requestId: '11111111-1111-4111-8111-111111111111',
    }));
    expect(groups.map(group => group.label)).toEqual(['Event details', 'Actor details', 'Request details', 'Reference identifiers']);
    const items = groups.flatMap(group => group.items);
    expect(items.find(item => item.id === 'fields')?.value).toBe('Title, Cover image');
    expect(items.find(item => item.id === 'section')?.value).toBe('Publishing and media');
    expect(items.find(item => item.id === 'outcome')?.value).toBe('Successful');
    expect(items.find(item => item.id === 'actorRole')?.value).toBe('Administrator');
    expect(items.find(item => item.id === 'requestId')).toMatchObject({ label: 'Request ID', value: '11111111-1111-4111-8111-111111111111', reference: true });
    expect(items.some(item => item.id === 'description')).toBe(false);
  });

  it('formats file details, dates, HTTP statuses and real booleans without rewriting text', () => {
    const items = activityDetailGroups(log({ size: 1572864, mimeType: 'application/pdf', status: 415,
      satisfied: false, enabled: true, title: 'A true story about false alarms',
      interviewDate: '2026-11-16T00:00:00Z',
    })).flatMap(group => group.items);
    expect(items.find(item => item.id === 'size')?.value).toBe('1.5 MB');
    expect(items.find(item => item.id === 'mimeType')?.value).toBe('PDF document (application/pdf)');
    expect(items.find(item => item.id === 'status')?.value).toContain('Unsupported media type');
    expect(items.find(item => item.id === 'satisfied')?.value).toBe('Not satisfied');
    expect(items.find(item => item.id === 'enabled')?.value).toBe('Yes');
    expect(items.find(item => item.id === 'title')?.value).toBe('A true story about false alarms');
    expect(items.find(item => item.id === 'interviewDate')?.value).toContain('8:00 AM (Philippine time)');
  });

  it('flattens nested changes and withholds sensitive historical metadata without mutating it', () => {
    const metadata = { before: { title: '<script>old</script>', password: 'private-secret' },
      after: { title: 'New title', email: 'private-email' }, notes: 'private-note', passwordChanged: true,
      placeholder: '[REDACTED]', missing: null, empty: [],
    };
    const items = activityDetailGroups(log(metadata)).flatMap(group => group.items);
    expect(items.find(item => item.id === 'before.title')).toMatchObject({ label: 'Previous values · Title', value: '<script>old</script>' });
    expect(items.find(item => item.id === 'passwordChanged')?.value).toBe('Yes');
    expect(items.find(item => item.id === 'missing')?.value).toBe('Not recorded');
    expect(items.find(item => item.id === 'empty')?.value).toBe('None recorded');
    expect(JSON.stringify(items)).not.toContain('private-');
    expect(metadata.before.password).toBe('private-secret');
  });

  it('handles missing, malformed, excessive and cyclic historical metadata', () => {
    expect(activityDetailGroups(log(null))).toEqual([]);
    expect(activityDetailGroups(log(['unexpected']))).toEqual([]);
    const cycle: Record<string, unknown> = {}; cycle['self'] = cycle;
    expect(() => activityDetailGroups(log(cycle))).not.toThrow();
    const groups = activityDetailGroups(log(Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`value${i}`, i]))));
    expect(groups.flatMap(group => group.items).length).toBeLessThanOrEqual(60);
    expect(groups.flatMap(group => group.items).some(item => item.id === '__display_limit')).toBe(true);
  });

  it('handles zero values, date-only and offset timestamps and sensitive values inside arrays', () => {
    const items = activityDetailGroups(log({ size: 0, version: 0, title: '',
      before: [{ full_name: 'private-name', emailAddress: 'private-email', firstName: 'private-first' }],
      interviewDate: '2026-11-16T08:00:00+08:00',
    })).flatMap(group => group.items);
    expect(items.find(item => item.id === 'size')?.value).toBe('0 bytes');
    expect(items.find(item => item.id === 'version')?.value).toBe('0');
    expect(items.find(item => item.id === 'title')?.value).toBe('Not recorded');
    expect(items.find(item => item.id === 'interviewDate')?.value).toContain('8:00 AM (Philippine time)');
    expect(JSON.stringify(items)).not.toContain('private-');
    for (const value of ['2026-11-16', '2026-11-16T08:00:00', 'invalid date']) {
      expect(activityDetailGroups(log({ interviewDate: value }))[0]?.items[0]?.value).toBe(value);
    }
  });
});
