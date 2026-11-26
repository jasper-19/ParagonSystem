import { RenderMode, ServerRoute } from '@angular/ssr';
export const serverRoutes: ServerRoute[] = [
  { path: 'admin/**', renderMode: RenderMode.Client },
  { path: '', renderMode: RenderMode.Server },
  { path: 'article/:slug', renderMode: RenderMode.Server },
  { path: 'top-stories', renderMode: RenderMode.Server },
  { path: 'special-issues', renderMode: RenderMode.Server },
  { path: 'special-issues/:slug', renderMode: RenderMode.Server },
  { path: 'editorial-board', renderMode: RenderMode.Server },
  { path: 'join', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
