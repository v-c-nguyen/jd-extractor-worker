export type ProfileEmail = {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
};

/** Metadata only; binary is served from GET /api/profiles/:id/attachments/:attachmentId */
export type ProfileAttachmentMeta = {
  id: string;
  originalName: string;
  mimeType: string;
  createdAt: string;
};

export type Profile = {
  id: string;
  name: string;
  country: string;
  status: string;
  field: string;
  linkedin: string;
  github: string;
  address: string;
  bidderId: string | null;
  bidderName: string | null;
  emails: ProfileEmail[];
  note: string;
  /** ISO `YYYY-MM-DD` or empty string when unset. Included in list for roster display. */
  dateOfBirth: string;
  /** Full SSN is sensitive; only included on single-profile fetch (not list). */
  ssnNumber: string;
  /** Driver license number; only included on single-profile fetch (not list). */
  dlNumber: string;
  /** Free text; only included on single-profile fetch (not list). */
  additionalInformation: string;
  attachments: ProfileAttachmentMeta[];
  createdAt: string;
  updatedAt: string;
};
