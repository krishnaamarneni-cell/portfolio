"use client";

import { useState } from "react";
import { FiSave, FiPlus, FiX, FiChevronDown, FiChevronRight } from "react-icons/fi";
import type {
  SiteContent,
  HeroSection,
  AboutSection,
  AboutHighlight,
  AboutStat,
  AboutSocial,
  SkillsSection,
  SkillsService,
  BookSection,
  InvestmentsSection,
  Holding,
  ContactSection,
  FAQ,
  SeoSection,
} from "@/lib/site-content-types";

type Props = {
  initial: SiteContent;
  onSaved: (content: SiteContent) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

const inputClass =
  "w-full px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/[0.08] focus:border-[#ff6b00]/60 focus:outline-none text-sm text-white placeholder:text-[#555] transition-colors";
const textareaClass = inputClass + " resize-y";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-mono tracking-[0.15em] uppercase text-[#888] mb-2">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-[#555] mt-1.5">{hint}</span>}
    </label>
  );
}

function Section({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/[0.06] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-white/[0.02]"
      >
        <div>
          <h3 className="font-bold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-[#666] mt-0.5">{subtitle}</p>}
        </div>
        {open ? (
          <FiChevronDown size={18} className="text-[#888]" />
        ) : (
          <FiChevronRight size={18} className="text-[#888]" />
        )}
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-white/[0.06] pt-5 space-y-4">{children}</div>
      )}
    </div>
  );
}

function ListEditor<T>({
  items,
  onChange,
  emptyTemplate,
  renderItem,
  label,
  addLabel,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  emptyTemplate: () => T;
  renderItem: (item: T, set: (next: T) => void) => React.ReactNode;
  label?: string;
  addLabel?: string;
}) {
  function set(i: number, next: T) {
    const copy = [...items];
    copy[i] = next;
    onChange(copy);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, emptyTemplate()]);
  }
  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }
  return (
    <div className="space-y-3">
      {label && (
        <div className="text-xs font-mono tracking-[0.15em] uppercase text-[#888]">
          {label}
        </div>
      )}
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-xl bg-[#0f0f0f] border border-white/[0.06] p-4 relative"
        >
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="text-xs px-2 py-0.5 rounded text-[#666] hover:text-white disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === items.length - 1}
              className="text-xs px-2 py-0.5 rounded text-[#666] hover:text-white disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-xs w-6 h-6 rounded-full text-[#666] hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"
              title="Remove"
            >
              <FiX size={12} />
            </button>
          </div>
          {renderItem(item, (next) => set(i, next))}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 text-sm text-[#ff6b00] hover:text-[#ff8c38] font-medium"
      >
        <FiPlus size={14} />
        {addLabel ?? "Add"}
      </button>
    </div>
  );
}

function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  function set(i: number, v: string) {
    const copy = [...items];
    copy[i] = v;
    onChange(copy);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...items, ""]);
  }
  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }
  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={v}
            onChange={(e) => set(i, e.target.value)}
            className={inputClass}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => move(i, -1)}
            disabled={i === 0}
            className="text-xs px-2 text-[#666] hover:text-white disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(i, 1)}
            disabled={i === items.length - 1}
            className="text-xs px-2 text-[#666] hover:text-white disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => remove(i)}
            className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-red-500/10 hover:text-red-400 text-[#666] flex items-center justify-center shrink-0"
          >
            <FiX size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 text-sm text-[#ff6b00] hover:text-[#ff8c38] font-medium"
      >
        <FiPlus size={14} />
        {addLabel ?? "Add"}
      </button>
    </div>
  );
}

/* ============== section editors ============== */

