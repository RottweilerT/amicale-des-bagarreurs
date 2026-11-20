"""P-03 : vérifie avec le VRAI SDK Firebase (chargé depuis gstatic) que l'appli démarre, se connecte et lit les membres.
Lecture seule. Lancé par .github/workflows/tests.yml (le runner GitHub a accès à Internet)."""
import asyncio, os, re, subprocess, sys
from playwright.async_api import async_playwright
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
version = re.search(r"firebasejs/([0-9.]+)/firebase-app-compat", open(os.path.join(R, "index.html"), encoding="utf-8").read()).group(1)
async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8766"], cwd=R, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        await asyncio.sleep(1)
        async with async_playwright() as p:
            b = await p.chromium.launch(); pg = await b.new_page()
            err = []; pg.on("pageerror", lambda e: err.append(str(e)))
            # la clé web peut être limitée au site publié : on présente son adresse comme le ferait la vraie page
            async def ref(r):
                h = dict(r.request.headers); h["referer"] = "https://rottweilert.github.io/amicale-des-bagarreurs/"
                await r.continue_(headers=h)
            await pg.route("**/*googleapis.com/**", ref)
            await pg.add_init_script("sessionStorage.setItem('adb-splash','1')")
            await pg.goto("http://localhost:8766/#calendrier"); await pg.wait_for_timeout(8000)
            v = await pg.evaluate("window.firebase && firebase.SDK_VERSION")
            n = await pg.evaluate("S.members.size")
            ok = v == version and n > 0 and not err
            print(f"SDK chargé : {v} (attendu {version}) · membres lus : {n} · erreurs : {err[:2]}")
            await b.close()
            sys.exit(0 if ok else 1)
    finally:
        srv.terminate()
asyncio.run(main())
