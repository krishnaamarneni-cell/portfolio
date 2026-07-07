export type CRMTab =
  | "contacts"
  | "companies"
  | "conversations"
  | "audience"
  | "exclusions"
  | "enrichment";

export type ContactType =
  | "recruiter"
  | "hiring_manager"
  | "visa"
  | "personal"
  | "colleague"
  | "business"
  | "vendor"
  | "unknown";

export type Contact = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  company_id: string | null;
  role_pitched: string | null;
  match_pct: number | null;
  source: string;
  notes: string | null;
  starred: boolean;
  emailed_at: string | null;
  times_contacted: number;
  contact_type: ContactType;
  tags: string[];
  do_not_contact: boolean;
  excluded_from_bulk: boolean;
  priority: number | null;
  phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  last_gmail_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Company = {
  id: string;
  name: string;
  domain: string;
  aliases: string[];
  industry: string | null;
  notes: string | null;
  contact_count: number;
  last_activity_at: string | null;
  is_current_employer: boolean;
  excluded_from_bulk: boolean;
  created_at: string;
  updated_at: string;
};

export type CachedThread = {
  id: string;
  gmail_thread_id: string;
  contact_id: string | null;
  company_id: string | null;
  subject: string | null;
  snippet: string | null;
  message_count: number;
  last_message_at: string | null;
  participants: string[];
  direction: string;
  intent: string | null;
  intent_confidence: number | null;
  cached_messages: ThreadMessage[] | null;
  synced_at: string;
  created_at: string;
};

export type ThreadMessage = {
  id: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
};

export type Enrichment = {
  id: string;
  contact_id: string;
  field: string;
  suggested_value: string;
  source: string;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  created_at: string;
};

export type Exclusion = {
  id: string;
  exclusion_type: string;
  exclusion_value: string;
  reason: string | null;
  is_permanent: boolean;
  active: boolean;
  created_at: string;
};

export const CONTACT_TYPES: { value: ContactType; label: string; color: string }[] = [
  { value: "recruiter", label: "Recruiter", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "hiring_manager", label: "Hiring Manager", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "visa", label: "Visa/Immigration", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "personal", label: "Personal", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "colleague", label: "Colleague", color: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "business", label: "Business", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "vendor", label: "Vendor", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "unknown", label: "Unknown", color: "bg-gray-50 text-gray-500 border-gray-200" },
];

export function typeInfo(t: ContactType) {
  return CONTACT_TYPES.find((ct) => ct.value === t) ?? CONTACT_TYPES[7];
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
