"use client";

import { useState } from "react";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import { FiMail, FiMapPin, FiSend, FiLinkedin, FiGithub, FiArrowUpRight, FiChevronDown, FiBriefcase, FiUsers } from "react-icons/fi";

const faqs = [
  {
    q: "What technologies do you specialize in?",
    a: "I specialize in SAP (S/4HANA, BTP, ABAP, Fiori), full-stack web development (Next.js, React, TypeScript, Node.js), and AI/ML agent development. I bring a unique blend of enterprise SAP expertise and modern web technologies.",
  },
  {
    q: "Are you available for freelance or contract work?",
    a: "Yes! I'm open to freelance projects, contract roles, and full-time opportunities. Whether it's an SAP implementation, a web application, or an AI-powered solution, I'd love to discuss how I can help.",
  },
  {
    q: "What is your typical project process?",
    a: "I start with a discovery call to understand your needs, then provide a proposal with timeline and scope. Development follows an agile approach with regular check-ins. I prioritize clean code, thorough testing, and clear documentation.",
  },
  {
    q: "Do you work with teams or solo?",
    a: "Both! I've led cross-functional teams on large SAP implementations and also deliver end-to-end solo projects. I'm comfortable collaborating with designers, PMs, and other developers, or owning the full stack independently.",
  },
  {
    q: "What industries have you worked in?",
    a: "I've worked across FMCG (Coca-Cola, PepsiCo), pharmaceuticals (Xiromed), flavors & fragrances (IFF), and IT consulting (Denken Solutions, SaasIT). This cross-industry experience helps me understand diverse business requirements.",
  },
];

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [role, setRole] = useState<"recruiter" | "project" | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const roleText = role === "recruiter" ? "[Recruiter] " : role === "project" ? "[Project Inquiry] " : "";
    const subject = encodeURIComponent(`${roleText}Portfolio Contact from ${formData.name}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\nRole: ${role === "recruiter" ? "Recruiter" : role === "project" ? "Has a project" : "Not specified"}\n\n${formData.message}`
    );
    window.open(`mailto:krishna.amarneni@gmail.com?subject=${subject}&body=${body}`);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <section id="contact" className="relative py-28 lg:py-36 px-6 lg:px-10">
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#ff6b00]/[0.03] rounded-full blur-[200px]" />

      <div className="max-w-6xl mx-auto relative">
        <ScrollReveal direction="zoom3d">
          <div className="text-center mb-20">
            <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase">
              // Let&apos;s Connect
            </p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
              Got a project in
              <br />
              <span className="text-gradient">mind?</span>
            </h2>
            <p className="text-[#777] text-lg max-w-md mx-auto mb-10">
              I&apos;m always open to new opportunities, collaborations, and interesting projects.
            </p>

            {/* Role selection */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setRole("recruiter")}
                className={`group flex items-center gap-3 px-8 py-4 rounded-2xl border transition-all duration-300 text-sm font-semibold ${
                  role === "recruiter"
                    ? "bg-[#ff6b00] border-[#ff6b00] text-black"
                    : "border-white/[0.08] text-[#999] hover:border-[#ff6b00]/30 hover:text-white"
                }`}
              >
                <FiUsers size={20} className={role === "recruiter" ? "text-black" : "text-[#ff6b00]"} />
                I&apos;m a Recruiter
              </button>
              <button
                onClick={() => setRole("project")}
                className={`group flex items-center gap-3 px-8 py-4 rounded-2xl border transition-all duration-300 text-sm font-semibold ${
                  role === "project"
                    ? "bg-[#ff6b00] border-[#ff6b00] text-black"
                    : "border-white/[0.08] text-[#999] hover:border-[#ff6b00]/30 hover:text-white"
                }`}
              >
                <FiBriefcase size={20} className={role === "project" ? "text-black" : "text-[#ff6b00]"} />
                I Have a Project
              </button>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left info */}
          <div className="lg:col-span-2 space-y-5">
            {[
              { icon: FiMail, label: "Email", value: "krishna.amarneni@gmail.com", href: "mailto:krishna.amarneni@gmail.com" },
              { icon: FiMapPin, label: "Location", value: "New Jersey, USA", href: undefined },
            ].map((item, i) => {
              const dirs = ["flipY", "rotate3d"] as const;
              return (
                <ScrollReveal key={item.label} delay={i * 0.1} direction={dirs[i]}>
                  <TiltCard className="rounded-[20px]" intensity={15}>
                    <div className="card-dark card-3d-shine p-5 flex items-center gap-4 shadow-3d">
                      <div className="w-12 h-12 rounded-xl bg-[#ff6b00]/10 flex items-center justify-center shrink-0">
                        <item.icon className="text-[#ff6b00]" size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[#555] text-xs uppercase tracking-wider">{item.label}</p>
                        {item.href ? (
                          <a href={item.href} className="text-sm text-white hover:text-[#ff6b00] transition-colors truncate block">
                            {item.value}
                          </a>
                        ) : (
                          <p className="text-sm text-white">{item.value}</p>
                        )}
                      </div>
                    </div>
                  </TiltCard>
                </ScrollReveal>
              );
            })}

            <ScrollReveal delay={0.3} direction="rotate3d">
              <div className="flex gap-3 pt-4">
                {[
                  { icon: FiLinkedin, href: "https://linkedin.com/in/krishnaamarneni", label: "LinkedIn" },
                  { icon: FiGithub, href: "https://github.com/krishnaamarneni", label: "GitHub" },
                ].map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/[0.06] text-[#999] hover:text-[#ff6b00] hover:border-[#ff6b00]/20 hover:[transform:perspective(600px)_rotateY(5deg)] transition-all text-sm font-medium"
                  >
                    <Icon size={16} />
                    {label}
                    <FiArrowUpRight size={12} />
                  </a>
                ))}
              </div>
            </ScrollReveal>
          </div>

          {/* Form with 3D */}
          <ScrollReveal delay={0.2} direction="flipY" className="lg:col-span-3">
            <TiltCard className="rounded-[20px]" intensity={6}>
              <form
                onSubmit={handleSubmit}
                className="card-dark card-3d-shine p-8 lg:p-10 space-y-6 shadow-3d"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wider mb-2 block">Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-5 py-3.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#ff6b00]/40 transition-colors"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="text-[#555] text-xs uppercase tracking-wider mb-2 block">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-5 py-3.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#ff6b00]/40 transition-colors"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[#555] text-xs uppercase tracking-wider mb-2 block">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-5 py-3.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#ff6b00]/40 transition-colors resize-none"
                    placeholder={
                      role === "recruiter"
                        ? "Tell me about the role and your company..."
                        : role === "project"
                        ? "Tell me about your project requirements..."
                        : "Tell me about your project..."
                    }
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-[#ff6b00] text-black font-semibold flex items-center justify-center gap-2 hover:bg-[#ff8c38] hover:shadow-xl hover:shadow-[#ff6b00]/20 hover:[transform:perspective(600px)_rotateX(-2deg)_scale(1.02)] active:scale-[0.98] transition-all duration-300 text-base"
                >
                  {submitted ? (
                    "Opening email..."
                  ) : (
                    <>
                      <FiSend size={18} />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </TiltCard>
          </ScrollReveal>
        </div>

        {/* FAQ Section */}
        <div className="mt-28">
          <ScrollReveal direction="flipX">
            <p className="text-[#ff6b00] text-sm font-mono mb-4 tracking-[0.3em] uppercase text-center">
              // FAQ
            </p>
            <h3 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
              Frequently Asked <span className="text-gradient">Questions</span>
            </h3>
          </ScrollReveal>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, i) => (
              <ScrollReveal key={i} delay={i * 0.05} direction="zoom3d">
                <div
                  className="border border-white/[0.06] rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/[0.1]"
                  style={{ background: openFaq === i ? "rgba(255,107,0,0.03)" : "rgba(255,255,255,0.01)" }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left"
                  >
                    <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                    <FiChevronDown
                      size={18}
                      className={`text-[#ff6b00] shrink-0 transition-transform duration-300 ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-300"
                    style={{
                      maxHeight: openFaq === i ? "200px" : "0px",
                      opacity: openFaq === i ? 1 : 0,
                    }}
                  >
                    <p className="px-6 pb-5 text-sm text-[#888] leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
