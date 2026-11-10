import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { UserAccountsService } from '../../../../../../../core/services/user-accounts.service';
import { UserModalComponent } from './user-modal';

describe('Administrator account creation dialog', () => {
  let fixture: ComponentFixture<UserModalComponent>;
  let response: Subject<unknown>;
  let createAdmin: ReturnType<typeof vi.fn>;
  let opener: HTMLButtonElement;
  let previousOverflow: string;

  beforeEach(async () => {
    response = new Subject(); createAdmin = vi.fn(() => response.asObservable());
    await TestBed.configureTestingModule({
      imports: [UserModalComponent],
      providers: [{ provide: UserAccountsService, useValue: { createAdmin } }],
    }).compileComponents();
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    opener = document.createElement('button'); document.body.append(opener); opener.focus();
    fixture = TestBed.createComponent(UserModalComponent);
    fixture.componentRef.setInput('isOpen', true); fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy(); response.complete(); TestBed.resetTestingModule();
    opener.remove(); document.body.style.overflow = previousOverflow;
  });

  function fill(): void {
    fixture.componentInstance.form.setValue({ staffId: 'sample-staff', username: 'sample.editor', password: 'Synthetic-only-password' });
  }

  it('requires a staff member, valid username and a password within the allowed length', () => {
    const component = fixture.componentInstance;
    component.submit(); expect(createAdmin).not.toHaveBeenCalled();
    expect(component.form.controls.staffId.touched).toBe(true);
    fill(); component.form.controls.username.setValue('contains spaces'); component.submit();
    expect(createAdmin).not.toHaveBeenCalled();
    component.form.controls.username.setValue('sample.editor'); component.form.controls.password.setValue('short'); component.submit();
    expect(createAdmin).not.toHaveBeenCalled();
    component.form.controls.password.setValue('x'.repeat(73)); component.submit();
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it('creates only administrator accounts, guards pending close/save and emits no password', () => {
    const component = fixture.componentInstance;
    const saved = vi.spyOn(component.save, 'emit'); const closed = vi.spyOn(component.close, 'emit');
    fill(); component.submit(); component.submit(); component.onClose();
    expect(createAdmin).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ staffId: 'sample-staff', username: 'sample.editor', role: 'admin' }));
    expect(component.isSubmitting()).toBe(true); expect(closed).not.toHaveBeenCalled();
    response.next({}); response.complete();
    expect(saved).toHaveBeenCalledExactlyOnceWith({ staffId: 'sample-staff', username: 'sample.editor' });
    expect(component.form.controls.password.value).toBe('');
    expect(component.showPassword()).toBe(false); expect(component.isSubmitting()).toBe(false);
  });

  it('retains entered values after a server rejection and permits Escape after pending ends', () => {
    const component = fixture.componentInstance; const closed = vi.spyOn(component.close, 'emit');
    fill(); component.submit(); response.error({ error: { error: 'Synthetic account conflict.' } });
    expect(component.errorMessage()).toBe('Synthetic account conflict.');
    expect(component.form.controls.username.value).toBe('sample.editor');
    expect(component.isSubmitting()).toBe(false);
    component.handleDialogKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(closed).toHaveBeenCalledOnce(); expect(component.form.controls.password.value).toBe('');
  });

  it('locks page scrolling while open and returns focus and scrolling to the opener when closed', async () => {
    await Promise.resolve();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('select'));
    fixture.componentRef.setInput('isOpen', false); fixture.detectChanges();
    await Promise.resolve();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe(opener);
  });

  it('restores page scrolling when the open dialog is destroyed', () => {
    expect(document.body.style.overflow).toBe('hidden');
    fixture.destroy();
    expect(document.body.style.overflow).toBe('auto');
  });
});
