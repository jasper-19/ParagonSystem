import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-staff-application',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './staff-application.html',
  styleUrl: './staff-application.scss',
})
export class StaffApplication {}
