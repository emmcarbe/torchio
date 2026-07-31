#!/usr/bin/env python3
"""Build the local gazetteer from GeoNames (cities1000, CC BY 4.0).

Usage:
    python3 tools/build-gazetteer.py            # downloads and builds
    python3 tools/build-gazetteer.py cities1000.zip   # from a local copy

Output: data-local/gazetteer.json (gitignored: ~10 MB, regenerable).
Keys are normalized names (lowercase, diacritics stripped); each key holds up
to 5 candidates ordered by population: [name, lat, lon, country, population, id].
Attribution: GeoNames.org, licence CC BY 4.0.
"""
import sys, os, json, io, zipfile, unicodedata, urllib.request
from collections import defaultdict

URL = "https://download.geonames.org/export/dump/cities1000.zip"
ALT_URL = "https://download.geonames.org/export/dump/alternateNamesV2.zip"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data-local")
OUT = os.path.join(OUT_DIR, "gazetteer.json")

def norm(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.lower().split())

if len(sys.argv) > 1:
    data = open(sys.argv[1], "rb").read()
else:
    print(f"downloading {URL} ...")
    data = urllib.request.urlopen(URL, timeout=120).read()

zf = zipfile.ZipFile(io.BytesIO(data))
name = [n for n in zf.namelist() if n.endswith(".txt")][0]
gaz = defaultdict(list)
rows = 0
for line in io.TextIOWrapper(zf.open(name), encoding="utf-8"):
    f = line.rstrip("\n").split("\t")
    if len(f) < 15:
        continue
    gid, nm, ascii_nm, lat, lon, cc, pop = f[0], f[1], f[2], f[4], f[5], f[8], f[14]
    try:
        entry = [nm, round(float(lat), 4), round(float(lon), 4), cc, int(pop or 0), int(gid)]
    except ValueError:
        continue
    keys = {norm(nm)}
    if ascii_nm:
        keys.add(norm(ascii_nm))
    # exonyms and historical names live in alternatenames (Prag for Praha):
    # editions need them; keep the short ones to bound the index
    for alt in (f[3].split(",") if f[3] else []):
        if 0 < len(alt) <= 40 and alt.count(" ") <= 3:
            keys.add(norm(alt))
    for k in keys:
        if k:
            gaz[k].append(entry)
    rows += 1

# historical and Latin forms live in the full alternateNames file, tagged by
# language (la for Latin, grc for ancient Greek, plus dated names). An edition
# of a Latin text needs "Romae" to find Rome: the gazetteer declares it, the
# engine never guesses it. Pass the alternateNames file as the second argument,
# or set TORCHIO_ALTNAMES to its path; skipped if absent.
kept_ids = {e[5] for entries in gaz.values() for e in entries}
alt_path = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("TORCHIO_ALTNAMES")
alt_added = 0
if alt_path and os.path.exists(alt_path):
    canon = {}
    for entries in gaz.values():
        for e in entries:
            canon.setdefault(e[5], e)
    azf = zipfile.ZipFile(alt_path)
    aname = [n for n in azf.namelist() if n.endswith(".txt")][0]
    HIST_LANGS = {"la", "grc", "lad", ""}  # Latin, ancient Greek, historical, unlabelled
    for line in io.TextIOWrapper(azf.open(aname), encoding="utf-8"):
        a = line.rstrip("\n").split("\t")
        if len(a) < 4:
            continue
        gid, lang, alt = a[1], a[2], a[3]
        try:
            gid = int(gid)
        except ValueError:
            continue
        if gid not in kept_ids or lang not in HIST_LANGS:
            continue
        if not (0 < len(alt) <= 40 and alt.count(" ") <= 3):
            continue
        base = canon.get(gid)
        if base:
            gaz[norm(alt)].append(base)
            alt_added += 1
else:
    print("note: no alternateNames file (pass it as the 2nd argument or set TORCHIO_ALTNAMES);")
    print("      Latin and historical variants beyond the inline names will be missing.")

for k in gaz:
    # de-duplicate by geonames id, then order by population
    seen = {}
    for e in gaz[k]:
        seen.setdefault(e[5], e)
    gaz[k] = sorted(seen.values(), key=lambda e: -e[4])[:5]

os.makedirs(OUT_DIR, exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(gaz, fh, ensure_ascii=False, separators=(",", ":"))
print(f"{OUT}: {rows} GeoNames rows, {alt_added} historical/Latin names, {len(gaz)} keys")
print("Attribution required: GeoNames.org (CC BY 4.0)")
