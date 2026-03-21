export interface ContentSettigns {
  autoPublish: boolean;
  requiredApproval: boolean;
  allowDrafts: boolean;

  schedulingEnabled: boolean;
  defaultPublishDelayMinutes: number;
  contentExpirationDays: number | null;

  requiredFeatureImage: boolean;
  allowMultipleCategories: boolean;
  allowTags: boolean;

  maxWordCount: number | null;

  enableRevisionHistory: boolean;

  maxImageSizeMB: number;
  allowedFileTypes: string[];

  enableMediaCompression:  boolean;
}
