/* Every editable string/value on the public homepage. */

export type HeroSection = {
  first_name: string;
  last_name: string;
  tagline_left: string;
  tagline_right: string;
  roles: string[];
  location: string;
  timezone: string;
};

export type AboutHighlight = {
  icon: "Cpu" | "Code" | "Database" | "Globe";
  title: string;
  description: string;
  accent: string;
};

export type AboutStat = { value: string; label: string };

export type AboutSocial = {
  platform: "X" | "Instagram" | "YouTube" | "LinkedIn" | "GitHub";
  href: string;
};

export type AboutSection = {
  eyebrow: string;
  heading_pre: string;
  heading_accent: string;
  paragraph_one: string;
  paragraph_two: string;
  stats: AboutStat[];
  highlights: AboutHighlight[];
  socials: AboutSocial[];
  trust_blurb: string;
  calendly_url: string;
  resume_url: string;
  email_for_copy: string;
};

export type SkillsService = {
  num: string;
  title: string;
  description: string;
  tools: string[];
};

export type SkillsSection = {
  eyebrow: string;
  heading_pre: string;
  heading_accent: string;
  intro: string;
  skills: string[];
  services: SkillsService[];
};

export type BookSection = {
  eyebrow: string;
  heading_pre: string;
  heading_accent: string;
  intro: string;
  status_badge: string;
  publisher_tag: string;
  title: string;
  subtitle: string;
  blurb_paragraphs: string[];
  chapters: string[];
  pdf_url: string;
  cover_publisher_text: string;
  cover_title_line_1: string;
  cover_title_line_2: string;
  cover_subtitle: string;
  cover_author: string;
  // Back cover
  back_synopsis: string[];
  back_praise_quote: string;
  back_praise_attribution: string;
  back_author_bio: string;
  back_isbn: string;
  // Inside (page spread modal)
  prologue_title: string;
  prologue_text: string[];
};

export type Holding = {
  ticker: string;
  name: string;
  thesis: string;
  category: "Public" | "Private";
  brand_color: string;
  link?: string;
};

export type InvestmentsSection = {
  eyebrow: string;
  heading_pre: string;
  heading_accent: string;
  intro: string;
  disclaimer: string;
  public_label: string;
  private_label: string;
  public_holdings: Holding[];
  private_holdings: Holding[];
};

export type FAQ = { question: string; answer: string };

export type ContactSection = {
  eyebrow: string;
  heading_pre: string;
  heading_accent: string;
  intro: string;
  email: string;
  location: string;
  linkedin: string;
  github: string;
  faqs: FAQ[];
};

export type SeoSection = {
  page_title: string;
  description: string;
  keywords: string[];
};

export type SiteContent = {
  hero: HeroSection;
  about: AboutSection;
  skills: SkillsSection;
  book: BookSection;
  investments: InvestmentsSection;
  contact: ContactSection;
  seo: SeoSection;
};
