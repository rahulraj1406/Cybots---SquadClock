export type Squad = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

export type Member = {
  id: string;
  squad_id: string;
  user_id: string;
  display_name: string;
  timezone: string;
  created_at: string;
};

/** A slot as stored: UTC instants, no timezone attached. */
export type Slot = {
  id: string;
  squad_id: string;
  member_id: string;
  starts_at: string; // ISO 8601, UTC
  ends_at: string; // ISO 8601, UTC
  note: string | null;
  created_at: string;
};

export type SlotWithMember = Slot & {
  member: Pick<Member, "id" | "display_name" | "timezone">;
};

/** A window where 2+ members' slots overlap, in UTC. */
export type OverlapWindow = {
  starts_at: string;
  ends_at: string;
  memberIds: string[];
};