function HeroEditor({
  value,
  onChange,
}: {
  value: HeroSection;
  onChange: (next: HeroSection) => void;
}) {
  const set = <K extends keyof HeroSection>(k: K, v: HeroSection[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="First name (huge text)">
          <input
            value={value.first_name}
            onChange={(e) => set("first_name", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Last name (huge text)">
          <input
            value={value.last_name}
            onChange={(e) => set("last_name", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Tagline left">
          <input
            value={value.tagline_left}
            onChange={(e) => set("tagline_left", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Tagline right">
          <input
            value={value.tagline_right}
            onChange={(e) => set("tagline_right", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Location">
          <input
            value={value.location}
            onChange={(e) => set("location", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Timezone" hint="IANA name, e.g. America/New_York">
          <input
            value={value.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Animated roles" hint="Cycle through in the hero typing effect.">
        <StringListEditor
          items={value.roles}
          onChange={(roles) => set("roles", roles)}
          placeholder="e.g. AI Agent Developer"
          addLabel="Add role"
        />
      </Field>
    </>
  );
}

function AboutEditor({
  value,
  onChange,
}: {
  value: AboutSection;
  onChange: (next: AboutSection) => void;
}) {
  const set = <K extends keyof AboutSection>(k: K, v: AboutSection[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Eyebrow">
          <input
            value={value.eyebrow}
            onChange={(e) => set("eyebrow", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Email (used for Copy button)">
          <input
            value={value.email_for_copy}
            onChange={(e) => set("email_for_copy", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Heading (pre)" hint="Goes before the accent word. \n for new line.">
          <textarea
            rows={2}
            value={value.heading_pre}
            onChange={(e) => set("heading_pre", e.target.value)}
            className={textareaClass}
          />
        </Field>
        <Field label="Heading accent (orange)">
          <input
            value={value.heading_accent}
            onChange={(e) => set("heading_accent", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Paragraph one">
        <textarea
          rows={4}
          value={value.paragraph_one}
          onChange={(e) => set("paragraph_one", e.target.value)}
          className={textareaClass}
        />
      </Field>
      <Field label="Paragraph two">
        <textarea
          rows={4}
          value={value.paragraph_two}
          onChange={(e) => set("paragraph_two", e.target.value)}
          className={textareaClass}
        />
      </Field>
      <Field label="Stats (3 shown)">
        <ListEditor<AboutStat>
          items={value.stats}
          onChange={(stats) => set("stats", stats)}
          emptyTemplate={() => ({ value: "", label: "" })}
          addLabel="Add stat"
          renderItem={(item, setItem) => (
            <div className="grid grid-cols-2 gap-3 pr-20">
              <input
                value={item.value}
                onChange={(e) => setItem({ ...item, value: e.target.value })}
                className={inputClass}
                placeholder="Value (e.g. 7+)"
              />
              <input
                value={item.label}
                onChange={(e) => setItem({ ...item, label: e.target.value })}
                className={inputClass}
                placeholder="Label"
              />
            </div>
          )}
        />
      </Field>
      <Field label="Highlight cards">
        <ListEditor<AboutHighlight>
          items={value.highlights}
          onChange={(hl) => set("highlights", hl)}
          emptyTemplate={() => ({
            icon: "Cpu",
            title: "",
            description: "",
            accent: "#ff6b00",
          })}
          addLabel="Add highlight"
          renderItem={(item, setItem) => (
            <div className="space-y-3 pr-20">
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={item.icon}
                  onChange={(e) =>
                    setItem({ ...item, icon: e.target.value as AboutHighlight["icon"] })
                  }
                  className={inputClass}
                >
                  <option value="Cpu">Cpu</option>
                  <option value="Code">Code</option>
                  <option value="Database">Database</option>
                  <option value="Globe">Globe</option>
                </select>
                <input
                  value={item.title}
                  onChange={(e) => setItem({ ...item, title: e.target.value })}
                  className={inputClass}
                  placeholder="Title"
                />
                <input
                  type="color"
                  value={item.accent}
                  onChange={(e) => setItem({ ...item, accent: e.target.value })}
                  className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#1a1a1a]"
                />
              </div>
              <textarea
                rows={2}
                value={item.description}
                onChange={(e) => setItem({ ...item, description: e.target.value })}
                className={textareaClass}
                placeholder="Description"
              />
            </div>
          )}
        />
      </Field>
      <Field label="Social links">
        <ListEditor<AboutSocial>
          items={value.socials}
          onChange={(socials) => set("socials", socials)}
          emptyTemplate={() => ({ platform: "X", href: "" })}
          addLabel="Add social"
          renderItem={(item, setItem) => (
            <div className="grid grid-cols-3 gap-3 pr-20">
              <select
                value={item.platform}
                onChange={(e) =>
                  setItem({ ...item, platform: e.target.value as AboutSocial["platform"] })
                }
                className={inputClass}
              >
                <option value="X">X</option>
                <option value="Instagram">Instagram</option>
                <option value="YouTube">YouTube</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="GitHub">GitHub</option>
              </select>
              <input
                value={item.href}
                onChange={(e) => setItem({ ...item, href: e.target.value })}
                className={`${inputClass} col-span-2`}
                placeholder="https://…"
              />
            </div>
          )}
        />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Trust blurb">
          <input
            value={value.trust_blurb}
            onChange={(e) => set("trust_blurb", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Calendly URL">
          <input
            value={value.calendly_url}
            onChange={(e) => set("calendly_url", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Resume URL">
          <input
            value={value.resume_url}
            onChange={(e) => set("resume_url", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
    </>
  );
}

function SkillsEditor({
  value,
  onChange,
}: {
  value: SkillsSection;
  onChange: (next: SkillsSection) => void;
}) {
  const set = <K extends keyof SkillsSection>(k: K, v: SkillsSection[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Eyebrow">
          <input
            value={value.eyebrow}
            onChange={(e) => set("eyebrow", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Heading (pre)">
          <input
            value={value.heading_pre}
            onChange={(e) => set("heading_pre", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Heading accent">
          <input
            value={value.heading_accent}
            onChange={(e) => set("heading_accent", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Intro">
        <textarea
          rows={3}
          value={value.intro}
          onChange={(e) => set("intro", e.target.value)}
          className={textareaClass}
        />
      </Field>
      <Field
        label="Skill marquee"
        hint="Shown as scrolling chips. Names you've used before get a matching icon automatically."
      >
        <StringListEditor
          items={value.skills}
          onChange={(skills) => set("skills", skills)}
          placeholder="e.g. Next.js"
          addLabel="Add skill"
        />
      </Field>
      <Field label="Service cards (4 shown best)">
        <ListEditor<SkillsService>
          items={value.services}
          onChange={(services) => set("services", services)}
          emptyTemplate={() => ({ num: "", title: "", description: "", tools: [] })}
          addLabel="Add service"
          renderItem={(item, setItem) => (
            <div className="space-y-3 pr-20">
              <div className="grid grid-cols-[80px_1fr] gap-3">
                <input
                  value={item.num}
                  onChange={(e) => setItem({ ...item, num: e.target.value })}
                  className={inputClass}
                  placeholder="01"
                />
                <input
                  value={item.title}
                  onChange={(e) => setItem({ ...item, title: e.target.value })}
                  className={inputClass}
                  placeholder="Title"
                />
              </div>
              <textarea
                rows={2}
                value={item.description}
                onChange={(e) => setItem({ ...item, description: e.target.value })}
                className={textareaClass}
                placeholder="Description"
              />
              <StringListEditor
                items={item.tools}
                onChange={(tools) => setItem({ ...item, tools })}
                placeholder="Tool"
                addLabel="Add tool"
              />
            </div>
          )}
        />
      </Field>
    </>
  );
}

function BookEditor({
  value,
  onChange,
}: {
  value: BookSection;
  onChange: (next: BookSection) => void;
}) {
  const set = <K extends keyof BookSection>(k: K, v: BookSection[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Eyebrow">
          <input
            value={value.eyebrow}
            onChange={(e) => set("eyebrow", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Status badge">
          <input
            value={value.status_badge}
            onChange={(e) => set("status_badge", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Heading (pre)">
          <input
            value={value.heading_pre}
            onChange={(e) => set("heading_pre", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Heading accent">
          <input
            value={value.heading_accent}
            onChange={(e) => set("heading_accent", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Publisher tag">
          <input
            value={value.publisher_tag}
            onChange={(e) => set("publisher_tag", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="PDF URL">
          <input
            value={value.pdf_url}
            onChange={(e) => set("pdf_url", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Intro">
        <textarea
          rows={2}
          value={value.intro}
          onChange={(e) => set("intro", e.target.value)}
          className={textareaClass}
        />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Book title">
          <input
            value={value.title}
            onChange={(e) => set("title", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Book subtitle">
          <input
            value={value.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Blurb paragraphs">
        <StringListEditor
          items={value.blurb_paragraphs}
          onChange={(blurb_paragraphs) => set("blurb_paragraphs", blurb_paragraphs)}
          placeholder="Paragraph text"
          addLabel="Add paragraph"
        />
      </Field>
      <Field label="Chapters list">
        <StringListEditor
          items={value.chapters}
          onChange={(chapters) => set("chapters", chapters)}
          placeholder="Chapter title"
          addLabel="Add chapter"
        />
      </Field>
      <div className="rounded-xl border border-dashed border-[#ff6b00]/30 p-4 space-y-3">
        <p className="text-xs font-mono tracking-[0.15em] uppercase text-[#ff8c38]">
          Cover artwork text
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Publisher (top tiny text)">
            <input
              value={value.cover_publisher_text}
              onChange={(e) => set("cover_publisher_text", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Author (bottom)">
            <input
              value={value.cover_author}
              onChange={(e) => set("cover_author", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Title line 1">
            <input
              value={value.cover_title_line_1}
              onChange={(e) => set("cover_title_line_1", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Title line 2">
            <input
              value={value.cover_title_line_2}
              onChange={(e) => set("cover_title_line_2", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Cover subtitle">
            <input
              value={value.cover_subtitle}
              onChange={(e) => set("cover_subtitle", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </div>
    </>
  );
}

function HoldingsFields({
  value,
  onChange,
}: {
  value: Holding;
  onChange: (next: Holding) => void;
}) {
  const set = <K extends keyof Holding>(k: K, v: Holding[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3 pr-20">
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <input
          value={value.ticker}
          onChange={(e) => set("ticker", e.target.value)}
          className={inputClass}
          placeholder="TICKER"
        />
        <input
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputClass}
          placeholder="Full name"
        />
      </div>
      <textarea
        rows={2}
        value={value.thesis}
        onChange={(e) => set("thesis", e.target.value)}
        className={textareaClass}
        placeholder="Thesis"
      />
      <div className="grid grid-cols-3 gap-3">
        <select
          value={value.category}
          onChange={(e) => set("category", e.target.value as "Public" | "Private")}
          className={inputClass}
        >
          <option value="Public">Public</option>
          <option value="Private">Private</option>
        </select>
        <input
          type="color"
          value={value.brand_color}
          onChange={(e) => set("brand_color", e.target.value)}
          className="h-10 w-full rounded-lg border border-white/[0.08] bg-[#1a1a1a]"
        />
        <input
          value={value.link ?? ""}
          onChange={(e) => set("link", e.target.value || undefined)}
          className={inputClass}
          placeholder="Optional link"
        />
      </div>
    </div>
  );
}

function InvestmentsEditor({
  value,
  onChange,
}: {
  value: InvestmentsSection;
  onChange: (next: InvestmentsSection) => void;
}) {
  const set = <K extends keyof InvestmentsSection>(k: K, v: InvestmentsSection[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Eyebrow">
          <input
            value={value.eyebrow}
            onChange={(e) => set("eyebrow", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Heading (pre)">
          <input
            value={value.heading_pre}
            onChange={(e) => set("heading_pre", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Heading accent" hint="Word before 'lives'">
          <input
            value={value.heading_accent}
            onChange={(e) => set("heading_accent", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Public section label">
          <input
            value={value.public_label}
            onChange={(e) => set("public_label", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Private section label">
          <input
            value={value.private_label}
            onChange={(e) => set("private_label", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Intro">
        <textarea
          rows={2}
          value={value.intro}
          onChange={(e) => set("intro", e.target.value)}
          className={textareaClass}
        />
      </Field>
      <Field label="Disclaimer">
        <input
          value={value.disclaimer}
          onChange={(e) => set("disclaimer", e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Public holdings">
        <ListEditor<Holding>
          items={value.public_holdings}
          onChange={(public_holdings) => set("public_holdings", public_holdings)}
          emptyTemplate={() => ({
            ticker: "",
            name: "",
            thesis: "",
            category: "Public",
            brand_color: "#ff6b00",
          })}
          addLabel="Add public position"
          renderItem={(item, setItem) => (
            <HoldingsFields value={item} onChange={setItem} />
          )}
        />
      </Field>
      <Field label="Private holdings">
        <ListEditor<Holding>
          items={value.private_holdings}
          onChange={(private_holdings) => set("private_holdings", private_holdings)}
          emptyTemplate={() => ({
            ticker: "",
            name: "",
            thesis: "",
            category: "Private",
            brand_color: "#ff6b00",
          })}
          addLabel="Add private position"
          renderItem={(item, setItem) => (
            <HoldingsFields value={item} onChange={setItem} />
          )}
        />
      </Field>
    </>
  );
}

function ContactEditor({
  value,
  onChange,
}: {
  value: ContactSection;
  onChange: (next: ContactSection) => void;
}) {
  const set = <K extends keyof ContactSection>(k: K, v: ContactSection[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Eyebrow">
          <input
            value={value.eyebrow}
            onChange={(e) => set("eyebrow", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Heading (pre)">
          <input
            value={value.heading_pre}
            onChange={(e) => set("heading_pre", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Heading accent">
          <input
            value={value.heading_accent}
            onChange={(e) => set("heading_accent", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            value={value.email}
            onChange={(e) => set("email", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Location">
          <input
            value={value.location}
            onChange={(e) => set("location", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="LinkedIn URL">
          <input
            value={value.linkedin}
            onChange={(e) => set("linkedin", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="GitHub URL">
          <input
            value={value.github}
            onChange={(e) => set("github", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Intro">
        <textarea
          rows={2}
          value={value.intro}
          onChange={(e) => set("intro", e.target.value)}
          className={textareaClass}
        />
      </Field>
      <Field label="FAQs">
        <ListEditor<FAQ>
          items={value.faqs}
          onChange={(faqs) => set("faqs", faqs)}
          emptyTemplate={() => ({ question: "", answer: "" })}
          addLabel="Add FAQ"
          renderItem={(item, setItem) => (
            <div className="space-y-3 pr-20">
              <input
                value={item.question}
                onChange={(e) => setItem({ ...item, question: e.target.value })}
                className={inputClass}
                placeholder="Question"
              />
              <textarea
                rows={3}
                value={item.answer}
                onChange={(e) => setItem({ ...item, answer: e.target.value })}
                className={textareaClass}
                placeholder="Answer"
              />
            </div>
          )}
        />
      </Field>
    </>
  );
}

function SeoEditor({
  value,
  onChange,
}: {
  value: SeoSection;
  onChange: (next: SeoSection) => void;
}) {
  const set = <K extends keyof SeoSection>(k: K, v: SeoSection[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <>
      <Field label="Page title">
        <input
          value={value.page_title}
          onChange={(e) => set("page_title", e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Meta description">
        <textarea
          rows={3}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          className={textareaClass}
        />
      </Field>
      <Field label="Keywords">
        <StringListEditor
          items={value.keywords}
          onChange={(keywords) => set("keywords", keywords)}
          placeholder="Keyword"
          addLabel="Add keyword"
        />
      </Field>
    </>
  );
}

/* ============== root component ============== */

export default function SiteContentEditor({
  initial,
  onSaved,
  onError,
  onSuccess,
}: Props) {
  const [draft, setDraft] = useState<SiteContent>(initial);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/site-content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      onError(data.error || "Save failed");
      return;
    }
    onSaved(data.content as SiteContent);
    onSuccess("Site content saved");
  }

  function reset() {
    if (confirm("Discard local edits and reload the saved version?")) {
      setDraft(initial);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold">Site Content</h2>
          <p className="text-xs text-[#666] mt-1">
            Edit everything that appears on the public homepage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-full text-sm border border-white/10 text-[#888] hover:text-white hover:border-white/30"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-60"
          >
            <FiSave size={14} />
            {saving ? "Saving…" : "Save all"}
          </button>
        </div>
      </div>

      <Section title="Hero" subtitle="Name, taglines, animated roles" defaultOpen>
        <HeroEditor value={draft.hero} onChange={(v) => update("hero", v)} />
      </Section>
      <Section title="About" subtitle="Bio, stats, highlights, socials">
        <AboutEditor value={draft.about} onChange={(v) => update("about", v)} />
      </Section>
      <Section title="Skills" subtitle="Skill marquee + service cards">
        <SkillsEditor value={draft.skills} onChange={(v) => update("skills", v)} />
      </Section>
      <Section title="Book" subtitle="Drive to Freedom — copy, chapters, cover">
        <BookEditor value={draft.book} onChange={(v) => update("book", v)} />
      </Section>
      <Section title="Investments" subtitle="Public and private holdings">
        <InvestmentsEditor
          value={draft.investments}
          onChange={(v) => update("investments", v)}
        />
      </Section>
      <Section title="Contact" subtitle="Email, socials, FAQs">
        <ContactEditor value={draft.contact} onChange={(v) => update("contact", v)} />
      </Section>
      <Section title="SEO" subtitle="Page title, meta description, keywords">
        <SeoEditor value={draft.seo} onChange={(v) => update("seo", v)} />
      </Section>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#ff6b00] to-[#ff8c38] text-black font-bold text-sm shadow-[0_4px_20px_rgba(255,107,0,0.4)] hover:scale-[1.02] disabled:opacity-60"
        >
          <FiSave size={14} />
          {saving ? "Saving…" : "Save all changes"}
        </button>
      </div>
    </section>
  );
}
