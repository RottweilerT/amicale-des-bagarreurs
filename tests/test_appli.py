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
            # Minuteur : un exercice par round, affiché pendant l'effort et annoncé pendant le repos
            await pg.evaluate("showTab('minuteur')"); await pg.wait_for_timeout(100)
            nb = await pg.eval_on_selector_all("#tmExos select[data-exo]", "s=>s.length")
            verifier(nb == int(await pg.input_value("#tmRounds")), "un menu d'exercice par round")
            verifier(await pg.eval_on_selector("#tmExos select", "s=>s.querySelectorAll('option').length") > 60, "le menu propose tout le catalogue d'exercices")
            await pg.select_option("#tmExos select[data-exo='0']", "Burpees"); await pg.click('[data-tm="exoAll"]'); await pg.wait_for_timeout(100)
            verifier(await pg.eval_on_selector_all("#tmExos select", "s=>s.every(x=>x.value==='Burpees')"), "« Le 1er partout » recopie l'exercice")
            verifier("BURPEES" in (await pg.inner_text("#tmExo")).upper(), "le 1er exercice s'affiche sur le minuteur")
            await pg.fill("#tmName", "Circuit test"); await pg.click("#tmForm button[type=submit]"); await pg.wait_for_timeout(300)
            verifier(await pg.evaluate("SEANCES.size===1&&[...SEANCES.values()][0].exos[0]==='Burpees'"), "le cours s'enregistre pour le groupe avec ses exercices")
            verifier(await pg.evaluate("S.courses.size") == 2, "un cours du minuteur n'apparaît pas dans le calendrier")
            await pg.click('[data-tm="start"]'); await pg.wait_for_timeout(300)
            verifier("SUIVRE" in (await pg.inner_text("#tmExo")).upper(), "pendant la préparation, l'exercice à venir est annoncé")
            await pg.click('[data-tm="stop"]')
            verifier(not erreurs, "aucune erreur JavaScript" + (f" : {erreurs[:2]}" if erreurs else ""))
            await b.close()
    finally:
        serveur.terminate()

asyncio.run(main())
if echecs: print(f"\n{len(echecs)} vérification(s) en échec"); sys.exit(1)
print("\nTout est bon.")
