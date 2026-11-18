const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const PRIVATE_KEY = new RegExp(`^private-special-issues/(${UUID})/\\1\\.pdf$`);
const LEGACY_KEY = new RegExp(`^special-issues/(${UUID})/\\1\\.pdf$`);

export function privatePdfKey(id: string): string {
  const key = `private-special-issues/${id}/${id}.pdf`;
  if (!PRIVATE_KEY.test(key)) throw new Error('Invalid private PDF key');
  return key;
}

export function isPrivatePdfKey(key: string): boolean { return PRIVATE_KEY.test(key); }

export function migratePdfKey(key: string): string | null {
  const match = key.match(LEGACY_KEY);
  return match ? privatePdfKey(match[1]!) : null;
}

export function privatePdfUrl(key: string): string {
  const match = key.match(PRIVATE_KEY);
  if (!match) throw new Error('Invalid private PDF key');
  const base = new URL(process.env.API_BASE_URL || 'http://localhost:3000');
  if (process.env.NODE_ENV === 'production' && (base.protocol !== 'https:' || base.username || base.password)) {
    throw new Error('API_BASE_URL must be a credential-free HTTPS URL');
  }
  return new URL(`/api/special-issues/pdf/${match[1]}`, base).href;
}
