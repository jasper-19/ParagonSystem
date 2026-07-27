import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { EditorialBoardService } from '../../core/services/editorial-board.service';
import { LoaderService } from '../../shared/services/loader.service';
import { SocketService } from '../../core/services/socket.service';
import { SOCKET_EVENTS } from '../../core/constants/socket-events';

@Component({
  selector: 'app-editorial-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './editorial-board.html',
})
export class EditorialBoard implements OnInit, OnDestroy {
  private readonly editorialBoardService =
    inject(EditorialBoardService);

  private readonly loaderService =
    inject(LoaderService);

  private readonly socketService =
    inject(SocketService);

  private readonly boardSignal = toSignal(
    this.editorialBoardService.board$,
    {
      initialValue:
        this.editorialBoardService.getCurrentBoard(),
    }
  );

  readonly academicYear = computed(
    () => this.boardSignal().academicYear
  );

  readonly sections = computed(
    () => this.boardSignal().sections
  );

  readonly adviser = computed(
    () => this.boardSignal().adviser
  );

  readonly coAdviser = computed(
    () => this.boardSignal().coAdviser
  );

  readonly loading = signal(true);
  readonly loadError = signal(false);

  readonly totalMembers = computed(() =>
    this.sections().reduce(
      (total, section) => total + section.members.length,
      0
    )
  );

  readonly hasBoard = computed(() =>
    this.sections().length > 0 ||
    this.adviser().name.trim().length > 0 ||
    this.coAdviser().name.trim().length > 0
  );

  private readonly handleEditorialBoardUpdated = (): void => {
    console.log('📡 Refreshing public editorial board');

    this.loadActiveBoard(false);
  };

  ngOnInit(): void {
    // Initial page load
    this.loadActiveBoard(true);

    // Subsequent realtime refreshes
    this.socketService.onEditorialBoardUpdated(
      this.handleEditorialBoardUpdated
    );
  }

  ngOnDestroy(): void {
    this.socketService.off(
      SOCKET_EVENTS.EDITORIAL_BOARD_UPDATED,
      this.handleEditorialBoardUpdated
    );
  }

  private loadActiveBoard(showPageLoader: boolean): void {
    this.loadError.set(false);

    if (showPageLoader) {
      this.loading.set(true);
      this.loaderService.show();
    }

    this.editorialBoardService
      .loadActiveBoard()
      .pipe(
        finalize(() => {
          if (showPageLoader) {
            this.loading.set(false);
            this.loaderService.hide();
          }
        })
      )
      .subscribe({
        error: (err: unknown) => {
          if (showPageLoader || !this.hasBoard()) {
            this.loadError.set(true);
          }

          console.error(
            'Failed to load the public editorial board',
            err
          );
        },
      });
  }

  retry(): void {
    this.loadActiveBoard(true);
  }

  sectionId(title: string, index: number): string {
    const slug = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return `board-section-${slug || index + 1}`;
  }
}
