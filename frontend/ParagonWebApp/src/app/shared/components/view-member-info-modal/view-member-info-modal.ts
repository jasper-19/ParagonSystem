import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, OnDestroy, effect, inject, input, output } from '@angular/core';

import { BoardMember } from '../../../models/editorial-board.model';

let viewMemberScrollLockCount = 0;

@Component({
  selector: 'app-view-member-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './view-member-info-modal.html',
})
export class ViewMemberInfoModalComponent implements OnDestroy {

  private readonly document = inject(DOCUMENT);
  private locked = false;
  private previousOverflow: string | null = null;

  // Inputs
  member       = input<BoardMember | null>(null);
  sectionTitle = input<string | null>(null);
  isOpen       = input<boolean>(false);

  // Outputs
  closed        = output<void>();
  editRequested = output<void>();

  constructor() {
    effect(() => {
      if (this.isOpen()) this.lockScroll();
      else this.unlockScroll();
    });
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  close(): void {
    this.closed.emit();
  }

  requestEdit(): void {
    this.editRequested.emit();
  }

  readonly YEAR_LEVEL_LABELS: Record<string, string> = {
    '1st_year':    '1st Year',
    '2nd_year':    '2nd Year',
    '3rd_year':    '3rd Year',
    '4th_year':    '4th Year',
    'unspecified': '—',
  };

  getYearLevelLabel(value: string | undefined): string {
    if (!value) return '—';
    return this.YEAR_LEVEL_LABELS[value] ?? value;
  }

  private lockScroll(): void {
    if (this.locked) return;
    const body = this.document?.body;
    if (!body) return;
    viewMemberScrollLockCount += 1;
    if (viewMemberScrollLockCount === 1) {
      this.previousOverflow = body.style.overflow;
      body.style.overflow = 'hidden';
    }
    this.locked = true;
  }

  private unlockScroll(): void {
    if (!this.locked) return;
    const body = this.document?.body;
    if (!body) return;
    viewMemberScrollLockCount = Math.max(0, viewMemberScrollLockCount - 1);
    if (viewMemberScrollLockCount === 0) {
      body.style.overflow = this.previousOverflow ?? '';
      this.previousOverflow = null;
    }
    this.locked = false;
  }
}
