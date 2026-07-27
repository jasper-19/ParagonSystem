import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StaffMember } from '../../../../../models/staff-member.model';
import { CollegeService } from '../../../../join/services/college.service';
import { College } from '../../../../join/models/college.model';

@Component({
  selector: 'app-personal-information',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './personal-information.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalInformation implements OnChanges, OnInit {

  @Input() staff: StaffMember | null = null;

  staffData: StaffMember | null = null;
  private readonly collegeService = inject(CollegeService);
  private readonly cdr = inject(ChangeDetectorRef);
  colleges: College[] = [];
  collegeName: string | null = null;
  programName: string | null = null;
  displayYear: string | null = null;
  educationLoading = false;
  educationError = false;

  ngOnInit(): void {
    this.loadColleges();
  }

  retryEducationData(): void {
    this.loadColleges();
  }

  private loadColleges(): void {
    this.educationLoading = true;
    this.educationError = false;
    this.collegeService.getColleges().subscribe({
      next: (c) => {
        this.colleges = c ?? [];
        this.educationLoading = false;
        this.updateDerivedNames();
        this.cdr.markForCheck();
      },
      error: () => {
        this.colleges = [];
        this.educationLoading = false;
        this.educationError = true;
        this.updateDerivedNames();
        this.cdr.markForCheck();
      },
    });
  }

  ngOnChanges(): void {
    this.staffData = this.staff ? { ...this.staff } : null;
    this.updateDerivedNames();
  }

  private updateDerivedNames(): void {
    const collegeId = this.staffData?.collegeId;
    if (!collegeId) {
      this.collegeName = null;
    } else {
      const found = this.colleges.find((c) => c.id === collegeId);
      this.collegeName = found ? found.name : collegeId;
    }

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

    const numMatch = s.match(/^(\d+)(?:\s*(st|nd|rd|th))?(?:\s*year)?$/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      return `${ordinalSuffix(n)} Year`;
    }

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

    const anyDigit = s.match(/(\d+)/);
    if (anyDigit) {
      const n = parseInt(anyDigit[1], 10);
      return `${ordinalSuffix(n)} Year`;
    }

    const tc = s
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return tc.toLowerCase().includes('year') ? tc : `${tc} Year`;
  }
}
