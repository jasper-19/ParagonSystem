import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { EditorialBoardService } from '../../../../core/services/editorial-board.service';
import { EditorialBoardData } from '../../../../models/editorial-board.model';

@Component({
  selector: 'admin-editorial-board-preview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-board-preview.html',
})
export class PublicBoardPreviewComponent {

  private editorialBoardService = inject(EditorialBoardService);

  board$ = this.editorialBoardService.board$;

  totalMembers(board: EditorialBoardData): number {
    const names = new Set(board.sections.flatMap(s => s.members.map(m => m.name)));
    return names.size;
  }

}
