export type ProfileEmail = {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
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
  createdAt: string;
  updatedAt: string;
};
