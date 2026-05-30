#!/usr/bin/env python3
"""
Refresh the REAL dataset (real_data.js) from ILOSTAT.

Pulls India's employment & earnings by ISCO-08 1-digit occupation from the
ILOSTAT SDMX/rplumber API (no login) and prints the latest-year values so you
can update real_data.js. Run:  python refresh_ilostat.py

API: https://rplumber.ilo.org/data/indicator/?id=<IND>&ref_area=IND&format=.csv
  EMP_TEMP_SEX_OCU_NB  employment by sex & occupation ('000s)
  EAR_4MTH_SEX_OCU_NB  mean monthly earnings of employees (local currency, INR)
"""
import urllib.request, csv, io

UA = {"User-Agent": "Mozilla/5.0 (compatible; jobviz/1.0)"}
BASE = "https://rplumber.ilo.org/data/indicator/?id={ind}&ref_area=IND&format=.csv"
ISCO = {
    "OCU_ISCO08_1": "Managers", "OCU_ISCO08_2": "Professionals",
    "OCU_ISCO08_3": "Technicians & associate professionals",
    "OCU_ISCO08_4": "Clerical support workers",
    "OCU_ISCO08_5": "Service & sales workers",
    "OCU_ISCO08_6": "Skilled agriculture / forestry / fishery",
    "OCU_ISCO08_7": "Craft & related trades workers",
    "OCU_ISCO08_8": "Plant & machine operators",
    "OCU_ISCO08_9": "Elementary occupations",
    "OCU_ISCO08_X": "Armed forces & not classified",
    "OCU_ISCO08_TOTAL": "TOTAL",
}

def fetch(ind):
    url = BASE.format(ind=ind)
    req = urllib.request.Request(url, headers=UA)
    return list(csv.DictReader(io.StringIO(
        urllib.request.urlopen(req, timeout=180).read().decode("utf-8"))))

def latest_by_occ(rows, want_currency=False):
    """Return {classif1: (year, value)} keeping the most recent year, total-sex."""
    best = {}
    for r in rows:
        if r.get("sex") != "SEX_T":
            continue
        c1 = r.get("classif1", "")
        if not c1.startswith("OCU_ISCO08"):
            continue
        if want_currency and r.get("classif2") != "CUR_TYPE_LCU":
            continue
        try:
            yr = int(r["time"]); val = float(r["obs_value"])
        except (ValueError, KeyError):
            continue
        if c1 not in best or yr > best[c1][0]:
            best[c1] = (yr, val)
    return best

def main():
    print("Fetching ILOSTAT (employment + earnings by occupation, India)...")
    emp = latest_by_occ(fetch("EMP_TEMP_SEX_OCU_NB"))
    try:
        ear = latest_by_occ(fetch("EAR_4MTH_SEX_OCU_NB"), want_currency=True)
    except Exception as e:
        print("  (earnings fetch failed:", e, ")"); ear = {}

    print()
    print("{:<42}{:>11}{:>12}{:>6}".format("ISCO group", "workers(M)", "wage(Rs)", "yr"))
    print("-" * 71)
    for code, name in ISCO.items():
        ey, ev = emp.get(code, (None, None))
        wy, wv = ear.get(code, (None, None))
        m = (ev or 0) / 1000.0
        print("{:<42}{:>11.1f}{:>12.0f}{:>6}".format(name, m, (wv or 0), ey or ""))
    print("-" * 71)
    print("Update real_data.js with the numbers above (employment in millions).")

if __name__ == "__main__":
    main()
