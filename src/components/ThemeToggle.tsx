"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { FiSun, FiMoon } from "react-icons/fi";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button className={`w-9 h-9 rounded-xl flex items-center justify-center ${className}`} aria-label="Toggle theme">
        <div className="w-4 h-4 rounded-full bg-current opacity-30" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 ${
        isDark
          ? "bg-white/10 text-amber-300 hover:bg-white/15"
          : "bg-black/5 text-amber-600 hover:bg-black/10"
      } ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <FiSun size={16} /> : <FiMoon size={16} />}
    </button>
  );
}
