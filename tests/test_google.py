"""Connexion Google facultative : relier une fiche, la retrouver, la délier ; l'appli reste utilisable sans Google.
Fausse base et faux module Google en mémoire. Lancé par .github/workflows/tests.yml."""
import asyncio, json, os, subprocess, sys
from playwright.async_api import async_playwright
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUB = open(os.path.join(R, "tests", "stub-firebase.js"), encoding="utf-8").read()
AUTH = """
(function(){const cbs=[];let cur=null;const A={currentUser:null,
 onAuthStateChanged(cb){cbs.push(cb);setTimeout(()=>cb(cur),0)},getRedirectResult(){return Promise.resolve(null)},
 async signInWithPopup(){cur={uid:'g-123',email:'test@exemple.fr'};cbs.forEach(c=>c(cur));return {user:cur}},
 async signOut(){cur=null;cbs.forEach(c=>c(null))}};
 const f=()=>A;f.GoogleAuthProvider=function(){this.setCustomParameters=()=>{}};window.firebase.auth=f;})();
"""
DATA = {"members": {"m1": {"first": "Zephirin", "last": "B", "weight": 70, "height": 175}, "m2": {"first": "Celestin", "last": "F", "weight": 80, "height": 180}}, "fights": {}, "attendance": {}, "courses": {}}
ok=[];ko=[]
def v(c,q): print(("OK   " if c else "ÉCHEC"), q); (ok if c else ko).append(q)
async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8766"], cwd=R, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(1)
        async with async_playwright() as p:
            b = await p.chromium.launch()
            async def page(me, auth=True):
                pg = await b.new_page(viewport={"width": 390, "height": 844}); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
                async def route(r):
                    u=r.request.url
                    if "firebase-app-compat" in u: await r.fulfill(body=STUB, content_type="application/javascript")
                    elif "firebase-auth-compat" in u: await r.fulfill(body=AUTH if auth else "", content_type="application/javascript")
                    elif "gstatic" in u or "googleapis" in u: await r.fulfill(body="", content_type="application/javascript")
                    else: await r.continue_()
                await pg.route("**/*", route)
                await pg.add_init_script(f"window.__data={json.dumps(DATA)};localStorage.setItem('adb-me','{me}');sessionStorage.setItem('adb-splash','1');")
                await pg.goto("http://localhost:8766/#membres"); await pg.wait_for_timeout(900)
                return pg, errs
            # 1. sans compte : bouton visible, choix du nom toujours possible
            pg, errs = await page("")
            v(await pg.is_visible("#gIn"), "bouton « Se connecter avec Google » visible pour qui n'a pas de fiche")
            v(await pg.is_visible("#bxPick"), "le choix du nom dans la liste reste disponible")
            # 2. connexion Google puis choix du nom -> fiche reliée
            await pg.click("#gIn"); await pg.wait_for_timeout(300)
            v("Choisis ton nom" in (await pg.text_content("#gMsg") or ""), "après connexion sans fiche reliée : invite à choisir son nom")
            await pg.select_option("#bxPick", "m2"); await pg.wait_for_timeout(400)
            v(await pg.evaluate("member('m2').google")=="g-123", "la fiche choisie est reliée au compte Google (identifiant seulement)")
            v(await pg.evaluate("!('email' in member('m2'))"), "l'adresse e-mail n'est pas enregistrée dans la fiche")
            # 3. « Ce n'est pas moi » puis reconnexion -> fiche retrouvée automatiquement
            await pg.evaluate("showTab('membres')")
            await pg.click("#bxForget"); await pg.wait_for_timeout(300)
            v(await pg.evaluate("me")=="", "« Ce n'est pas moi » déconnecte bien")
            await pg.click("#gIn"); await pg.wait_for_timeout(400)
            v(await pg.evaluate("me")=="m2", "connexion Google : la fiche reliée est retrouvée sans choisir son nom")
            await pg.evaluate("showTab('membres')")
            # 4. modifier la fiche garde le lien
            await pg.click("#bxEdit"); await pg.click("#mSubmit"); await pg.wait_for_timeout(300); await pg.evaluate("showTab('membres')")
            v(await pg.evaluate("member('m2').google")=="g-123", "modifier sa fiche garde le lien Google")
            # 5. délier
            await pg.click("#bxGBtn"); await pg.wait_for_timeout(300)
            v(await pg.evaluate("!member('m2').google"), "« Délier mon compte Google » retire le lien")
            v(not errs, "aucune erreur JavaScript (avec Google) " + str(errs[:2]))
            # 6. relier depuis sa fiche
            pg2, errs2 = await page("m1")
            v("Relier" in (await pg2.text_content("#bxGBtn") or ""), "fiche ouverte : bouton « Relier mon compte Google »")
            await pg2.click("#bxGBtn"); await pg2.wait_for_timeout(400)
            v(await pg2.evaluate("member('m1').google")=="g-123", "relier depuis sa fiche fonctionne")
            # 7. module Google absent (non activé) : l'appli marche quand même
            pg3, errs3 = await page("", auth=False)
            await pg3.click("#gIn"); await pg3.wait_for_timeout(200)
            v(await pg3.is_visible("#gMsg") and "continuer sans" in (await pg3.text_content("#gMsg")), "sans module Google : message clair, appli utilisable")
            v(not errs2 and not errs3, "aucune erreur JavaScript (cas 6 et 7)")
            await b.close()
    finally: srv.terminate()
    print("\n%d OK, %d échec(s)" % (len(ok), len(ko))); sys.exit(1 if ko else 0)
asyncio.run(main())
