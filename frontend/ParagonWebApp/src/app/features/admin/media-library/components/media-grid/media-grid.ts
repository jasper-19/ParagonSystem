import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Media } from '../../../../../models/media.model';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MediaCardComponent } from '../media-card/media-card';

@Component({
  selector: 'app-media-grid',
  standalone: true,
  imports: [CommonModule, RouterModule,
    MediaCardComponent
  ],
  templateUrl: './media-grid.html'
})
export class MediaGridComponent {
  @Input() mediaList: Media[] = [];
  @Input() selectedIds: string[] = [];

  @Output() toggleSelection = new EventEmitter<string>();
  @Output() openDetails = new EventEmitter<string>();

  isSelected(mediaId: string): boolean {
    return this.selectedIds.includes(mediaId);
  }

  trackByMediaId(_: number, media: Media): string {
    return media.id;
  }
}
