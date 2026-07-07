import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

type ImagePlaceholderSize = 'small' | 'medium' | 'large';

@Component({
  selector: 'app-image-placeholder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-placeholder.html',
})
export class ImagePlaceholderComponent {
  @Input() size: ImagePlaceholderSize = 'medium';
  @Input() label = 'No image';

  get wrapperClass(): string {
    const base =
      'w-full h-full flex items-center justify-center bg-[#000035]/5 border border-[#000035]/10';

    if (this.size === 'small') {
      return `${base}`;
    }

    return `${base} text-center`;
  }

  get iconWrapperClass(): string {
    if (this.size === 'large') {
      return 'mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#f4b400]/15 text-[#f4b400]';
    }

    if (this.size === 'small') {
      return 'flex h-8 w-8 items-center justify-center rounded-full bg-[#f4b400]/15 text-[#f4b400]';
    }

    return 'mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#f4b400]/15 text-[#f4b400]';
  }

  get iconClass(): string {
    if (this.size === 'large') return 'h-8 w-8';
    if (this.size === 'small') return 'h-5 w-5';
    return 'h-6 w-6';
  }

  get showLabel(): boolean {
    return this.size !== 'small';
  }
}
