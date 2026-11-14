import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { SpecialIssues } from './special-issues';
import { SocketService } from '../../core/services/socket.service';
import { API_ENDPOINTS } from '../../core/config/api.config';

describe('Public special issue live updates', () => {
  const oldIssue = { id:'old', title:'Older issue', slug:'old', type:'Newsletter', academicYear:'2025-2026', status:'published', publishedAt:'2026-01-01', coverImage:'', pdfUrl:'/old.pdf' };
  const newIssue = { ...oldIssue, id:'new', title:'Newly published issue', slug:'new', academicYear:'2026-2027', publishedAt:'2026-11-14' };
  let callbacks: Map<string, () => void>;
  let http: HttpTestingController;
  const request = () => http.expectOne(req => req.url === API_ENDPOINTS.specialIssues);

  beforeEach(() => {
    callbacks = new Map();
    const on = (event: string, callback: () => void) => { callbacks.set(event,callback); return () => { callbacks.delete(event); }; };
    TestBed.configureTestingModule({ imports:[SpecialIssues], providers:[provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      {provide: SocketService, useValue:{ onSpecialIssuesUpdated:(callback:()=>void) => on('special-issues:updated',callback), on }},
    ]});
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify({ignoreCancelled:true}); TestBed.resetTestingModule(); });

  it('shows a new published issue immediately, preserves its format filter, and excludes drafts', () => {
    const fixture = TestBed.createComponent(SpecialIssues); fixture.detectChanges();
    request().flush([oldIssue]); fixture.detectChanges();
    const newsletter = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(x=>x.textContent?.trim()==='Newsletter')!;
    newsletter.click(); fixture.detectChanges();
    callbacks.get('special-issues:updated')!();
    request().flush([newIssue,oldIssue,{...newIssue,id:'draft',title:'Private draft',status:'draft'}]); fixture.detectChanges();
    expect(fixture.componentInstance.latestIssue?.id).toBe('new');
    expect(fixture.componentInstance.activeType).toBe('Newsletter');
    expect(fixture.componentInstance.totalIssues).toBe(2);
    expect(fixture.nativeElement.textContent).not.toContain('Private draft');
    expect(fixture.nativeElement.querySelector('app-page-loader')).toBeNull();
    fixture.destroy();
  });

  it('cancels stale requests, resyncs on reconnect, and cleans up both socket listeners', () => {
    const fixture = TestBed.createComponent(SpecialIssues); fixture.detectChanges();
    const initial = request();
    callbacks.get('connect')!();
    expect(initial.cancelled).toBe(true);
    const reconnect = request();
    callbacks.get('special-issues:updated')!();
    expect(reconnect.cancelled).toBe(true);
    request().flush([newIssue]); fixture.detectChanges();
    expect(fixture.componentInstance.latestIssue?.id).toBe('new');
    expect(fixture.componentInstance.loading).toBe(false);
    const callback = callbacks.get('special-issues:updated')!;
    fixture.destroy();
    expect(callbacks.size).toBe(0);
    callback(); http.expectNone(req=>req.url === API_ENDPOINTS.specialIssues);
  });

  it('recovers from a failed live refresh when the next update arrives', () => {
    const fixture = TestBed.createComponent(SpecialIssues); fixture.detectChanges();
    request().flush([oldIssue]); fixture.detectChanges();
    callbacks.get('special-issues:updated')!();
    request().flush({}, {status:503,statusText:'Unavailable'}); fixture.detectChanges();
    expect(fixture.componentInstance.loadError).toBeTruthy();
    callbacks.get('special-issues:updated')!();
    request().flush([newIssue]); fixture.detectChanges();
    expect(fixture.componentInstance.loadError).toBe('');
    expect(fixture.componentInstance.latestIssue?.id).toBe('new');
    fixture.destroy();
  });
});
