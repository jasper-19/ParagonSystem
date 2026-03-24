export type MediaType = 'image' | 'video' | 'document' | 'audio';

export interface Media {
  id: string;

  fileName: string;
  filePath: string;
  fileUrl?: string;

  fileType: MediaType;
  mimeType: string;

  size: number;

  width?: number;
  height?: number;

  altText?: string;
  caption?: string;

  tags?: string[];

  createdAt: string;
  updatedAt?: string;
}

export interface MediaQuery {
  search?: string;
  type?: MediaType;
  page?: number;
  limit?: number;
}

export interface PaginatedMediaResponse {
  data: Media[];
  total: number;
  page: number;
  limit: number;
}
