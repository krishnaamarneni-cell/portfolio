"use client";

import Navbar from "@/components/Navbar";
import ScrollProgress from "@/components/ScrollProgress";
import CursorGlow from "@/components/CursorGlow";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Skills from "@/components/Skills";
import Experience from "@/components/Experience";
import Projects from "@/components/Projects";
import Investments from "@/components/Investments";
import NotesPreview from "@/components/NotesPreview";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <CursorGlow />
      <Navbar />
      <main className="relative" style={{ overflowX: "clip" }}>
        <Hero />
        <div className="section-divider" />
        <About />
        <div className="section-divider" />
        <Experience />
        <div className="section-divider" />
        <Skills />
        <div className="section-divider" />
        <Projects />
        <div className="section-divider" />
        <Investments />
        <div className="section-divider" />
        <NotesPreview />
        <div className="section-divider" />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
