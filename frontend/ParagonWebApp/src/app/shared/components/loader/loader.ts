import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { LoaderService } from '../../services/loader.service';
import { PageLoaderComponent } from '../page-loader/page-loader';
@Component({selector:'app-loader',standalone:true,imports:[AsyncPipe,PageLoaderComponent],
  template: `@if (isLoading$ | async) { <div class="public-loader-shell"><app-page-loader variant="public" mode="overlay" label="Loading page…" [delay]="0" /></div> }`,
  styleUrl:'./loader.scss'})
export class LoaderComponent { readonly isLoading$ = inject(LoaderService).isLoading$; }
