import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../services/loader.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isLoading$ | async"
         class="fixed inset-0 flex items-center justify-center bg-white z-50">
      <div class="spinner"></div>
    </div>
  `,
  styleUrls: ['./loader.scss']
})
export class LoaderComponent {
  isLoading$!: Observable<boolean>;

  constructor(private loaderService: LoaderService) {
    this.isLoading$ = this.loaderService.isLoading$;
  }
}
