import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ProfileOverview } from './profile-overview';

describe('Profile avatar preview', () => {
  let component: ProfileOverview;
  let fixture: ComponentFixture<ProfileOverview>;
  let reader: { result: string; onload: (() => void) | null; onerror: (() => void) | null; readAsDataURL: ReturnType<typeof vi.fn> };
  const select = (file: File) => ({ target: { files: [file], value: 'sample' } }) as unknown as Event;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProfileOverview] }).compileComponents();
    fixture = TestBed.createComponent(ProfileOverview);
    component = fixture.componentInstance;
    reader = { result: 'data:image/png;base64,c2FtcGxl', onload: null, onerror: null, readAsDataURL: vi.fn() };
    vi.stubGlobal('FileReader', class { constructor() { return reader; } });
  });
  afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

  it('rejects unsupported MIME types and oversized files before reading', () => {
    const invalid = select(new File(['sample'], 'sample.svg', { type: 'image/svg+xml' }));
    component.onAvatarChange(invalid);
    expect(component.avatarStatus).toContain('PNG, JPEG, or WebP');
    expect((invalid.target as HTMLInputElement).value).toBe('');
    const oversized = new File(['sample'], 'sample.png', { type: 'image/png' });
    Object.defineProperty(oversized, 'size', { value: 5 * 1024 * 1024 + 1 });
    component.onAvatarChange(select(oversized));
    expect(component.avatarStatus).toContain('5 MB');
    expect(reader.readAsDataURL).not.toHaveBeenCalled();
    expect(component.avatarPreview).toBeNull();
  });

  it('renders an asynchronous image preview at the size limit and identifies it as unsaved', async () => {
    fixture.componentRef.setInput('staff', { id: 'sample', fullName: 'Sample Editor', email: 'sample@example.test' });
    fixture.detectChanges();
    const file = new File(['sample'], 'sample.webp', { type: 'image/webp' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 });
    component.onAvatarChange(select(file)); reader.onload!();
    await fixture.whenStable();
    expect(reader.readAsDataURL).toHaveBeenCalledWith(file);
    expect(component.avatarPreview).toBe(reader.result);
    expect(component.avatarStatus).toContain('not saved');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe(reader.result);
    component.onAvatarChange(select(file)); reader.onerror!();
    expect(component.avatarStatus).toContain('could not be previewed');
  });

  it('uses safe initials when staff information is missing or padded', () => {
    expect(component.initials).toBe('A');
    component.staff = { id: 'sample', fullName: '  Sample   Editor  ', email: 'sample@example.test' };
    expect(component.initials).toBe('SE');
  });
});
