export type Job = {
  id: string;
  title: string;
  category: string;
  company: string;
  location: string;
  period: string;
  logo_src: string | null;
  logo_bg: string;
  description: string;
  highlights: string[];
  tags: string[];
  notes: string | null;
  sort_order: number;
  created_at?: string;
};

export type Project = {
  id: string;
  title: string;
  subtitle: string;
  number: string;
  description: string;
  link: string;
  tags: string[];
  gradient: string;
  preview: string;
  sort_order: number;
  created_at?: string;
};

export type JobInput = Omit<Job, "id" | "created_at">;
export type ProjectInput = Omit<Project, "id" | "created_at">;

export type Thought = {
  id: string;
  title: string;
  body: string;
  raw_text: string | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ThoughtInput = Omit<Thought, "id" | "created_at" | "updated_at">;

export const EMPTY_THOUGHT: ThoughtInput = {
  title: "",
  body: "",
  raw_text: null,
  tags: [],
  published: false,
  published_at: null,
};

export const EMPTY_JOB: JobInput = {
  title: "",
  category: "",
  company: "",
  location: "",
  period: "",
  logo_src: null,
  logo_bg: "#1a1a1a",
  description: "",
  highlights: [],
  tags: [],
  notes: null,
  sort_order: 0,
};

export const EMPTY_PROJECT: ProjectInput = {
  title: "",
  subtitle: "",
  number: "01",
  description: "",
  link: "",
  tags: [],
  gradient: "from-[#ff6b00] to-[#ff8c38]",
  preview: "",
  sort_order: 0,
};
