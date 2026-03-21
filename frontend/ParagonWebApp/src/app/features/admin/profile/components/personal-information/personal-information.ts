import { Component, Input, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditPersonalInfoModal } from './edit-personal-info-modal/edit-personal-info-modal';
import { StaffMember } from '../../../../../models/staff-member.model';
import { CollegeService } from '../../../../join/services/college.service';
import { College } from '../../../../join/models/college.model';

@Component({
  selector: 'app-personal-information',
  standalone: true,
  imports: [CommonModule, EditPersonalInfoModal],
  templateUrl: './personal-information.html'
})
export class PersonalInformation implements OnChanges {

  isModalOpen = false;

  @Input() staff: StaffMember | null = null;

  staffData: StaffMember | null = null;
  private readonly collegeService = inject(CollegeService);
  colleges: College[] = [];
  collegeName: string | null = null;
  programName: string | null = null;
  displayYear: string | null = null;

  ngOnInit(): void {
    this.collegeService.getColleges().subscribe({
      next: (c) => {
        this.colleges = c ?? [];
        this.updateDerivedNames();
      },
      error: () => {
        this.colleges = [];
      },
    });
  }

  ngOnChanges(): void {
    this.staffData = this.staff ? { ...this.staff } : null;
    this.updateDerivedNames();
  }

  openModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

  updateStaff(updatedStaff: StaffMember): void {
    this.staffData = updatedStaff;
    this.closeModal();
    this.updateDerivedNames();
  }

  private updateDerivedNames(): void {
    // College name
    const collegeId = this.staffData?.collegeId;
    if (!collegeId) {
      this.collegeName = null;
    } else {
      const found = this.colleges.find((c) => c.id === collegeId);
      this.collegeName = found ? found.name : collegeId;
    }

    // Program name (search programs across all colleges)
    const programId = this.staffData?.programId;
    if (!programId) {
      this.programName = null;
    } else {
      let foundProgramName: string | null = null;
      for (const col of this.colleges) {
        const p = col.programs?.find((pr) => pr.id === programId);
        if (p) {
          foundProgramName = p.name;
          break;
        }
      }
      this.programName = foundProgramName ? foundProgramName : programId;
    }

    // Year: format to ordinal like "2nd Year" and strip underscores
    this.displayYear = this.formatYearLevel(this.staffData?.yearLevel);
  }

  private formatYearLevel(raw?: string | null): string | null {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase().replace(/[_-]+/g, ' ');

    const ordinalSuffix = (n: number) => {
      const v = n % 100;
      if (v >= 11 && v <= 13) return `${n}th`;
      switch (n % 10) {
        case 1:
          return `${n}st`;
        case 2:
          return `${n}nd`;
        case 3:
          return `${n}rd`;
        default:
          return `${n}th`;
      }
    };

    // 1) direct numeric or numeric+suffix
    const numMatch = s.match(/^(\d+)(?:\s*(st|nd|rd|th))?(?:\s*year)?$/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      return `${ordinalSuffix(n)} Year`;
    }

    // 2) words first/second/third/fourth -> map
    const wordsMap: Record<string, number> = {
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
      fifth: 5,
    };
    const wordMatch = s.match(/^(first|second|third|fourth|fifth)(?:\s*year)?$/);
    if (wordMatch) {
      return `${ordinalSuffix(wordsMap[wordMatch[1]])} Year`;
    }

    // 3) contains a digit anywhere
    const anyDigit = s.match(/(\d+)/);
    if (anyDigit) {
      const n = parseInt(anyDigit[1], 10);
      return `${ordinalSuffix(n)} Year`;
    }

    // 4) fallback: title-case and ensure ends with 'Year'
    const tc = s
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return tc.toLowerCase().includes('year') ? tc : `${tc} Year`;
  }
}
