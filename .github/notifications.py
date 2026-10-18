"""Notifications des applis (FC St Léon, Amicale des Bagarreurs), lancé par .github/workflows/notifications.yml.

Modes (variable MODE) :
  changements : compare le calendrier avec l'état précédent (fichier ETAT) et prévient tout le monde
                si une séance à venir est modifiée ou annulée. Au premier passage, enregistre seulement l'état.
  rappel      : le samedi à 16 h (heure de Paris), rappelle à chacun d'indiquer sa présence pour les
                séances des 7 prochains jours auxquelles il n'a pas encore répondu.
  test        : envoie une notification de test à tous les téléphones inscrits.

Les jetons des téléphones sont dans la fiche de chaque membre (champ « push »).
L'envoi passe par Firebase Cloud Messaging (API v1) avec le compte de service du secret FCM_COMPTE.
"""
import datetime, json, os, re, sys, urllib.error, urllib.request
from zoneinfo import ZoneInfo

APP = os.environ["APP"]              # foot | boxe
PROJET = os.environ["PROJET"]
SITE = os.environ["SITE"]
MODE = os.environ.get("MODE", "changements")
ETAT = os.environ.get("ETAT", "/tmp/etat-notifs/etat.json")
PARIS = ZoneInfo("Europe/Paris")
NOW = datetime.datetime.now(PARIS)
TODAY = NOW.date().isoformat()
KEY = re.search(r'apiKey:\s*"([^"]+)"', open("index.html", encoding="utf-8").read()).group(1)
HDR = {"Referer": SITE}
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJET}/databases/(default)/documents"
NOM = {"foot": "FC St Léon", "boxe": "Amicale des Bagarreurs"}[APP]
ICONE = {"foot": "icon-round-192-v5.png", "boxe": "icon-192.png"}[APP]
JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
KINDS = {"ent": "Entraînement", "match": "Match", "autre": "Séance"}
TYPES = {"BA": "Cours de boxe anglaise", "BF": "Cours de boxe française", "BT": "Cours de boxe thaï", "SP": "Sparring", "PP": "Préparation physique"}


def val(v):
    if "stringValue" in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "nullValue" in v: return None
    if "arrayValue" in v: return [val(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: val(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None


def lire(col):
    out, token = {}, ""
    while True:
        url = f"{BASE}/{col}?pageSize=300&key={KEY}" + (f"&pageToken={token}" if token else "")
        try:
            data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=HDR)))
        except urllib.error.HTTPError as e:
            print(f"::error::Lecture de {col} impossible ({e.code}) : {' '.join(e.read().decode('utf-8', 'replace').split())[:300]}")
            sys.exit(1)
        for d in data.get("documents", []):
            out[d["name"].split("/")[-1]] = {k: val(x) for k, x in d.get("fields", {}).items()}
        token = data.get("nextPageToken")
        if not token: return out


def jour(d, court=False):
    x = datetime.date.fromisoformat(d)
    return f"{JOURS[x.weekday()][:3]}. {x.day:02d}/{x.month:02d}" if court else f"{JOURS[x.weekday()]} {x.day} {MOIS[x.month - 1]}"


# ---------- Calendrier et membres, selon l'appli ----------
if APP == "foot":
    COL_MEMBRES, COL_SEANCES = "fc_players", "fc_events"
    def seances():
        return {i: {"date": e.get("date", ""), "heure": e.get("time") or "", "fin": e.get("end") or "", "lieu": e.get("place") or "",
                    "nom": KINDS.get(e.get("kind"), "Séance")}
                for i, e in lire(COL_SEANCES).items() if e.get("kind") != "note" and e.get("date")}
    def reponses():
        return {pid: set((r.get("a") or {}).keys()) for pid, r in lire("fc_rsvp").items()}
else:
    COL_MEMBRES, COL_SEANCES = "members", "courses"
    def seances():
        return {i: {"date": c.get("date", ""), "heure": c.get("time") or "", "fin": str(c.get("dur") or ""), "lieu": c.get("place") or "",
                    "nom": TYPES.get(c.get("type"), "Cours")}
                for i, c in lire(COL_SEANCES).items() if c.get("kind") != "note" and c.get("date")}
    def reponses():
        out = {}
        for a in lire("attendance").values():
            if a.get("memberId") and a.get("courseId"): out.setdefault(a["memberId"], set()).add(a["courseId"])
        return out


def membres():
    return {i: m for i, m in lire(COL_MEMBRES).items() if isinstance(m.get("push"), list) and m["push"]}


# ---------- Envoi par Firebase Cloud Messaging ----------
_jeton = None
def acces():
    global _jeton
    if _jeton: return _jeton
    from google.oauth2 import service_account
    import google.auth.transport.requests
    info = json.loads(os.environ["FCM_COMPTE"])
    cred = service_account.Credentials.from_service_account_info(info, scopes=["https://www.googleapis.com/auth/firebase.messaging"])
    cred.refresh(google.auth.transport.requests.Request())
    _jeton = cred.token
    return _jeton


