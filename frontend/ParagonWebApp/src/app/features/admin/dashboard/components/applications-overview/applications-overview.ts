import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Application, ApplicationStatus } from '../../../../../models/application.model';

@Component({
  selector: 'app-applications-overview',
  imports: [
    CommonModule,
    RouterModule,
  ],
  templateUrl: './applications-overview.html',
})
export class ApplicationsOverview {

  readonly totalApplications =
    input.required<number>();

  readonly pendingApplications =
    input.required<number>();

  readonly acceptedApplications =
    input.required<number>();

  readonly recentApplications =
    input.required<Application[]>();

  getPositionLabels(application: Application): string[] {
    const selectedPositions =
      application.selectedPositions ?? [];

    if (selectedPositions.length > 0) {
      return selectedPositions
        .map(selection =>
          this.formatPositionId(
            selection.positionId
          )
        )
        .filter(Boolean);
    }

    const legacyPosition =
      application.positionId?.trim();

    return legacyPosition
      ? [
          this.formatPositionId(
            legacyPosition
          ),
        ]
      : [];
  }

  getCategoryLabels(application: Application): string[] {
    const selectedPositions =
      application.selectedPositions ?? [];

    if (selectedPositions.length > 0) {
      return [
        ...new Set(
          selectedPositions.flatMap(
            selection =>
              selection.categories ?? []
          )
        ),
      ]
        .map(category => category.trim())
        .filter(Boolean);
    }

    const legacyCategory =
      application.subRole?.trim();

    return legacyCategory
      ? [legacyCategory]
      : [];
  }

formatStatus(status?: ApplicationStatus): string {
    if (!status) {
      return 'Unknown';
    }

    const labels: Record<ApplicationStatus, string> = {
      pending: 'Pending',
      interview_scheduled: 'Interview Scheduled',
      interview_completed: 'Interview Completed',
      accepted: 'Accepted',
      rejected: 'Rejected',
    };

    return labels[status];
  }

  private formatPositionId(
    positionId: string
  ): string {
    return positionId
      .trim()
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, character =>
        character.toUpperCase()
      );
  }



}
