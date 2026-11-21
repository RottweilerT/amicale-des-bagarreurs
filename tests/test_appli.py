"""Test de fumée de l'appli (Q-07) : ouvre index.html avec une fausse base Firebase en mémoire et vérifie
les parcours essentiels sur un écran de téléphone. Lancé par .github/workflows/tests.yml à chaque modification."""
import asyncio, json, os, subprocess, sys, datetime
from playwright.async_api import async_playwright

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUB = open(os.path.join(RACINE, "tests", "stub-firebase.js"), encoding="utf-8").read()
T = datetime.date.today()
D = lambda n: (T + datetime.timedelta(days=n)).isoformat()
DATA = {"members": {"m1": {"first": "Armand", "last": "C", "weight": 70, "height": 175}, "m2": {"first": "Bob", "last": "D"}},
        "fights": {}, "attendance": {},
        "courses": {"c1": {"type": "BA", "date": D(1), "time": "19:15", "dur": 90, "place": "St Roch", "serie": "S"},
                    "c2": {"type": "BA", "date": D(8), "time": "19:15", "dur": 90, "place": "St Roch", "serie": "S"},
                    "n-1": {"kind": "note", "title": "Calendrier", "status": "open", "cat": "idee", "prio": 1},
                    "s-saison-2026-2027": {"kind": "salle-saison", "saison": "2026-2027"}}}
echecs = []
def verifier(cond, quoi):
    print(("OK   " if cond else "ÉCHEC"), quoi)
    if not cond: echecs.append(quoi)

async def main():
    serveur = subprocess.Popen([sys.executable, "-m", "http.server", "8765"], cwd=RACINE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(1)
        async with async_playwright() as p:
            b = await p.chromium.launch()
            pg = await b.new_page(viewport={"width": 390, "height": 844})
            erreurs = []; pg.on("pageerror", lambda e: erreurs.append(str(e)))
            async def route(r):
                u = r.request.url
                if "firebase-app-compat" in u: await r.fulfill(body=STUB, content_type="application/javascript")
                elif "gstatic" in u or "googleapis" in u: await r.fulfill(body="", content_type="application/javascript")
                else: await r.continue_()
            await pg.route("**/*", route)
            await pg.add_init_script(f"window.__data={json.dumps(DATA)};localStorage.setItem('adb-me','m1');sessionStorage.setItem('adb-splash','1');")
            await pg.goto("http://localhost:8765/#calendrier"); await pg.wait_for_timeout(1000)
            verifier(await pg.evaluate("S.courses.size") == 2, "les notes et la salle ne sont pas comptées comme des cours")
            onglets = await pg.eval_on_selector_all("nav.tabs button[data-tab]", "bs=>bs.map(b=>b.dataset.tab)")
            verifier(onglets == await pg.evaluate("ONGLETS"), "les onglets de la page correspondent à config.js")
            for t in onglets:
                await pg.evaluate(f"showTab('{t}')"); await pg.wait_for_timeout(50)
                verifier(not await pg.eval_on_selector(f"#tab-{t}", "e=>e.hidden"), f"l'onglet {t} s'affiche")
            await pg.evaluate("showTab('calendrier')")
            await pg.evaluate(f"ui.wk=wkSun('{D(1)}');renderSemaine();applyRO()")  # le samedi, demain est dans la semaine suivante
            await pg.locator(".wkrow:not(.past) .wkr-b.yes").first.click(); await pg.wait_for_timeout(300)
            verifier(await pg.evaluate("[...S.attendance.values()].some(a=>a.memberId==='m1'&&a.status==='present')"), "une présence s'enregistre en un appui")
            await pg.evaluate(f"ui.day='{D(1)}';renderCalendar()"); await pg.click('#dayList button[data-act="cEdit"]')
            await pg.fill("#cTime", "19:30"); await pg.select_option("#cScope", "serie"); await pg.click("#cSubmit"); await pg.wait_for_timeout(400)
            verifier(await pg.evaluate("[...S.courses.values()].every(c=>c.time==='19:30')"), "modifier un cours et la suite de sa série")
            verifier(await pg.evaluate("[...S.attendance.values()].some(a=>a.memberId==='m1')"), "les présences restent après une modification")
            # Minuteur : modèle → éditeur → enregistrement → séance en cours (horloge simulée)
            await pg.evaluate("showTab('minuteur')"); await pg.wait_for_timeout(100)
            verifier(await pg.locator(".mn-sc").count() == 0, "aucune séance fictive affichée au départ")
            await pg.click('[data-mn="modele"][data-k="1"]'); await pg.wait_for_timeout(100)
            verifier(await pg.locator(".mn-b.rep").count() == 1, "un modèle s'ouvre dans l'éditeur par blocs")
            await pg.click('[data-mn="lie"][data-val="0"]'); await pg.click('[data-mn="occ"][data-k="2"]')
            await pg.locator('.mn-b.rep .mn-blocs .mn-b.act [data-mn="choisirExo"]').first.click()
            await pg.fill("#mnPickQ", "pompes diamant"); await pg.wait_for_timeout(100)
            await pg.locator('[data-mn="pickExo"]').first.click(); await pg.wait_for_timeout(100)
            noms = await pg.evaluate("ADB_MOTEUR.compiler(ADB_MINUTEUR.ed.s).filter(x=>x.k==='act').map(x=>x.nom)")
            verifier(noms.count("Pompes diamant") == 1 and noms.count("Shadow boxing cardio") == 5, "répétitions indépendantes : seul le 3e tour change")
            verifier(await pg.locator(".mn-b.act img.mn-mini").count() > 0, "les blocs d'exercice affichent leur miniature")
            await pg.locator('.mn-b-img').first.click(); await pg.wait_for_timeout(400)
            verifier(await pg.locator("#mnFiche .mn-fi-etapes li").count() >= 2, "la fiche illustrée s'ouvre avec ses étapes")
            await pg.click('#mnSheetIn button[data-mn="fermer"]')
            await pg.fill("#mnNom", "Test cardio"); await pg.click('[data-mn="partage"][data-val="1"]'); await pg.click('[data-mn="sauver"]'); await pg.wait_for_timeout(300)
            verifier(await pg.evaluate("SEANCES.size===1&&[...SEANCES.values()][0].v===2"), "la séance s'enregistre pour le groupe (format par blocs)")
            verifier(await pg.evaluate("S.courses.size") == 2, "une séance du minuteur n'apparaît pas dans le calendrier")
            await pg.evaluate("ADB_MINUTEUR.demarrer(ADB_SEANCES.simple({rounds:2,travail:20,repos:15,prep:5}),{nom:'t'})")
            verifier(not await pg.eval_on_selector("#mnRun", "e=>e.hidden"), "l'écran de séance s'ouvre")
            verifier((await pg.inner_text("#mrPh")).upper().startswith("PR"), "la séance commence par la préparation")
            verifier("PROCHAIN" in (await pg.inner_text("#mrNext")).upper(), "pendant la préparation, le prochain exercice est annoncé")
            await pg.click('[data-mn="stop"]'); await pg.click('[data-mn="stop"]'); await pg.wait_for_timeout(100)
            verifier(await pg.evaluate("ADB_SEANCES.hist().length") == 0, "une séance arrêtée avant 10 s n'encombre pas l'historique")
            await pg.click('[data-mn="quitter"]')
            verifier(not erreurs, "aucune erreur JavaScript" + (f" : {erreurs[:2]}" if erreurs else ""))
            await b.close()
    finally:
        serveur.terminate()

asyncio.run(main())
if echecs: print(f"\n{len(echecs)} vérification(s) en échec"); sys.exit(1)
print("\nTout est bon.")