morts = []  # (membre, jeton) à retirer : téléphone désinstallé ou notifications coupées
def envoyer(mid, tok, titre, texte, tag):
    msg = {"message": {"token": tok, "data": {"title": titre, "body": texte, "tag": tag, "url": SITE},
                       "webpush": {"headers": {"Urgency": "high", "TTL": "86400"}, "fcm_options": {"link": SITE}}}}
    req = urllib.request.Request(f"https://fcm.googleapis.com/v1/projects/{PROJET}/messages:send", data=json.dumps(msg).encode(),
                                 headers={"Authorization": "Bearer " + acces(), "Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req).read(); return True
    except urllib.error.HTTPError as e:
        corps = e.read().decode("utf-8", "replace")
        if e.code in (404, 400) and ("UNREGISTERED" in corps or "INVALID_ARGUMENT" in corps and "registration" in corps.lower()):
            morts.append((mid, tok))
        else:
            print(f"::warning::Envoi refusé ({e.code}) : {' '.join(corps.split())[:200]}")
        return False


def nettoyer():
    """Retire des fiches les jetons des téléphones qui ne reçoivent plus rien."""
    par = {}
    for mid, tok in morts: par.setdefault(mid, set()).add(tok)
    if not par: return
    tous = lire(COL_MEMBRES)
    for mid, toks in par.items():
        m = tous.get(mid)
        if not m: continue
        reste = [t for t in (m.get("push") or []) if t not in toks]
        body = {"fields": {"push": {"arrayValue": {"values": [{"stringValue": t} for t in reste]}}}}
        url = f"{BASE}/{COL_MEMBRES}/{mid}?key={KEY}&updateMask.fieldPaths=push&currentDocument.exists=true"
        try:
            urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(body).encode(), method="PATCH", headers={**HDR, "Content-Type": "application/json"})).read()
        except urllib.error.HTTPError as e:
            print(f"::warning::Nettoyage du jeton de {mid} impossible ({e.code})")
    print(f"{sum(len(v) for v in par.values())} téléphone(s) retiré(s) (notifications coupées ou appli supprimée)")


def a_tous(titre, texte, tag):
    n = 0
    for mid, m in membres().items():
        for tok in m["push"]:
            n += envoyer(mid, tok, titre, texte, tag)
    print(f"::notice::« {titre} » envoyée à {n} téléphone(s) : {texte}")


def libelle(s):
    return f"{s['nom']} du {jour(s['date'])}" + (f" à {s['heure']}" if s["heure"] else "")


# ---------- Modes ----------
if MODE == "test":
    a_tous(NOM, "Test : les notifications marchent sur ce téléphone \U0001F44D", "test")

elif MODE == "changements":
    actuel = {i: s for i, s in seances().items() if s["date"] >= TODAY}
    try:
        avant = json.load(open(ETAT))
    except Exception:
        avant = None
    msgs = []
    if avant is None:
        print("::notice::Premier passage : état du calendrier enregistré, aucune notification envoyée.")
    else:
        for i, a in avant.items():
            if a["date"] < TODAY: continue
            n = actuel.get(i)
            if n is None:
                msgs.append(("annul", f"{libelle(a)} : annulé" + ("e" if a["nom"] in ("Séance", "Préparation physique") else "") + "."))
            elif any(n[k] != a[k] for k in ("date", "heure", "fin", "lieu")):
                detail = []
                if n["date"] != a["date"]: detail.append(f"déplacé{'e' if a['nom'] in ('Séance', 'Préparation physique') else ''} au {jour(n['date'])}")
                if n["heure"] != a["heure"] or n["fin"] != a["fin"]: detail.append(f"désormais à {n['heure']}" + (f"–{n['fin']}" if APP == "foot" and n["fin"] else ""))
                if n["lieu"] != a["lieu"]: detail.append(f"lieu : {n['lieu'] or 'à préciser'}")
                msgs.append(("modif", f"{libelle(a)} : " + ", ".join(detail) + "."))
    if msgs:
        if len(msgs) == 1:
            titre = "Séance annulée" if msgs[0][0] == "annul" else "Séance modifiée"
            if APP == "boxe": titre = titre.replace("Séance", "Cours").replace("annulée", "annulé").replace("modifiée", "modifié")
            texte = msgs[0][1]
        else:
            titre = "Calendrier modifié"
            texte = " ".join(m[1] for m in msgs[:4]) + (f" (+{len(msgs) - 4} autres)" if len(msgs) > 4 else "")
        a_tous(titre, texte, "calendrier")
    if avant is None or avant != actuel:
        os.makedirs(os.path.dirname(ETAT), exist_ok=True)
        json.dump(actuel, open(ETAT, "w"), ensure_ascii=False, sort_keys=True)
        open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a").write("change=1\n")

elif MODE == "rappel":
    if os.environ.get("FORCER") != "1" and not (NOW.weekday() == 5 and NOW.hour == 16):
        print(f"Pas l'heure du rappel ({NOW:%A %H:%M} à Paris) : rien à faire."); sys.exit(0)
    fin = (NOW.date() + datetime.timedelta(days=7)).isoformat()
    semaine = sorted(((i, s) for i, s in seances().items() if TODAY < s["date"] <= fin), key=lambda x: (x[1]["date"], x[1]["heure"]))
    if not semaine:
        print("::notice::Aucune séance dans les 7 prochains jours : pas de rappel."); sys.exit(0)
    rep, n = reponses(), 0
    for mid, m in membres().items():
        manque = [s for i, s in semaine if i not in rep.get(mid, set())]
        if not manque: continue
        liste = ", ".join(f"{jour(s['date'], True)} ({s['nom']}{' ' + s['heure'] if s['heure'] else ''})" for s in manque[:5])
        texte = f"{m.get('first', '')}, indique si tu viens : {liste}" + ("…" if len(manque) > 5 else ".")
        for tok in m["push"]:
            n += envoyer(mid, tok, "Tes présences de la semaine", texte, "rappel")
    print(f"::notice::Rappel du samedi envoyé à {n} téléphone(s).")

nettoyer()
