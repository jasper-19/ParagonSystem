import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorialBoardService } from '../../core/services/editorial-board.service';
import { LoaderService } from '../../shared/services/loader.service';
import {EditorialBoardData, BoardSection, BoardMember} from '../../models/editorial-board.model';

/* ================= COMPONENT ================= */

@Component({
  selector: 'app-editorial-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './editorial-board.html',
})
export class EditorialBoard implements OnInit {

  /* ================= TEMPLATE BINDINGS ================= */

  academicYear!: string;
  sections: BoardSection[] = [];
  adviser!: BoardMember;

  /* ================= SERVICES ================= */

  private editorialBoardService = inject(EditorialBoardService);

  loading = true;

  /* ================= LIFECYCLE ================= */
  constructor(private loaderService: LoaderService) {}

  ngOnInit(): void {
    this.loaderService.show();

    this.editorialBoardService.loadActiveBoard().subscribe({
      complete: () => {
        const board = this.editorialBoardService.getCurrentBoard();
        this.academicYear = board.academicYear;
        this.sections = board.sections;
        this.adviser = board.adviser;
        this.loading = false;
        this.loaderService.hide();
      },
      error: () => {
        this.loading = false;
        this.loaderService.hide();
      },
    });
  }
}
