import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-join-faq',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './join-faq.html',
})
export class JoinFaq {

  readonly sectionTitle = signal('Frequently Asked Questions');

  readonly faqs = signal<FaqItem[]>([
    {
      question: 'Who can apply?',
      answer:
        'Any currently enrolled student of CSU-Gonzaga with a passion for journalism, storytelling, or creative media is encouraged to apply.',
    },
    {
      question: 'Do I need prior experience?',
      answer:
        'No prior experience is required. However, a strong interest in writing, editing, or multimedia production is essential.',
    },
    {
      question: 'How long is the commitment?',
      answer:
        'Members are expected to serve for at least one academic year and actively contribute to assigned projects.',
    },
    {
      question: 'When will I hear back?',
      answer:
        'Applications are reviewed by the editorial board, and selected applicants will be contacted within a week.',
    },
  ]);

  readonly activeIndex = signal<number | null>(null);

  toggle(index: number) {
    this.activeIndex.update(current =>
      current === index ? null : index
    );
  }

}
