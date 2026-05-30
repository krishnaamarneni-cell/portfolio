// ============================================================================
//  REAL data — ILOSTAT (sourced from India's PLFS), reference year 2025
// ----------------------------------------------------------------------------
//  employment: REAL. Pulled from the ILOSTAT API (no login) via
//  refresh_ilostat.py — indicator EMP_TEMP_SEX_OCU_NB (employment by sex &
//  occupation, ISCO-08 1-digit, total sex). Groups sum to 476.6M (2025),
//  ILOSTAT's reported total employment for India.
//
//  wage: ESTIMATE. ILOSTAT has NO earnings-by-occupation series for India
//  (EAR_4MTH_SEX_OCU_NB returns 0 rows), so these monthly-₹ figures are rough
//  estimates anchored to the PLFS regular-wage average. Real per-occupation
//  wages require the PLFS microdata — see README "Phase B".
//
//  education: derived from each ISCO group's typical skill level.
//  formality / ai: estimates (not measured).  All non-real fields are badged
//  in the UI so nothing is passed off as official.
//
//  To refresh employment:  python refresh_ilostat.py   (then paste numbers here)
// ============================================================================

window.REAL_OCCUPATIONS = [
  // ISCO 6 — Skilled agricultural, forestry & fishery (India's largest group)
  { name:"Skilled agriculture / forestry / fishery", group:"Agriculture", employment:161.9, wage:9165,  education:2, formality:0.03, ai:0.07 },
  // ISCO 9 — Elementary occupations
  { name:"Elementary occupations",                 group:"Elementary",   employment:103.0, wage:10641, education:1, formality:0.05, ai:0.08 },
  // ISCO 5 — Service & sales workers
  { name:"Service & sales workers",                group:"Services",     employment:63.1,  wage:13830, education:3, formality:0.15, ai:0.40 },
  // ISCO 7 — Craft & related trades
  { name:"Craft & related trades workers",         group:"Craft",        employment:54.7,  wage:13165, education:2, formality:0.12, ai:0.15 },
  // ISCO 8 — Plant & machine operators, assemblers
  { name:"Plant & machine operators",              group:"Operators",    employment:28.9,  wage:15885, education:2, formality:0.30, ai:0.40 },
  // ISCO 2 — Professionals
  { name:"Professionals",                          group:"Professional", employment:27.9,  wage:33424, education:5, formality:0.70, ai:0.65 },
  // ISCO 1 — Managers
  { name:"Managers",                               group:"Managers",     employment:13.4,  wage:33910, education:5, formality:0.50, ai:0.50 },
  // ISCO 3 — Technicians & associate professionals
  { name:"Technicians & associate professionals",  group:"Technicians",  employment:12.6,  wage:24343, education:4, formality:0.60, ai:0.55 },
  // ISCO 4 — Clerical support workers
  { name:"Clerical support workers",               group:"Clerical",     employment:11.1,  wage:21886, education:4, formality:0.55, ai:0.82 },
];

// ensure any extra group has a colour for the categorical layer
window.GROUP_COLORS = window.GROUP_COLORS || {};
window.GROUP_COLORS.Other = "#6c757d";

// metadata shown in the UI per dataset
window.DATASET_META = {
  real: { label:"Real · ILOSTAT/PLFS 2025", badge:"REAL employment",
          note:"Employment is real (ILOSTAT EMP_TEMP_SEX_OCU_NB, ISCO-08 1-digit, 2025, total 476.6M). Wages/education/formality/AI are estimates — ILOSTAT has no per-occupation wages for India." },
  mock: { label:"Illustrative · 40 occupations", badge:"ESTIMATE",
          note:"All figures are rough estimates grounded in PLFS / Economic Survey aggregates — not an official release." },
};
