import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Application } from '../../../../../models/application.model';

@Component({
  selector: 'app-applications-overview',
  imports: [
    CommonModule,
    RouterModule,
  ],
  templateUrl: './applications-overview.html',
})
export class ApplicationsOverview {

  @Input({required: true}) totalApplications!: number;
  @Input({required: true}) pendingApplications!: number;
  @Input({required: true}) acceptedApplications!: number;
  @Input({required: true}) recentApplications!: Application[];
}
