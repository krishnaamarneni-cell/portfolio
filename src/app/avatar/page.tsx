"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Avatar3D = dynamic(() => import("@/components/Avatar3D"), { ssr: false });

export default function AvatarPreview() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <div className="min-h-screen bg-[#f0f0f0] flex items-center justify-center">
      <div className="text-center">
        <div className="w-[400px] h-[600px] mx-auto bg-gradient-to-b from-[#e8e8e8] to-[#d0d0d0] rounded-3xl flex items-center justify-center shadow-xl">
          <Avatar3D mouseX={mousePos.x} mouseY={mousePos.y} className="w-[350px] h-[550px]" />
        </div>
        <p className="mt-6 text-gray-500 text-sm">Move your mouse to interact</p>
      </div>
    </div>
  );
}
