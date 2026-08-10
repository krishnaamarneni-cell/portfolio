import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import SapChat from "./SapChat";

export const metadata: Metadata = {
  title: "SAP AI Assistant Demo · Krishna Amarneni",
  description:
    "Live demo: a single AI agent queries SAP S/4HANA sandbox OData APIs for material stock and purchase orders, then answers in plain English with data tables and dashboard cards.",
  openGraph: {
    title: "SAP AI Assistant — Live Demo",
    description:
      "Natural-language queries against SAP S/4HANA sandbox data. Material stock levels, purchase orders, and shortage analysis — powered by one agent with multiple tools.",
    type: "website",
  },
};

export default function SapPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 flex flex-col">
        <SapChat />
      </main>
    </>
  );
}
