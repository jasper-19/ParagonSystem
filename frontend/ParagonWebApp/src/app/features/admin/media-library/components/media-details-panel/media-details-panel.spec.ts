import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Media } from '../../../../../models/media.model';
import { MediaDetailsPanelComponent } from './media-details-panel';

describe('Media details metadata controls', () => {
  let fixture: ComponentFixture<MediaDetailsPanelComponent>;
  const media: Media = { id: 'sample-image', fileName: 'campus.jpg', filePath: '/sample.jpg', fileType: 'image', mimeType: 'image/jpeg', size: 1024, altText: 'Campus', caption: 'Original caption', createdAt: '2026-11-07T00:00:00Z' };
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MediaDetailsPanelComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(MediaDetailsPanelComponent);
    fixture.componentRef.setInput('media', media);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('auto-saves normalized drafts on blur and disables duplicate saves while pending', async () => {
    const save = vi.spyOn(fixture.componentInstance.metadataSave, 'emit');
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '  Campus entrance  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges(); await fixture.whenStable();
    input.dispatchEvent(new Event('blur'));
    expect(save).toHaveBeenCalledWith({ altText: 'Campus entrance', caption: 'Original caption' });
    fixture.componentRef.setInput('isSaving', true); fixture.detectChanges();
    await fixture.whenStable();
    expect(input.disabled).toBe(true);
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
    fixture.componentInstance.onSave();
    expect(save).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('isSaving', false);
    fixture.componentRef.setInput('saveVersion', 1); fixture.detectChanges();
    expect(fixture.componentInstance.hasMetadataChanges()).toBe(false);
  });

  it('clears optional text and resets drafts when a different media item is opened', () => {
    const component = fixture.componentInstance;
    const save = vi.spyOn(component.metadataSave, 'emit');
    component.altTextDraft.set('   '); component.captionDraft.set(''); component.onSave();
    expect(save).toHaveBeenCalledWith({ altText: undefined, caption: undefined });
    fixture.componentRef.setInput('media', { ...media, id: 'second-image', altText: 'Second image', caption: undefined }); fixture.detectChanges();
    expect(component.altTextDraft()).toBe('Second image');
    expect(component.captionDraft()).toBe('');
    expect(component.hasMetadataChanges()).toBe(false);
    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
