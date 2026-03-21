import { Injectable, inject } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
// import { HttpClient } from '@angular/common/http';

import { JoinPosition } from '../models/join-position.model';
import { JoinApplication } from '../models/join-application.model';
import { JoinApplicationResponse } from '../models/join-application-response.model';

@Injectable({
  providedIn: 'root'
})
export class JoinService {

  // private http = inject(HttpClient);

  /**
   * Fetch open positions
   * Replace with HTTP when backend is ready
   */
  getOpenPositions(): Observable<JoinPosition[]> {

    //Mock data
    const mockData: JoinPosition[] = [
  {
    id: 'writer',
    title: 'Staff Writer',
    department: 'Editorial',
    description: 'Research and write impactful campus stories.',
    requirements: ['Strong writing skills', 'Research ability'],
    subRoles: [
      {
        name: 'News',
        description: 'Cover timely campus and national issues.'
      },
      {
        name: 'Sports',
        description: 'Report on athletic events and student-athlete stories.'
      },
      {
        name: 'Feature',
        description: 'Write long-form human-interest and in-depth pieces.'
      },
      {
        name: 'Column',
        description: 'Opinion-based writing and critical commentary.'
      },
      {
        name: 'Editorial',
        description: 'Institutional position pieces of the publication.'
      },
      {
        name: 'DevCom',
        description: 'Development communication-focused reporting.'
      },
      {
        name: 'Literary',
        description: 'Creative writing, poetry, and short fiction.'
      }
    ],
    slots: 3,
    isOpen: true
  },

  {
    id: 'multimedia',
    title: 'Multimedia Producer',
    department: 'Documentation',
    description: 'Capture and produce multimedia content.',
    subRoles: [
      {
        name: 'Photojournalist',
        description: 'Document events through compelling photography.'
      },
      {
        name: 'Video Journalist',
        description: 'Produce short-form and long-form video reports.'
      }
    ],
    isOpen: true
  },

  {
    id: 'creative',
    title: 'Creative Producer',
    department: 'Creative',
    description: 'Design and produce visual content.',
    subRoles: [
      {
        name: 'Cartoonist',
        description: 'Create editorial and satirical illustrations.'
      },
      {
        name: 'Layout Artist',
        description: 'Design publication layouts and visual spreads.'
      }
    ],
    isOpen: true
  },
  {
    id: 'broadcast',
    title: 'Broadcaster',
    department: 'Broadcast',
    description: 'Report and produce content for broadcast media.',
    subRoles: [
      {
        name: 'News Anchor',
        description: 'Anchor and present news content on air.'
      },
      {
        name: 'Field Reporter',
        description: 'Report live from events and conduct on-the-ground interviews.'
      },
      {
        name: 'Mobile Journalist',
        description: 'Report from remote locations and mobile environments.'
      }
    ],
    isOpen: true
  }
];

    return of(mockData).pipe(delay(500)); // simulate API
  }

}
