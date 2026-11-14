export type SpecialIssueType = 'Tabloid' | 'Newsletter' | 'Literary Folio';

export interface SpecialIssuePdfMetadata {
  originalFilename?: string | null;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  compressionPercent: number;
  pageCount: number;
  sha256?: string | null;
  compressionProfile?: string | null;
  processor?: string | null;
}

export interface SpecialIssueSaveProgress {
  phase: 'uploading' | 'processing' | 'saving' | 'ready';
  loaded: number;
  total?: number;
  percent?: number;
}

export interface SpecialIssue {
  id: string;
  title: string;
  slug:  string;
  type: SpecialIssueType;

  academicYear: string;
  description?: string;

  coverImage: string;
  pdfUrl: string;
  pdfMetadata?: SpecialIssuePdfMetadata | null;

  publishedAt: Date;
  status: 'published' | 'draft' | 'archived';
}
