// Shapes the record view reads, shared by src/lib/admin/record.ts and the
// view components. Types and one constant only; no data access.

export const HANDOVERS_PER_PAGE = 50;

export type BatchSummary = {
  id: string;
  label: string;
  source_filename: string | null;
  received_from: string | null;
  received_on: string | null;
  counts: { import_rows: number; trips: number; recipients: number; items: number; handovers: number };
};

export type BasisTotal = { basis: string; handovers: number; units: number; amount_usd: string };

export type KindCounts = { items: number; handovers: number; recipients: number; countries: number; trips: number };

export type RecipientOption = { id: string; name: string; department: string | null; city: string | null; country: string };

export type TripOption = { slug: string; title: string };

export type HandoverFact = {
  handover_id: string;
  handed_on: string | null;
  date_precision: string;
  handed_quantity: number;
  item_id: string;
  description: string;
  recipient_id: string;
  recipient_name: string;
  recipient_city: string | null;
  recipient_country: string;
  trip_slug: string | null;
};

export type HandoverFilters = { country?: string; recipient?: string; trip?: string };

export type ItemRecord = {
  item: {
    id: string;
    category: string | null;
    description: string;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    quantity: number;
    condition: string;
    year_made: number | null;
    note: string | null;
    batch_label: string;
    source_name: string | null;
  };
  valuations: { basis: string; amount_usd: string; per: string; method_note: string | null; valued_on: string | null; valued_by: string | null }[];
  handovers: HandoverFact[];
  followups: { handover_id: string; checked_on: string; in_service: boolean | null; checked_by: string | null; note: string | null }[];
  raw: { sheet: string; row_number: number; raw: Record<string, unknown> } | null;
};
