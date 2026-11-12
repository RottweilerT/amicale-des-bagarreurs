"""Notifications push de l'Amicale des Bagarreurs, lancé par .github/workflows/notifications.yml.
Documentation complète : NOTIFICATIONS.md.

Modes (variable MODE) :
  changements : toutes les 15 minutes.
                - compare le calendrier et les combats avec l'état du passage précédent (fichier ETAT) :
                  cours modifié / annulé (catégorie « changements »), nouveaux cours (« nouveaux »),
                  combat programmé ou terminé (« combats ») ;
                - envoie les annonces écrites dans l'espace admin de l'appli (collection push_requests),
                  seulement si le code admin correspond au secret ADMIN_CODE.
                Au premier passage, l'état est seulement enregistré : rien n'est envoyé.
  rappel      : le samedi à 16 h (heure de Paris), rappelle à chaque abonné de la catégorie « rappel » qui a choisi
                son profil d'indiquer sa présence aux cours des 7 prochains jours auxquels il n'a pas encore répondu.
  test        : envoie une notification de test à tous les appareils abonnés.

Abonnés : collection privée push_subs (jeton FCM, catégories, profil facultatif) — illisible depuis l'appli,
lue ici avec le compte de service. Les anciens jetons rangés dans la fiche des membres (champ « push ») sont encore
servis (catégories « annonces », « changements », « rappel ») le temps que chaque téléphone passe au nouveau rangement.
Envoi : Firebase Cloud Messaging, API HTTP v1, un message par appareil (l'ancien envoi groupé n'existe plus).
Chaque envoi est ajouté à notifications/historique.json (sans aucun jeton ni identifiant d'appareil).
"""
import datetime, hmac, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from zoneinfo import ZoneInfo

PROJET = os.environ["PROJET"]
SITE = os.environ["SITE"].rstrip("/") + "/"
MODE = os.environ.get("MODE", "changements")
ETAT = os.environ.get("ETAT", "/tmp/etat-notifs/etat.json")
HISTORIQUE = os.environ.get("HISTORIQUE", "notifications/historique.json")
ADMIN_CODE = os.environ.get("ADMIN_CODE", "").strip()
PARIS = ZoneInfo("Europe/Paris")
NOW = datetime.datetime.now(PARIS)
TODAY = NOW.date().isoformat()
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJET}/databases/(default)/documents"
NOM = "Amicale des Bagarreurs"
JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
TYPES = {"BA": "Boxe anglaise", "BF": "Boxe française", "BT": "Boxe thaï", "SP": "Combat", "PP": "Préparation physique", "MX": "Mixte"}
DISC = {"BA": "boxe anglaise", "BF": "boxe française", "BT": "boxe thaï"}
METHODES = {"PTS": "aux points", "KO": "par KO", "ARB": "par arrêt de l'arbitre", "ABD": "par abandon", "DQ": "par disqualification"}
CATS = ["annonces", "changements", "nouveaux", "rappel", "combats"]          # mêmes clés que NCATS dans index.html
CATS_ANCIENS = ["annonces", "changements", "rappel"]                         # anciens abonnés (jeton dans la fiche membre)
LIENS = {"calendrier", "minuteur", "combats", "elo", "membres", "regles", "notes"}  # mêmes clés que NLINKS
MAX_ANNONCES_PAR_PASSAGE = 3
MAX_ECHECS_CODE = 5          # codes admin faux tolérés sur 24 h ; au-delà, annonces bloquées jusqu'à ce que ça retombe


# ---------- Accès Google (compte de service du secret FCM_COMPTE) ----------
_jeton = None
def acces():
    global _jeton
    if _jeton: return _jeton
    from google.oauth2 import service_account
    import google.auth.transport.requests
    info = json.loads(os.environ["FCM_COMPTE"])
    cred = service_account.Credentials.from_service_account_info(info, scopes=[
        "https://www.googleapis.com/auth/firebase.messaging", "https://www.googleapis.com/auth/datastore"])
    cred.refresh(google.auth.transport.requests.Request())
    _jeton = cred.token
    return _jeton


