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

  readonly loading = signal(true);

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
          console.error(
            'Failed to load the public editorial board',
            err
          );
        },
      });
  }
}
