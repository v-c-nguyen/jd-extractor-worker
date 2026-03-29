export type BidderContact = {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
};

export type Bidder = {
  id: string;
  name: string;
  country: string;
  contacts: BidderContact[];
  rate: { currency: string; amount: number };
  status: string;
  role: string;
  note: string;
  /** Set on the bidder row (bidders.app_user_id); that user signs in as this bidder. */
  appUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BidderWorkEntry = {
  id: string;
  bidderId: string;
  profileId: string;
  profileName: string;
  workDate: string;
  bidCount: number;
  interviewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BidderTransactionNetwork = "BEP20" | "ERC20" | "OTHER";

export type BidderTransactionStatus = "Pending" | "Confirmed" | "Paid";

export type BidderTransaction = {
  id: string;
  bidderId: string;
  occurredOn: string;
  entryType: string;
  amount: number;
  network: BidderTransactionNetwork;
  status: BidderTransactionStatus;
  txHash: string;
  createdAt: string;
  updatedAt: string;
};
