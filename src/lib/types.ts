/** Rows as they come from the database (see supabase/migrations). */

export type Role = "owner" | "manager" | "cashier" | "kitchen";
export type Diet = "veg" | "egg" | "nonveg";
export type LineStatus = "pending" | "queued" | "cooking" | "ready" | "served" | "cancelled";
export type CallKind = "waiter" | "water" | "cutlery" | "bill" | "help";

export type Restaurant = {
  id: string;
  slug: string;
  name: string;
  place: string | null;
  gstin: string | null;
  gst_pct: number;
  upi_vpa: string | null;
  upi_name: string | null;
  confirm_first_order: boolean;
  pay_at_table: boolean;
  stamps_for_reward: number;
  stamp_min_bill: number;
  reward_text: string;
  reward_value: number;
  google_review_url: string | null;
  cover_url: string | null;
  logo_url: string | null;
  tagline: string | null;
  offer_title: string | null;
  offer_text: string | null;
  /** Set on a visitor's private trial copy: when it is deleted. */
  expires_at?: string | null;
};

export type Staff = { user_id: string; restaurant_id: string; name: string; username: string; role: Role; active: boolean };

export type Category = {
  id: string;
  restaurant_id: string;
  name: string;
  note: string | null;
  sort: number;
  /** "07:00:00" style, India time. Null means all day. */
  available_from: string | null;
  available_to: string | null;
};

export type Option = { id: string; label: string; price: number };

export type MenuItem = {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  local_name: string | null;
  description: string | null;
  price: number;
  diet: Diet;
  spice: number;
  station: string;
  prep_minutes: number;
  tags: string[];
  variants: Option[];
  addons: Option[];
  serves: number | null;
  image_url: string | null;
  available: boolean;
  sort: number;
};

export type DiningTable = { id: string; restaurant_id: string; label: string; area: string; seats: number; qr_token: string; sort: number };

export type Member = {
  id: string;
  restaurant_id: string;
  phone: string;
  name: string | null;
  visits: number;
  stamps: number;
  rewards_ready: number;
  spend: number;
  birthday: string | null;
  opt_in: boolean;
  last_visit: string | null;
  joined_at: string;
};

export type Session = {
  id: string;
  restaurant_id: string;
  table_id: string;
  status: "seated" | "bill" | "paid" | "closed";
  guests: number;
  member_id: string | null;
  bill_no: number | null;
  discount_label: string | null;
  discount: number;
  stamped: boolean;
  subtotal: number | null;
  total: number | null;
  via_qr: boolean;
  opened_at: string;
  bill_requested_at: string | null;
  paid_at: string | null;
  closed_at: string | null;
};

export type Order = {
  id: string;
  restaurant_id: string;
  session_id: string;
  kot: number;
  source: "qr" | "staff";
  placed_at: string;
  confirmed_at: string | null;
};

export type Line = {
  id: string;
  restaurant_id: string;
  order_id: string;
  session_id: string;
  item_id: string | null;
  name: string;
  variant: string | null;
  addons: string[];
  qty: number;
  unit_price: number;
  note: string | null;
  station: string;
  status: LineStatus;
  created_at: string;
  fired_at: string | null;
  ready_at: string | null;
  served_at: string | null;
};

export type Payment = {
  id: string;
  restaurant_id: string;
  session_id: string;
  mode: "upi" | "cash" | "card" | "gift";
  amount: number;
  status: "claimed" | "confirmed" | "rejected";
  ref: string | null;
  at: string;
};

export type Call = { id: string; restaurant_id: string; table_id: string; kind: CallKind; at: string; resolved_at: string | null };

export type GiftCard = { id: string; restaurant_id: string; code: string; value: number; balance: number; from_name: string | null; to_name: string | null; issued_at: string };

export type Feedback = {
  id: string;
  restaurant_id: string;
  session_id: string | null;
  table_label: string | null;
  guest_name: string | null;
  food: number;
  service: number;
  comment: string | null;
  route: "google-ask" | "manager";
  handled: boolean;
  at: string;
};

export type Campaign = { id: string; name: string; segment: string; message: string; recipients: number; created_at: string };
