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
  createdAt: string;
  updatedAt: string;
};

export type BidderWorkEntry = {
  id: string;
  bidderId: string;
  workDate: string;
  bidCount: number;
  interviewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BidderTransactionNetwork = "BEP20" | "ERC20" | "OTHER";

export type BidderTransaction = {
  id: string;
  bidderId: string;
  occurredOn: string;
  entryType: string;
  amount: number;
  network: BidderTransactionNetwork;
  status: string;
  txHash: string;
  createdAt: string;
  updatedAt: string;
};
