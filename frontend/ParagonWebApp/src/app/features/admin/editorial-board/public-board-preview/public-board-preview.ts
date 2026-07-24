import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';

import { EditorialBoardService } from '../../../../core/services/editorial-board.service';
import { EditorialBoardData } from '../../../../models/editorial-board.model';
import { SocketService } from '../../../../core/services/socket.service';

type EditorialSectionIcon =
  | 'crown'
  | 'newspaper'
  | 'pen-line'
  | 'palette'
  | 'brush'
  | 'mic'
  | 'users';

@Component({
  selector: 'admin-editorial-board-preview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
  ],
  templateUrl: './public-board-preview.html',
})
export class PublicBoardPreviewComponent
  implements OnInit {

  private readonly editorialBoardService =
    inject(EditorialBoardService);

  readonly board$ =
    this.editorialBoardService.board$;

  readonly boardLoaded$ =
    this.editorialBoardService.boardLoaded$;

  readonly hasActiveBoard$ =
    this.editorialBoardService.hasActiveBoard$;

  readonly loading =
    signal(true);

  readonly loadError =
    signal<string | null>(null);

  ngOnInit(): void {
    this.loadPreviewBoard();
  }

  loadPreviewBoard(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.editorialBoardService
      .loadAdminActiveBoard()
      .pipe(
        finalize(() => {
          this.loading.set(false);
        })
      )
      .subscribe({
        error: error => {
          console.error(
            'Failed to load editorial board preview:',
            error
          );

          this.loadError.set(
            'Unable to load the editorial board preview.'
          );
        },
      });
  }

  totalMembers(
    board: EditorialBoardData
  ): number {
    const staffKeys = new Set(
      board.sections.flatMap(section =>
        section.members.map(member =>
          member.staffId ??
          member.name
            .trim()
            .toLowerCase()
        )
      )
    );

    return staffKeys.size;
  }

  private readonly YEAR_LEVEL_LABELS:
    Record<string, string> = {
      '1st_year': '1st Year',
      '2nd_year': '2nd Year',
      '3rd_year': '3rd Year',
      '4th_year': '4th Year',
      unspecified: 'Unspecified',
    };

  getYearLevelLabel(
    value: string | undefined
  ): string {
    if (!value) {
      return '';
    }

    return (
      this.YEAR_LEVEL_LABELS[value] ??
      value
    );
  }

  trackSection(
    _index: number,
    section: {
      title: string;
    }
  ): string {
    return section.title;
  }

  trackMember(
    _index: number,
    member: {
      boardMemberId?: string;
      staffId?: string;
      name: string;
      position: string;
    }
  ): string {
    return (
      member.boardMemberId ??
      member.staffId ??
      `${member.name}-${member.position}`
    );
  }

  getSectionIcon(
    sectionTitle: string
  ): EditorialSectionIcon {
    const normalized =
      sectionTitle.trim().toLowerCase();

    switch (normalized) {
      case 'executive editors':
        return 'crown';

      case 'section editors':
        return 'newspaper';

      case 'staff writers':
        return 'pen-line';

      case 'senior creative producers':
        return 'palette';

      case 'junior creative producers':
        return 'brush';

      case 'broadcasters':
        return 'mic';

      default:
        return 'users';
    }
  }

}
