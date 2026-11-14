import { TestBed } from '@angular/core/testing';
import { SpecialIssueViewModal } from './special-issue-view-modal';

describe('Special issue details dialog', () => {
  it('keeps keyboard focus in the dialog, closes on Escape and restores focus and scrolling', () => {
    TestBed.configureTestingModule({imports:[SpecialIssueViewModal]});
    const fixture = TestBed.createComponent(SpecialIssueViewModal);
    const trigger = document.createElement('button'); document.body.appendChild(trigger); trigger.focus();
    const previousOverflow = document.body.style.overflow;
    fixture.componentRef.setInput('issue', { id:'sample',title:'Sample issue',slug:'sample',type:'Newsletter',academicYear:'2026-2027',status:'published',publishedAt:new Date(),coverImage:'',pdfUrl:'/sample.pdf',description:'Sample description' });
    fixture.detectChanges();
    const close = fixture.nativeElement.querySelector('button[aria-label="Close issue details"]') as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    expect(document.body.style.overflow).toBe('hidden');
    const download = fixture.nativeElement.querySelector('a[download]') as HTMLAnchorElement;
    close.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
    expect(document.activeElement).toBe(download);
    download.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
    expect(document.activeElement).toBe(close);
    fixture.componentInstance.close.subscribe(() => fixture.componentRef.setInput('issue',null));
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=dialog]')).toBeNull();
    expect(document.body.style.overflow).toBe(previousOverflow);
    expect(document.activeElement).toBe(trigger);
    fixture.destroy(); trigger.remove(); TestBed.resetTestingModule();
  });
});
