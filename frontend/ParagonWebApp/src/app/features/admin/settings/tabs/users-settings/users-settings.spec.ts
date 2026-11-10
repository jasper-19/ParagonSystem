import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { UserAccountsService } from '../../../../../core/services/user-accounts.service';
import { SocketService } from '../../../../../core/services/socket.service';
import { ConfirmationService } from '../../../../../shared/components/confirmation-modal/confirmation.service';
import { ManagedUserAccount } from '../../../../../models/user-account.model';
import { UsersSettingsComponent } from './users-settings';

describe('User account access controls', () => {
  let fixture: ComponentFixture<UsersSettingsComponent>;
  let response: Subject<ManagedUserAccount>;
  let setActive: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;
  const account: ManagedUserAccount = { id: 'sample-user', username: 'sample.editor', role: 'admin', isActive: true, staff: { id: 'sample-staff', fullName: 'Sample Editor', email: 'editor@example.test' } };

  beforeEach(async () => {
    response = new Subject(); setActive = vi.fn(() => response.asObservable()); confirm = vi.fn(async () => false);
    await TestBed.configureTestingModule({
      imports: [UsersSettingsComponent],
      providers: [
        { provide: UserAccountsService, useValue: { list: () => of([account]), listEligibleStaff: () => of([]), setActive } },
        { provide: SocketService, useValue: { onEditorialBoardUpdated: () => () => {}, onUserAccountsUpdated: () => () => {} } },
        { provide: ConfirmationService, useValue: { confirm } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(UsersSettingsComponent); fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); response.complete(); TestBed.resetTestingModule(); });

  it('does not change account access when confirmation is cancelled', async () => {
    await fixture.componentInstance.requestAccessChange(account);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger', confirmText: 'Deactivate access' }));
    expect(setActive).not.toHaveBeenCalled();
    expect(fixture.componentInstance.accounts()[0].isActive).toBe(true);
  });

  it('prevents duplicate pending access changes and updates the account only on server success', async () => {
    confirm.mockResolvedValue(true);
    const component = fixture.componentInstance;
    await component.requestAccessChange(account);
    await component.requestAccessChange(account);
    expect(setActive).toHaveBeenCalledExactlyOnceWith('sample-user', false);
    expect(component.accounts()[0].isActive).toBe(true);
    expect(component.updatingAccountId()).toBe('sample-user');
    response.next({ ...account, isActive: false }); response.complete();
    expect(component.accounts()[0].isActive).toBe(false);
    expect(component.updatingAccountId()).toBe('');
    expect(component.messageKind()).toBe('success');
  });
});
