import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
const { env } = (globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } }).process;
const origin = new URL(env['PUBLIC_SITE_URL'] || 'https://paragon-system-gvlg.vercel.app');
const engine = new AngularAppEngine({ allowedHosts: [origin.hostname, 'localhost', '127.0.0.1'] });
export const handleRequest = createRequestHandler(async (request: Request): Promise<Response> =>
  await engine.handle(request) ?? new Response('Not found', { status: 404 }),
);
