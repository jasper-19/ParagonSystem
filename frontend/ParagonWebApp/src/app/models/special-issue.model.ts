export type SpecialIssueType = 'Tabloid' | 'Newsletter' | 'Literary Folio';

export interface SpecialIssue {
  id: string;
  title: string;
  slug:  string;
  type: SpecialIssueType;

  academicYear: string;
  description?: string;

  coverImage: string;
  pdfUrl: string;

  publishedAt: Date;
  status: 'published' | 'draft' | 'archived';
}
