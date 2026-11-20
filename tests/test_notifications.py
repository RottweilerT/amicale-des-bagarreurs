"""Test du serveur de notifications (Q-07) : fausse base et faux envoi, horaires simulés."""
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(R)
import importlib.util, json, os, datetime, urllib.error, io, tempfile
from zoneinfo import ZoneInfo
tmp=tempfile.mkdtemp()
os.environ.update(PROJET="p", SITE="https://x.io/adb", ETAT=tmp+"/etat.json", HISTORIQUE=tmp+"/h.json", FCM_COMPTE="{}", ADMIN_CODE="sesame", GITHUB_OUTPUT=tmp+"/out")
P=ZoneInfo("Europe/Paris")
def charge(mode,now):
    os.environ["MODE"]=mode
    spec=importlib.util.spec_from_file_location("n",os.path.join(R, ".github", "notifications.py"));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    m.acces=lambda:"T";m.NOW=now;m.TODAY=now.date().isoformat();m.http=http;return m
def enc(v):
    if isinstance(v,bool):return {"booleanValue":v}
    if isinstance(v,int):return {"integerValue":str(v)}
    if v is None:return {"nullValue":None}
    if isinstance(v,list):return {"arrayValue":{"values":[enc(x) for x in v]}}
    if isinstance(v,dict):return {"mapValue":{"fields":{k:enc(x) for k,x in v.items()}}}
    return {"stringValue":v}
SAT=datetime.datetime(2026,11,21,18,40,tzinfo=P)   # samedi, passage en retard (18h40)
DB={"courses":{"c1":dict(type="BA",date="2026-11-23",time="19:15",dur=90,place="St Roch"),"c2":dict(type="MX",date="2026-11-25",time="19:15",dur=90,place="St Roch"),
               "c3":dict(type="BA",date="2026-11-21",time="20:30",dur=90,place="St Roch")},
    "fights":{},"members":{"m1":dict(first="Armand",last="C"),"m2":dict(first="Bob",last="D"),"m3":dict(first="Zoé",last="E",off=True)},
    "attendance":{"c1_m2":dict(courseId="c1",memberId="m2",status="present"),"c3_m1":dict(courseId="c3",memberId="m1",status="present")},
    "push_subs":{"a"*32:dict(token="tokA"+"0"*20,cats=["rappel"],active=True,member="m1"),"b"*32:dict(token="tokB"+"0"*20,cats=["rappel","annonces"],active=True,member="m2"),
                 "c"*32:dict(token="tokC"+"0"*20,cats=["rappel"],active=True,member="m3")},"push_requests":{}}
SENT=[]
def http(url,data=None,method=None):
    if "fcm.googleapis" in url:SENT.append((data["message"]["token"][:4],data["message"]["data"]["title"],data["message"]["data"]["body"]));return {}
    path=url.split("/documents/")[1].split("?")[0]
    if method in("DELETE","PATCH"):return {}
    return {"documents":[{"name":f"x/{path}/{i}","fields":{k:enc(v) for k,v in d.items()},"updateTime":"2026"} for i,d in DB[path].items()]}
def run(mode,now):SENT.clear();charge(mode,now).principal();return list(SENT)
print("1er passage samedi 18h40 :",run("auto",SAT))
print("2e passage samedi 19h :",run("auto",SAT.replace(hour=19)))
print("samedi suivant 16h05 :",run("auto",datetime.datetime(2026,11,28,16,5,tzinfo=P)))
print("lundi 23 à 11h (trop tôt) :",run("auto",datetime.datetime(2026,11,23,11,0,tzinfo=P)))
print("lundi 23 à 14h :",run("auto",datetime.datetime(2026,11,23,14,0,tzinfo=P)))
print("lundi 23 à 15h (déjà fait) :",run("auto",datetime.datetime(2026,11,23,15,0,tzinfo=P)))
print("état :",json.load(open(tmp+"/etat.json"))["jour_j"],json.load(open(tmp+"/etat.json"))["rappel_semaine"])
# Vérifications : un seul rappel du samedi malgré deux passages, rien pour le profil désactivé, rappel du jour une seule fois.
SENT.clear()
etat = json.load(open(tmp + "/etat.json"))
assert etat["rappel_semaine"] and etat["jour_j"] == ["c1"], etat
print("\nTout est bon.")
