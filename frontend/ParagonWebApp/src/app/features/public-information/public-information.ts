import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GlobalSettingsService } from '../../core/services/global-settings.service';
import { INFORMATION_PAGES, InformationPageKey } from './public-information.data';

@Component({
  selector: 'app-public-information',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-information.html',
  styleUrl: './public-information.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicInformationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly routeData = toSignal(this.route.data, { initialValue: this.route.snapshot.data });
  private readonly settings = inject(GlobalSettingsService).publicSettings;
  readonly pageKey = computed<InformationPageKey>(() => {
    const key = this.routeData()['page'];
    return Object.hasOwn(INFORMATION_PAGES, key) ? key : 'our-story';
  });
  readonly page = computed(() => INFORMATION_PAGES[this.pageKey()]);
  readonly siteName = computed(() => this.settings()?.general.siteName?.trim() || 'Paragon');
  readonly organization = computed(() => this.settings()?.general.organizationName?.trim() || 'Cagayan State University - Gonzaga Campus');
  readonly contactEmail = computed(() => {
    const email = this.settings()?.general.contactEmail?.trim() || '';
    return /^[^\s@<>?&#%:]+@[^\s@<>?&#%:]+\.[^\s@<>?&#%:]+$/.test(email) ? email : '';
  });
  readonly contactTopics = [
    { title: 'Story ideas', description: 'Something the campus should know about?', subject: 'Story suggestion' },
    { title: 'Corrections & feedback', description: 'Help us take a closer look at a published story.', subject: 'Correction or feedback' },
    { title: 'General inquiries', description: 'Questions about Paragon or its publications.', subject: 'Publication inquiry' },
  ];

  emailLink(subject = 'Publication inquiry'): string {
    return this.contactEmail() ? `mailto:${this.contactEmail()}?subject=${encodeURIComponent(subject)}` : '';
  }

  goToSection(event: MouseEvent, id: string): void {
    // Preserve normal browser behavior for modified clicks and copied links.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const target = this.document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const view = this.document.defaultView;
    view?.history.replaceState(view.history.state, '', `#${id}`);
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }
}
