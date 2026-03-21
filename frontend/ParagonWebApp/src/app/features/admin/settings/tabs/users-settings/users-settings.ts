import { RouterModule } from '@angular/router';
import { Component, OnInit, signal } from "@angular/core";
import { CommonModule } from '@angular/common';
import { UserModalComponent } from './components/user-modal/user-modal';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
}

@Component({
  selector: 'app-users-settings',
  imports: [CommonModule, RouterModule,
    UserModalComponent,
  ],
  standalone: true,
  templateUrl: './users-settings.html',
})
export class UsersSettingsComponent implements OnInit {

  //State using signals
  users = signal<User[]>([]);
  searchTerm = signal('');

  //Modal Add/Edit User
  modalOpen = false;
  selectedUser: any = null; // For edit mode, holds the user being edited

  filteredUsers = signal<User[]>([]);

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers() {
    //TODO: Replace with actual API call
    const mockUsers: User[] = [
      { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', status: 'active' },
      { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'User', status: 'inactive' },
      { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'User', status: 'active' }
    ];
    this.users.set(mockUsers);
    this.filteredUsers.set(mockUsers);
  }

  search(event: Event) {
    const value = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm.set(value);

    const filtered = this.users().filter(user =>
      user.name.toLowerCase().includes(value) ||
      user.email.toLowerCase().includes(value)
    );

    this.filteredUsers.set(filtered);
  }

  toggleStatus(user: User) {
    user.status = user.status === 'active' ? 'inactive' : 'active';
    this.filteredUsers.set([...this.filteredUsers()]);
  }

  changeRole(user: User, newRole: string) {
    user.role = newRole;
    this.filteredUsers.set([...this.filteredUsers()]);
  }

  openAddModal() {
    this.selectedUser = null;
    this.modalOpen = true;
  }

  openEditModal(user: any) {
    this.selectedUser = { ...user }; // Create a copy for editing
    this.modalOpen = true;
  }

  handleSave(user: any) {
    console.log('Saved user:', user);

    if (user.id) {
      //update logic
    } else {
      user.id = Date.now(); // Mock ID generation
      this.users.set([...this.users(), user]);
      this.filteredUsers.set([...this.filteredUsers(), user]);
    }
  }

}