def http(url, data=None, method=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None, method=method,
                                 headers={"Authorization": "Bearer " + acces(), "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        corps = r.read()
    return json.loads(corps) if corps else {}


# ---------- Firestore (REST) ----------
def val(v):
    if "stringValue" in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "timestampValue" in v: return v["timestampValue"]
    if "nullValue" in v: return None
    if "arrayValue" in v: return [val(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: val(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return None


def lire(col, avec_meta=False):
    out, token = {}, ""
    while True:
        url = f"{BASE}/{col}?pageSize=300" + (f"&pageToken={urllib.parse.quote(token)}" if token else "")
        try:
            data = http(url)
        except urllib.error.HTTPError as e:
            print(f"::error::Lecture de {col} impossible ({e.code}) : {' '.join(e.read().decode('utf-8', 'replace').split())[:300]}")
            sys.exit(1)
        for d in data.get("documents", []):
            f = {k: val(x) for k, x in d.get("fields", {}).items()}
            if avec_meta: f["_maj"] = d.get("updateTime")
            out[d["name"].split("/")[-1]] = f
        token = data.get("nextPageToken")
        if not token: return out


def supprimer(chemin, maj=None):
    """Supprime un document ; avec maj, seulement s'il n'a pas changé depuis la lecture (évite tout double traitement)."""
    url = f"{BASE}/{chemin}" + (f"?currentDocument.updateTime={urllib.parse.quote(maj)}" if maj else "")
    try:
        http(url, method="DELETE"); return True
    except urllib.error.HTTPError as e:
        print(f"::warning::Suppression de {chemin} impossible ({e.code})"); return False


def jour(d, court=False):
    x = datetime.date.fromisoformat(d)
    return f"{JOURS[x.weekday()][:3]}. {x.day:02d}/{x.month:02d}" if court else f"{JOURS[x.weekday()]} {x.day} {MOIS[x.month - 1]}"


def heure(h):
    return h.replace(":", "h") if h else ""


def cours():
    return {i: {"date": c.get("date", ""), "heure": c.get("time") or "", "fin": str(c.get("dur") or ""), "lieu": c.get("place") or "",
                "nom": TYPES.get(c.get("type"), "Cours"), "serie": c.get("serie") or ""}
            for i, c in lire("courses").items() if c.get("kind") != "note" and c.get("date")}


_membres = None
def membres():
    global _membres
    if _membres is None: _membres = lire("members")
    return _membres


# ---------- Abonnés ----------
_abonnes = None
def abonnes():
    """Liste de (chemin de la fiche, jeton, catégories, profil). Lue seulement quand il y a quelque chose à envoyer."""
    global _abonnes
    if _abonnes is not None: return _abonnes
    out, vus = [], set()
    for sid, s in lire("push_subs").items():
        t = s.get("token")
        if not isinstance(t, str) or not t or s.get("active") is False or t in vus: continue
        vus.add(t)
        out.append((f"push_subs/{sid}", t, [c for c in (s.get("cats") or []) if c in CATS], s.get("member") or None))
    for mid, m in membres().items():
        for t in m.get("push") or []:
            if isinstance(t, str) and t and t not in vus:
                vus.add(t); out.append((f"members/{mid}", t, CATS_ANCIENS, mid))
    _abonnes = out
    return out


# ---------- Envoi (Firebase Cloud Messaging, API HTTP v1) ----------
morts = []  # (chemin, jeton) : appareil désabonné, appli supprimée ou jeton expiré
def envoyer_un(chemin, tok, titre, texte, tag, lien):
    url = SITE + ("#" + lien if lien else "")
    msg = {"message": {"token": tok,
                       "data": {"title": titre[:80], "body": texte[:400], "tag": tag, "url": url},
                       "webpush": {"headers": {"Urgency": "high", "TTL": "86400"}, "fcm_options": {"link": url}}}}
    for essai in range(3):
        try:
            http(f"https://fcm.googleapis.com/v1/projects/{PROJET}/messages:send", msg); return True
        except urllib.error.HTTPError as e:
            corps = e.read().decode("utf-8", "replace")
            if e.code == 404 or (e.code == 400 and ("UNREGISTERED" in corps or "registration token" in corps.lower())) \
                    or (e.code == 403 and "SENDER_ID_MISMATCH" in corps):
                morts.append((chemin, tok)); return False
            if e.code in (429, 500, 502, 503) and essai < 2:
                time.sleep(2 * (essai + 1)); continue
            print(f"::warning::Envoi refusé ({e.code}) : {' '.join(corps.split())[:200]}"); return False
        except Exception as e:  # coupure réseau
            if essai < 2: time.sleep(2); continue
            print(f"::warning::Envoi impossible : {e}"); return False


def envoyer(dest, titre, texte, tag, lien):
    """dest : liste de (chemin, jeton). Envoi en parallèle ; renvoie (réussis, échecs)."""
    if not dest: return 0, 0
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(lambda d: envoyer_un(d[0], d[1], titre, texte, tag, lien), dest))
    ok = sum(1 for r in res if r)
    return ok, len(res) - ok


historique = []
def noter(cat, titre, texte, origine, ok, ko):
    historique.append({"date": NOW.isoformat(timespec="minutes"), "categorie": cat, "titre": titre, "message": texte,
                       "origine": origine, "envoyes": ok, "echecs": ko})


def publier(cat, titre, texte, tag, lien, origine="auto"):
    """Envoie à tous les abonnés de la catégorie, puis note l'envoi."""
    dest = [(c, t) for c, t, cats, _ in abonnes() if cat in cats]
    ok, ko = envoyer(dest, titre, texte, tag, lien)
    noter(cat, titre, texte, origine, ok, ko)
    print(f"::notice::[{cat}] « {titre} » → {ok} appareil(s){f', {ko} échec(s)' if ko else ''} : {texte}")


def nettoyer():
    """Retire les appareils qui ne reçoivent plus rien."""
    if not morts: return
    anciens = {}
    for chemin, tok in morts:
        if chemin.startswith("push_subs/"): supprimer(chemin)
        else: anciens.setdefault(chemin.split("/", 1)[1], set()).add(tok)
    for mid, toks in anciens.items():
        m = membres().get(mid)
        if not m: continue
        reste = [t for t in (m.get("push") or []) if t not in toks]
        body = {"fields": {"push": {"arrayValue": {"values": [{"stringValue": t} for t in reste]}}}}
        try:
            http(f"{BASE}/members/{mid}?updateMask.fieldPaths=push&currentDocument.exists=true", body, "PATCH")
        except urllib.error.HTTPError as e:
            print(f"::warning::Nettoyage de l'ancien jeton de {mid} impossible ({e.code})")
    print(f"{len(morts)} appareil(s) retiré(s) (désabonnés, appli supprimée ou jeton expiré)")


def sortie(ligne):
    open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a").write(ligne + "\n")


def ecrire_historique():
    if not historique: return
    try:
        h = json.load(open(HISTORIQUE, encoding="utf-8"))
        if not isinstance(h, list): h = []
    except Exception:
        h = []
    h = (h + historique)[-100:]
    os.makedirs(os.path.dirname(HISTORIQUE) or ".", exist_ok=True)
    json.dump(h, open(HISTORIQUE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sortie("historique=1")


def libelle(s):
    return f"{s['nom']} du {jour(s['date'])}" + (f" à {heure(s['heure'])}" if s["heure"] else "")


def fem(s):
    return "e" if s["nom"] == "Préparation physique" else ""


# ---------- Détection des changements ----------
def changements_calendrier(avant, actuel):
    msgs = []
    for i, a in avant.items():
        if a["date"] < TODAY: continue
        n = actuel.get(i)
        if n is None:
            msgs.append(("annul", f"{libelle(a)} : annulé{fem(a)}."))
        elif any(n.get(k) != a.get(k) for k in ("date", "heure", "fin", "lieu")):
            d = []
            if n["date"] != a["date"]: d.append(f"déplacé{fem(a)} au {jour(n['date'])}")
            if n["heure"] != a["heure"] or n["fin"] != a["fin"]:
                d.append(f"désormais à {heure(n['heure'])}" + (f" ({n['fin']} min)" if n["fin"] != a["fin"] and n["fin"] else ""))
            if n["lieu"] != a["lieu"]: d.append(f"lieu : {n['lieu'] or 'à préciser'}")
            msgs.append(("modif", f"{libelle(a)} : " + ", ".join(d) + "."))
    if not msgs: return
    if len(msgs) == 1:
        titre, texte = ("Cours annulé" if msgs[0][0] == "annul" else "Cours modifié"), msgs[0][1]
    else:
        titre = f"Calendrier : {len(msgs)} cours modifiés ou annulés"
        texte = " ".join(m[1] for m in msgs[:4]) + (f" (+{len(msgs) - 4} autres)" if len(msgs) > 4 else "")
    publier("changements", titre, texte, "calendrier", "calendrier")


def nouveaux_cours(avant, actuel):
    neufs = sorted(((i, s) for i, s in actuel.items() if i not in avant and s["date"] >= TODAY), key=lambda x: (x[1]["date"], x[1]["heure"]))
    if not neufs: return
    groupes = {}
    for i, s in neufs: groupes.setdefault(s["serie"] or i, []).append(s)
    phrases = []
    for g in groupes.values():
        s, h = g[0], (f" à {heure(g[0]['heure'])}" if g[0]["heure"] else "")
        lieu = f" ({s['lieu']})" if s["lieu"] else ""
        if len(g) == 1: phrases.append(f"{s['nom']} le {jour(s['date'])}{h}{lieu}.")
        else: phrases.append(f"{s['nom']} chaque {JOURS[datetime.date.fromisoformat(s['date']).weekday()]}{h}{lieu}, "
                             f"du {jour(s['date'])} au {jour(g[-1]['date'])} ({len(g)} cours).")
    titre = "Nouveau cours au calendrier" if len(neufs) == 1 else f"{len(neufs)} nouveaux cours au calendrier"
    publier("nouveaux", titre, " ".join(phrases[:3]) + (f" (+{len(phrases) - 3} autres)" if len(phrases) > 3 else ""), "nouveaux", "calendrier")


def combats_etat():
    out = {}
    for i, f in lire("fights").items():
        r = f.get("result") if isinstance(f.get("result"), dict) else None
        out[i] = {"rouge": f.get("red") or "", "bleu": f.get("blue") or "", "date": f.get("date") or "", "disc": f.get("disc") or "BA",
                  "fini": f.get("status") == "fini" and bool(r), "vainqueur": (r or {}).get("winner") or "", "methode": (r or {}).get("method") or ""}
    return out


def nom(mid):
    m = membres().get(mid) or {}
    return " ".join(x for x in (m.get("first"), m.get("last")) if x).strip() or "?"


def changements_combats(avant, actuel):
    msgs = []
    for i, f in actuel.items():
        a = avant.get(i)
        if a is None and not f["fini"] and f["date"] >= TODAY and f["rouge"] and f["bleu"]:
            quand = "aujourd'hui" if f["date"] == TODAY else f"le {jour(f['date'])}"
            msgs.append(("Combat programmé", f"{nom(f['rouge'])} contre {nom(f['bleu'])} en {DISC.get(f['disc'], 'boxe')}, {quand}."))
        elif f["fini"] and not (a and a.get("fini")):
            if f["methode"] == "NUL" or f["vainqueur"] not in ("r", "b"):
                msgs.append(("Résultat de combat", f"{nom(f['rouge'])} – {nom(f['bleu'])} : match nul."))
            else:
                g, p = (f["rouge"], f["bleu"]) if f["vainqueur"] == "r" else (f["bleu"], f["rouge"])
                m = METHODES.get(f["methode"], "")
                msgs.append(("Résultat de combat", f"Victoire de {nom(g)} contre {nom(p)}" + (f" {m}" if m else "") + "."))
    if not msgs: return
    if len(msgs) == 1: publier("combats", msgs[0][0], msgs[0][1], "combats", "combats")
    else: publier("combats", f"Combats : {len(msgs)} nouveautés", " ".join(m[1] for m in msgs[:4]), "combats", "combats")


# ---------- Annonces écrites dans l'espace admin ----------
def annonces(etat):
    demandes = lire("push_requests", avec_meta=True)
    if not demandes: return
    limite = (NOW - datetime.timedelta(hours=24)).isoformat()
    echecs = [t for t in etat.get("echecs_code", []) if t > limite]
    envoyees = 0
    for rid, d in sorted(demandes.items(), key=lambda x: str(x[1].get("at") or "")):
        # La demande est d'abord retirée (seulement si elle n'a pas changé depuis la lecture) : jamais deux envois,
        # et le code tapé ne reste pas stocké.
        if not supprimer(f"push_requests/{rid}", d.get("_maj")): continue
        titre, texte = str(d.get("title") or "").strip()[:60], str(d.get("body") or "").strip()[:200]
        cat = d.get("cat") if d.get("cat") in CATS else "annonces"
        lien = d.get("link") if d.get("link") in LIENS else "calendrier"
        at = str(d.get("at") or "")
        trop_vieux = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%S")
        refus = None
        if not ADMIN_CODE: refus = "code admin pas encore configuré sur le serveur"
        elif len(echecs) >= MAX_ECHECS_CODE: refus = "trop de codes faux ces dernières 24 h, réessaie plus tard"
        elif not hmac.compare_digest(str(d.get("code") or "").strip().encode(), ADMIN_CODE.encode()):
            refus = "code admin incorrect"; echecs.append(NOW.isoformat())
        elif not titre or not texte: refus = "titre ou message vide"
        elif at and at[:19] < trop_vieux: refus = "demande trop ancienne"
        elif envoyees >= MAX_ANNONCES_PAR_PASSAGE: refus = "trop d'annonces d'un coup"
        if refus:
            noter(cat, titre or "(sans titre)", f"Pas envoyée : {refus}.", "refus", 0, 0)
            print(f"::warning::Annonce « {titre} » refusée : {refus}")
            continue
        publier(cat, titre, texte, f"annonce-{rid[:8]}", lien, origine="admin")
        envoyees += 1
    etat["echecs_code"] = echecs


# ---------- Modes ----------
def charger_etat():
    try:
        e = json.load(open(ETAT))
    except Exception:
        return None
    if isinstance(e, dict) and e.get("v") == 2: return e
    return {"v": 2, "cours": e if isinstance(e, dict) else {}, "combats": None}   # ancien format : calendrier seul


def principal():
    if not os.environ.get("FCM_COMPTE"):
        print("::warning::Secret FCM_COMPTE absent : rien n'est envoyé (voir NOTIFICATIONS.md)."); return

    if MODE == "test":
        ok, ko = envoyer([(c, t) for c, t, _, _ in abonnes()], NOM, "Test : les notifications marchent sur cet appareil 👍", "test", "")
        noter("test", NOM, "Notification de test", "test", ok, ko)
        print(f"::notice::Test envoyé à {ok} appareil(s), {ko} échec(s).")

    elif MODE == "changements":
        avant = charger_etat()
        etat = {"v": 2, "cours": {i: s for i, s in cours().items() if s["date"] >= TODAY}, "combats": combats_etat(),
                "echecs_code": (avant or {}).get("echecs_code", [])}
        if avant is None:
            print("::notice::Premier passage : état enregistré, aucune notification envoyée.")
        else:
            changements_calendrier(avant["cours"], etat["cours"])
            nouveaux_cours(avant["cours"], etat["cours"])
            if avant.get("combats") is None: print("::notice::Combats : état enregistré (premier passage).")
            else: changements_combats(avant["combats"], etat["combats"])
        annonces(etat)
        if avant != etat:
            os.makedirs(os.path.dirname(ETAT), exist_ok=True)
            json.dump(etat, open(ETAT, "w"), ensure_ascii=False, sort_keys=True)
            sortie("change=1")

    elif MODE == "rappel":
        if os.environ.get("FORCER") != "1" and not (NOW.weekday() == 5 and NOW.hour == 16):
            print(f"Pas l'heure du rappel ({NOW:%A %H:%M} à Paris) : rien à faire."); return
        fin = (NOW.date() + datetime.timedelta(days=7)).isoformat()
        semaine = sorted(((i, s) for i, s in cours().items() if TODAY < s["date"] <= fin), key=lambda x: (x[1]["date"], x[1]["heure"]))
        if not semaine:
            print("::notice::Aucun cours dans les 7 prochains jours : pas de rappel."); return
        rep = {}
        for a in lire("attendance").values():
            if a.get("memberId") and a.get("courseId"): rep.setdefault(a["memberId"], set()).add(a["courseId"])
        par_membre = {}
        for c, t, cats, mid in abonnes():
            if "rappel" in cats and mid: par_membre.setdefault(mid, []).append((c, t))
        ok = ko = 0
        for mid, dest in par_membre.items():
            m = membres().get(mid)
            if not m or m.get("off"): continue  # profil supprimé ou désactivé : on n'attend pas sa présence
            manque = [s for i, s in semaine if i not in rep.get(mid, set())]
            if not manque: continue
            liste = ", ".join(f"{jour(s['date'], True)} ({s['nom']}{' ' + heure(s['heure']) if s['heure'] else ''})" for s in manque[:5])
            a, b = envoyer(dest, "Tes présences de la semaine",
                           f"{m.get('first', '')}, indique si tu viens : {liste}" + ("…" if len(manque) > 5 else "."), "rappel", "calendrier")
            ok += a; ko += b
        noter("rappel", "Tes présences de la semaine", "Rappel personnel à ceux à qui il manque des réponses", "auto", ok, ko)
        print(f"::notice::Rappel du samedi envoyé à {ok} appareil(s).")

    nettoyer()
    ecrire_historique()


if __name__ == "__main__":
    principal()
