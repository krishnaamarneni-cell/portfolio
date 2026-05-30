// ============================================================================
//  Indian Job Market Visualizer — occupation dataset
// ----------------------------------------------------------------------------
//  Structured on NCO-2015 major groups, populated with ESTIMATES grounded in
//  PLFS 2023-24, the Economic Survey, and CMIE/ILO aggregates. These are
//  rough, illustrative figures for a development/exploration tool — NOT an
//  official statistical release. Swap in real PLFS unit-level data later by
//  keeping the same shape per occupation:
//
//    {
//      name:        display label
//      group:       NCO major group (drives layout grouping + base hue)
//      employment:  workers in MILLIONS (drives rectangle area)
//      wage:        median monthly earnings in INR
//      education:   1 = below primary ... 5 = graduate+ (typical level)
//      formality:   share with any formal/written job contract, 0..1
//      ai:          rough "generative-AI exposure" score, 0..1 (precomputed)
//    }
//
//  India total usual-status workers ≈ 565 million (PLFS 2023-24).
// ============================================================================

window.OCCUPATIONS = [
  // ---- Agriculture, forestry & fishing (~46% of workforce) ----------------
  { name: "Crop farm labourers",        group: "Agriculture", employment: 120, wage: 8500,  education: 1, formality: 0.02, ai: 0.05 },
  { name: "Cultivators / farmers",      group: "Agriculture", employment: 90,  wage: 10000, education: 2, formality: 0.02, ai: 0.10 },
  { name: "Dairy & livestock workers",  group: "Agriculture", employment: 20,  wage: 9000,  education: 1, formality: 0.03, ai: 0.06 },
  { name: "Fishery & forestry workers", group: "Agriculture", employment: 12,  wage: 9500,  education: 1, formality: 0.05, ai: 0.08 },

  // ---- Elementary / manual labour -----------------------------------------
  { name: "Construction labourers",     group: "Elementary",  employment: 45,  wage: 13000, education: 1, formality: 0.06, ai: 0.04 },
  { name: "Domestic helpers & cleaners",group: "Elementary",  employment: 22,  wage: 9000,  education: 1, formality: 0.04, ai: 0.05 },
  { name: "Loaders, packers & porters", group: "Elementary",  employment: 18,  wage: 12000, education: 2, formality: 0.10, ai: 0.10 },
  { name: "Security guards",            group: "Elementary",  employment: 9,   wage: 14000, education: 2, formality: 0.35, ai: 0.18 },
  { name: "Street vendors",             group: "Elementary",  employment: 15,  wage: 11000, education: 2, formality: 0.01, ai: 0.12 },

  // ---- Craft & trades ------------------------------------------------------
  { name: "Tailors & garment workers",  group: "Craft",       employment: 14,  wage: 12000, education: 2, formality: 0.15, ai: 0.25 },
  { name: "Masons & builders",          group: "Craft",       employment: 16,  wage: 16000, education: 2, formality: 0.08, ai: 0.05 },
  { name: "Electricians & plumbers",    group: "Craft",       employment: 8,   wage: 18000, education: 3, formality: 0.20, ai: 0.10 },
  { name: "Carpenters & welders",       group: "Craft",       employment: 9,   wage: 17000, education: 2, formality: 0.12, ai: 0.08 },
  { name: "Mechanics & repairers",      group: "Craft",       employment: 7,   wage: 16000, education: 3, formality: 0.22, ai: 0.15 },
  { name: "Handicraft & textile artisans",group:"Craft",      employment: 6,   wage: 11000, education: 2, formality: 0.10, ai: 0.30 },

  // ---- Plant & machine operators ------------------------------------------
  { name: "Factory machine operators",  group: "Operators",   employment: 17,  wage: 15000, education: 2, formality: 0.30, ai: 0.35 },
  { name: "Auto / taxi / truck drivers",group: "Operators",   employment: 22,  wage: 16000, education: 2, formality: 0.18, ai: 0.45 },
  { name: "Delivery & gig riders",      group: "Operators",   employment: 8,   wage: 17000, education: 3, formality: 0.12, ai: 0.40 },
  { name: "Assembly-line workers",      group: "Operators",   employment: 6,   wage: 15500, education: 2, formality: 0.40, ai: 0.42 },

  // ---- Sales & services ----------------------------------------------------
  { name: "Shop & retail salespersons", group: "Services",    employment: 30,  wage: 13000, education: 3, formality: 0.20, ai: 0.45 },
  { name: "Cooks & food-service staff", group: "Services",    employment: 12,  wage: 12500, education: 2, formality: 0.18, ai: 0.20 },
  { name: "Beauticians & personal care",group: "Services",    employment: 5,   wage: 13000, education: 3, formality: 0.15, ai: 0.22 },
  { name: "Hospitality & hotel staff",  group: "Services",    employment: 7,   wage: 14000, education: 3, formality: 0.30, ai: 0.30 },

  // ---- Clerical -----------------------------------------------------------
  { name: "Office & data-entry clerks", group: "Clerical",    employment: 9,   wage: 18000, education: 4, formality: 0.55, ai: 0.85 },
  { name: "Customer support / call centre",group:"Clerical",  employment: 5,   wage: 20000, education: 4, formality: 0.60, ai: 0.80 },
  { name: "Cashiers & tellers",         group: "Clerical",    employment: 4,   wage: 17000, education: 4, formality: 0.50, ai: 0.78 },
  { name: "Accounts & bookkeeping clerks",group:"Clerical",   employment: 6,   wage: 22000, education: 4, formality: 0.65, ai: 0.82 },

  // ---- Technicians & associate professionals ------------------------------
  { name: "IT support technicians",     group: "Technicians", employment: 4,   wage: 28000, education: 4, formality: 0.70, ai: 0.65 },
  { name: "Nurses & health associates", group: "Technicians", employment: 5,   wage: 24000, education: 4, formality: 0.65, ai: 0.30 },
  { name: "Lab & engineering technicians",group:"Technicians",employment: 3,   wage: 26000, education: 4, formality: 0.68, ai: 0.45 },
  { name: "Financial & insurance agents",group:"Technicians", employment: 4,   wage: 25000, education: 4, formality: 0.55, ai: 0.60 },

  // ---- Professionals -------------------------------------------------------
  { name: "Software developers",        group: "Professional",employment: 5,   wage: 65000, education: 5, formality: 0.85, ai: 0.70 },
  { name: "Teachers & lecturers",       group: "Professional",employment: 10,  wage: 32000, education: 5, formality: 0.60, ai: 0.40 },
  { name: "Doctors & specialists",      group: "Professional",employment: 2,   wage: 80000, education: 5, formality: 0.70, ai: 0.25 },
  { name: "Accountants & finance pros", group: "Professional",employment: 3,   wage: 55000, education: 5, formality: 0.80, ai: 0.75 },
  { name: "Engineers (non-IT)",         group: "Professional",employment: 4,   wage: 50000, education: 5, formality: 0.78, ai: 0.50 },
  { name: "Lawyers & legal pros",       group: "Professional",employment: 1.5, wage: 60000, education: 5, formality: 0.65, ai: 0.68 },
  { name: "Designers, media & creatives",group:"Professional",employment: 2,   wage: 45000, education: 5, formality: 0.55, ai: 0.78 },

  // ---- Managers ------------------------------------------------------------
  { name: "Business & corporate managers",group:"Managers",   employment: 6,   wage: 70000, education: 5, formality: 0.80, ai: 0.55 },
  { name: "Small-business owners",      group: "Managers",    employment: 12,  wage: 30000, education: 3, formality: 0.10, ai: 0.40 },
  { name: "Govt & public administrators",group:"Managers",    employment: 4,   wage: 45000, education: 5, formality: 0.95, ai: 0.50 },
];

// NCO major-group → base colour (used in the "Occupation group" layer).
window.GROUP_COLORS = {
  Agriculture:  "#6a994e",
  Elementary:   "#a98467",
  Craft:        "#bc6c25",
  Operators:    "#9c6644",
  Services:     "#e07a5f",
  Clerical:     "#8d99ae",
  Technicians:  "#457b9d",
  Professional: "#3a86ff",
  Managers:     "#7209b7",
};
