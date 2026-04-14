"use client";

interface AvatarProps {
  mouseX: number;
  mouseY: number;
}

export default function Avatar({ mouseX, mouseY }: AvatarProps) {
  const ex = mouseX * 3;
  const ey = mouseY * 2;

  return (
    <div className="relative w-[150px] h-[340px] sm:w-[170px] sm:h-[380px] md:w-[210px] md:h-[460px] lg:w-[240px] lg:h-[500px] select-none">
      <svg
        viewBox="0 0 240 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        style={{ filter: "drop-shadow(0 15px 30px rgba(0,0,0,0.3))" }}
      >
        <defs>
          {/* Skin gradient for 3D depth */}
          <radialGradient id="skinFace" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#c68642" />
            <stop offset="70%" stopColor="#a0612b" />
            <stop offset="100%" stopColor="#8b5225" />
          </radialGradient>
          <radialGradient id="skinBody" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#b87a3d" />
            <stop offset="100%" stopColor="#9a6530" />
          </radialGradient>
          {/* Jacket gradient */}
          <linearGradient id="jacketGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c8a882" />
            <stop offset="50%" stopColor="#b89670" />
            <stop offset="100%" stopColor="#a8865e" />
          </linearGradient>
          <linearGradient id="jacketShadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b89670" />
            <stop offset="100%" stopColor="#9a7c58" />
          </linearGradient>
          {/* Hair gradient */}
          <radialGradient id="hairGrad" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#2a2a2a" />
            <stop offset="100%" stopColor="#111111" />
          </radialGradient>
          {/* Pants gradient */}
          <linearGradient id="pantsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2a3a" />
            <stop offset="100%" stopColor="#1a1a28" />
          </linearGradient>
          {/* Shoe gradient */}
          <linearGradient id="shoeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff7a1a" />
            <stop offset="100%" stopColor="#e05500" />
          </linearGradient>
        </defs>

        {/* ======== GROUND SHADOW ======== */}
        <ellipse cx="120" cy="490" rx="52" ry="7" fill="rgba(0,0,0,0.15)" />

        {/* ======== LEGS / PANTS ======== */}
        {/* Left leg */}
        <path d="M 86 348 L 82 440 Q 82 452 92 452 L 106 452 Q 112 452 112 446 L 108 348 Z" fill="url(#pantsGrad)" />
        {/* Right leg */}
        <path d="M 132 348 L 128 446 Q 128 452 134 452 L 148 452 Q 158 452 158 440 L 154 348 Z" fill="url(#pantsGrad)" />
        {/* Pant creases */}
        <line x1="97" y1="365" x2="95" y2="435" stroke="#22222e" strokeWidth="0.8" opacity="0.4" />
        <line x1="143" y1="365" x2="141" y2="435" stroke="#22222e" strokeWidth="0.8" opacity="0.4" />

        {/* ======== SHOES ======== */}
        <path d="M 76 448 Q 76 438 88 438 L 108 438 Q 116 438 116 448 L 116 458 Q 116 466 108 466 L 72 466 Q 66 466 66 460 L 66 456 Q 66 448 76 448 Z" fill="url(#shoeGrad)" />
        <path d="M 124 448 Q 124 438 136 438 L 152 438 Q 164 438 164 448 L 164 456 Q 164 466 168 466 L 174 466 Q 174 466 174 460 L 174 456 Q 174 448 168 448 L 124 448 Z" fill="url(#shoeGrad)" />
        <rect x="66" y="448" width="50" height="18" rx="9" fill="url(#shoeGrad)" />
        <rect x="124" y="448" width="50" height="18" rx="9" fill="url(#shoeGrad)" />
        {/* Shoe soles */}
        <rect x="66" y="462" width="50" height="5" rx="2.5" fill="#c04800" />
        <rect x="124" y="462" width="50" height="5" rx="2.5" fill="#c04800" />
        {/* Shoe laces hint */}
        <line x1="80" y1="450" x2="102" y2="450" stroke="#e8e0d0" strokeWidth="0.8" opacity="0.5" />
        <line x1="138" y1="450" x2="160" y2="450" stroke="#e8e0d0" strokeWidth="0.8" opacity="0.5" />

        {/* ======== BODY / TORSO ======== */}
        {/* Jacket body */}
        <path d="M 64 195 Q 64 180 84 180 L 156 180 Q 176 180 176 195 L 176 355 Q 176 365 166 365 L 74 365 Q 64 365 64 355 Z" fill="url(#jacketGrad)" />

        {/* Jacket center seam */}
        <line x1="120" y1="195" x2="120" y2="365" stroke="#a08058" strokeWidth="1" opacity="0.5" />

        {/* White T-shirt underneath */}
        <path d="M 100 186 Q 120 195 140 186 L 140 240 Q 120 245 100 240 Z" fill="#f5f0ea" />
        <path d="M 100 186 Q 120 195 140 186" fill="none" stroke="#e8e0d0" strokeWidth="1" />

        {/* Jacket lapels */}
        <path d="M 120 186 L 100 240 L 64 225 L 64 195 Q 64 180 84 180 L 120 180 Z" fill="url(#jacketShadow)" />
        <path d="M 120 186 L 140 240 L 176 225 L 176 195 Q 176 180 156 180 L 120 180 Z" fill="url(#jacketShadow)" />

        {/* Chest pockets */}
        <rect x="72" y="228" width="32" height="26" rx="3" fill="none" stroke="#9a7c58" strokeWidth="1.2" />
        <rect x="136" y="228" width="32" height="26" rx="3" fill="none" stroke="#9a7c58" strokeWidth="1.2" />
        {/* Pocket flaps */}
        <path d="M 72 228 L 72 222 Q 72 218 76 218 L 100 218 Q 104 218 104 222 L 104 228" fill="url(#jacketShadow)" stroke="#9a7c58" strokeWidth="0.8" />
        <path d="M 136 228 L 136 222 Q 136 218 140 218 L 164 218 Q 168 218 168 222 L 168 228" fill="url(#jacketShadow)" stroke="#9a7c58" strokeWidth="0.8" />
        {/* Pocket buttons */}
        <circle cx="88" cy="222" r="2" fill="#8b7048" />
        <circle cx="152" cy="222" r="2" fill="#8b7048" />

        {/* Jacket buttons */}
        <circle cx="120" cy="280" r="3" fill="#8b7048" />
        <circle cx="120" cy="310" r="3" fill="#8b7048" />
        <circle cx="120" cy="340" r="3" fill="#8b7048" />

        {/* ======== LEFT ARM (relaxed at side) ======== */}
        <path d="M 64 190 Q 48 195 42 210 L 38 310 Q 36 325 46 328 L 50 328 Q 60 328 60 315 L 64 215 Z" fill="url(#jacketGrad)" />
        {/* Left hand */}
        <ellipse cx="46" cy="332" rx="12" ry="14" fill="url(#skinBody)" />
        {/* Fingers */}
        <ellipse cx="40" cy="344" rx="4" ry="5" fill="url(#skinBody)" />
        <ellipse cx="46" cy="346" rx="3.5" ry="5" fill="url(#skinBody)" />
        <ellipse cx="52" cy="344" rx="3.5" ry="5" fill="url(#skinBody)" />

        {/* ======== RIGHT ARM (waving!) ======== */}
        <g className="animate-wave">
          {/* Upper arm */}
          <path d="M 176 190 Q 192 188 200 175 L 210 120 Q 212 108 204 105 L 198 105 Q 190 108 188 118 L 180 175 Z" fill="url(#jacketGrad)" />
          {/* Sleeve cuff */}
          <rect x="193" y="108" width="18" height="6" rx="3" fill="#a08058" transform="rotate(-10, 202, 111)" />
          {/* Waving hand */}
          <g>
            <ellipse cx="204" cy="98" rx="13" ry="14" fill="url(#skinBody)" />
            {/* Fingers spread for wave */}
            <rect x="194" y="78" width="5" height="17" rx="2.5" fill="#b87a3d" transform="rotate(-10, 196, 86)" />
            <rect x="201" y="75" width="5" height="20" rx="2.5" fill="#b87a3d" transform="rotate(0, 203, 85)" />
            <rect x="208" y="76" width="5" height="18" rx="2.5" fill="#b87a3d" transform="rotate(8, 210, 85)" />
            <rect x="214" y="80" width="4.5" height="15" rx="2.25" fill="#b87a3d" transform="rotate(18, 216, 87)" />
            {/* Thumb */}
            <rect x="188" y="92" width="5" height="13" rx="2.5" fill="#b87a3d" transform="rotate(-40, 190, 98)" />
          </g>
        </g>

        {/* ======== NECK ======== */}
        <rect x="105" y="158" width="30" height="28" rx="12" fill="url(#skinFace)" />

        {/* ======== HEAD ======== */}
        {/* Main head shape */}
        <ellipse cx="120" cy="108" rx="54" ry="60" fill="url(#skinFace)" />

        {/* ======== HAIR ======== */}
        {/* Top volume */}
        <ellipse cx="120" cy="58" rx="52" ry="26" fill="url(#hairGrad)" />
        {/* Side hair left */}
        <path d="M 66 70 Q 62 60 66 50 Q 72 42 90 40 L 66 80 Z" fill="url(#hairGrad)" />
        {/* Side hair right */}
        <path d="M 174 70 Q 178 60 174 50 Q 168 42 150 40 L 174 80 Z" fill="url(#hairGrad)" />
        {/* Hair top sweep - wavy */}
        <path d="M 68 68 Q 68 36 120 32 Q 172 36 172 68" fill="url(#hairGrad)" />
        {/* Hair texture lines */}
        <path d="M 85 45 Q 100 38 120 36 Q 140 38 155 45" fill="none" stroke="#333" strokeWidth="0.8" opacity="0.3" />
        <path d="M 78 55 Q 100 42 120 40 Q 140 42 162 55" fill="none" stroke="#333" strokeWidth="0.8" opacity="0.3" />
        {/* Slight curls on top */}
        <path d="M 90 38 Q 95 30 105 34" fill="none" stroke="#222" strokeWidth="1.5" opacity="0.4" />
        <path d="M 130 36 Q 138 28 148 33" fill="none" stroke="#222" strokeWidth="1.5" opacity="0.4" />

        {/* ======== EARS ======== */}
        <ellipse cx="66" cy="110" rx="8" ry="13" fill="url(#skinFace)" />
        <ellipse cx="66" cy="110" rx="5" ry="9" fill="#a0612b" opacity="0.3" />
        <ellipse cx="174" cy="110" rx="8" ry="13" fill="url(#skinFace)" />
        <ellipse cx="174" cy="110" rx="5" ry="9" fill="#a0612b" opacity="0.3" />

        {/* ======== EYEBROWS ======== */}
        <path
          d={`M 94 ${90 + ey * 0.3} Q 104 ${84 + ey * 0.3} 114 ${89 + ey * 0.3}`}
          stroke="#1a1a1a" strokeWidth="3.5" fill="none" strokeLinecap="round"
        />
        <path
          d={`M 126 ${89 + ey * 0.3} Q 136 ${84 + ey * 0.3} 146 ${90 + ey * 0.3}`}
          stroke="#1a1a1a" strokeWidth="3.5" fill="none" strokeLinecap="round"
        />

        {/* ======== EYES ======== */}
        {/* Eye whites */}
        <ellipse cx={104} cy={102} rx="12" ry="10" fill="white" />
        <ellipse cx={136} cy={102} rx="12" ry="10" fill="white" />
        {/* Iris */}
        <circle cx={104 + ex} cy={102 + ey} r="6.5" fill="#3d2310" />
        <circle cx={136 + ex} cy={102 + ey} r="6.5" fill="#3d2310" />
        {/* Pupils */}
        <circle cx={104 + ex} cy={102 + ey} r="3.5" fill="#1a0e05" />
        <circle cx={136 + ex} cy={102 + ey} r="3.5" fill="#1a0e05" />
        {/* Eye shine */}
        <circle cx={101 + ex * 0.3} cy={99 + ey * 0.3} r="2.5" fill="white" opacity="0.9" />
        <circle cx={133 + ex * 0.3} cy={99 + ey * 0.3} r="2.5" fill="white" opacity="0.9" />
        {/* Lower eyelid line */}
        <path d="M 93 107 Q 104 112 115 107" fill="none" stroke="#8b5225" strokeWidth="0.8" opacity="0.4" />
        <path d="M 125 107 Q 136 112 147 107" fill="none" stroke="#8b5225" strokeWidth="0.8" opacity="0.4" />

        {/* ======== NOSE ======== */}
        <path d="M 118 108 Q 115 122 112 126 Q 120 130 128 126 Q 125 122 122 108" fill="none" stroke="#9a5a2a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <circle cx="114" cy="126" r="3" fill="#a0612b" opacity="0.2" />
        <circle cx="126" cy="126" r="3" fill="#a0612b" opacity="0.2" />

        {/* ======== MOUTH / SMILE ======== */}
        {/* Big friendly smile */}
        <path d="M 104 138 Q 120 154 136 138" stroke="#6b3a1f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Teeth hint */}
        <path d="M 108 140 Q 120 150 132 140" fill="white" opacity="0.8" />
        {/* Lower lip */}
        <path d="M 108 140 Q 120 154 132 140" fill="none" stroke="#8b4a28" strokeWidth="1" opacity="0.4" />

        {/* ======== BEARD / STUBBLE ======== */}
        {/* Jawline stubble */}
        <path d="M 76 125 Q 74 145 82 158 Q 100 172 120 174 Q 140 172 158 158 Q 166 145 164 125" fill="none" stroke="#2a1a10" strokeWidth="2" opacity="0.15" strokeDasharray="1 2" />
        {/* Chin shadow/stubble */}
        <ellipse cx="120" cy="158" rx="22" ry="14" fill="#2a1a10" opacity="0.08" />
        {/* Subtle goatee area */}
        <ellipse cx="120" cy="152" rx="14" ry="8" fill="#2a1a10" opacity="0.06" />

        {/* ======== FACE SHADOW / DEPTH ======== */}
        {/* Cheek shadows */}
        <ellipse cx="88" cy="120" rx="12" ry="8" fill="#8b5225" opacity="0.08" />
        <ellipse cx="152" cy="120" rx="12" ry="8" fill="#8b5225" opacity="0.08" />
        {/* Jaw shadow */}
        <path d="M 72 130 Q 72 155 88 165 Q 110 175 120 176 Q 130 175 152 165 Q 168 155 168 130" fill="none" stroke="#8b5225" strokeWidth="1" opacity="0.1" />
      </svg>
    </div>
  );
}
