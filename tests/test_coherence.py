"""Vérifie que les listes recopiées hors de config.js (règles Firestore, onglets de la page) sont à jour (Q-01 / Q-02)."""
import json, os, re, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.loads(open(os.path.join(R, "config.js"), encoding="utf-8").read().split("\nwindow.ADB_CONFIG =", 1)[1].strip().rstrip(";"))
regles = open(os.path.join(R, "firestore.rules.notifications"), encoding="utf-8").read()
page = open(os.path.join(R, "index.html"), encoding="utf-8").read()
listes = re.findall(r"in \[([^\]]+)\]|hasOnly\(\[([^\]]+)\]\)", regles)
cats = {c["k"] for c in cfg["notifications"]}; onglets = [o["id"] for o in cfg["onglets"]]
def ensembles(): 
    for a, b in listes: yield {x.strip(" '\"") for x in (a or b).split(",")}
ok = True
if not any(e == cats for e in ensembles()): print("ÉCHEC catégories de notifications : règles Firestore ≠ config.js"); ok = False
if not any(e == set(onglets) for e in ensembles()): print("ÉCHEC onglets : règles Firestore ≠ config.js"); ok = False
if re.findall(r'data-tab="([a-z]+)"', page) != onglets: print("ÉCHEC ordre des onglets : index.html ≠ config.js"); ok = False
print("Cohérence : OK" if ok else ""); sys.exit(0 if ok else 1)
