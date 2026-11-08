"""Verifie la fonction ably-token et specs/ably_token.sql sur le projet AriaTest.

    SUPABASE_URL=... SUPABASE_ANON=... SUPABASE_SERVICE=... python specs/ably_token.check.py

SUPABASE_ANON est la cle publishable, SUPABASE_SERVICE la cle service_role :
    supabase projects api-keys --project-ref <ref>

Chaque attaque est jouee pour de vrai — y compris contre Ably, avec le jeton que la
fonction a signe — et doit echouer. Le script ne touche QU'A ses propres donnees
(comptes aria-tok-*, cles et lignes tok-*, code ZTSTA) et les retire en partant.
Il ne remet pas a null le proprietaire des autres cles, contrairement a
auth_rls.check.py : ne pas lancer celui-la sur un projet ou des cles sont reclamees.
"""
import base64, json, os, urllib.request, urllib.error, uuid

URL = os.environ["SUPABASE_URL"].rstrip("/")
ANON = os.environ["SUPABASE_ANON"]
SR = os.environ["SUPABASE_SERVICE"]
FN = URL + "/functions/v1/ably-token"
CODE = "ZTSTA"
SAVE_A1, SAVE_A2, SAVE_B, SAVE_C = ("00000000-0000-4000-8000-0000000070%02d" % i for i in (1, 2, 3, 4))
CHAR_A, CHAR_B, CAMP_A = "tok-char-a", "tok-char-b", "tok-camp-a"


def call(url, key=None, token=None, data=None, method=None, prefer=None, headers=None, raw=None):
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    r = urllib.request.Request(url, data=body, method=method or ("POST" if body is not None else "GET"))
    if key:
        r.add_header("apikey", key)
        r.add_header("Authorization", "Bearer " + (token or key))
    if body is not None:   # Storage refuses a JSON content type on a bodyless DELETE
        r.add_header("Content-Type", "application/json")
    if prefer:
        r.add_header("Prefer", prefer)
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r) as resp:
            b = resp.read().decode()
            try:
                return resp.status, (json.loads(b) if b.strip() else None)
            except ValueError:
                return resp.status, b[:200]
    except urllib.error.HTTPError as e:
        b = e.read().decode()
        try:
            return e.code, json.loads(b)
        except Exception:
            return e.code, b[:200]


def rest(path, key=SR, token=None, **kw):
    return call(URL + path, key, token, **kw)


fails = []


def check(label, cond, detail=""):
    print(("  OK   " if cond else "  FAIL ") + label + (("  <- " + str(detail)[:160]) if not cond and detail else ""))
    if not cond:
        fails.append(label)


def account(email):
    # created confirmed through the admin API: signup now mails a confirmation link
    rest("/auth/v1/admin/users", data={"email": email, "password": "Test-1234-aria", "email_confirm": True})
    st, body = rest("/auth/v1/token?grant_type=password", ANON,
                    data={"email": email, "password": "Test-1234-aria"})
    return (body or {}).get("access_token"), ((body or {}).get("user") or {}).get("id")


def token(body, tok=None):
    return call(FN, ANON, tok, data=body)


def ably_token(tr):
    st, t = call("https://rest.ably.io/keys/%s/requestToken" % tr["keyName"], data=tr)
    return t["token"] if st in (200, 201) else None


def ably_publish(tok, channel, client_id=None):
    msg = {"name": "t", "data": "probe"}
    if client_id:
        msg["clientId"] = client_id
    auth = "Bearer " + base64.b64encode(tok.encode()).decode()
    st, _ = call("https://rest.ably.io/channels/%s/messages" % urllib.parse.quote(channel, safe=""),
                 data=msg, headers={"Authorization": auth})
    return st


def cleanup():
    st, objs = call(URL + "/storage/v1/object/list/campaign-files", SR,
                    data={"prefix": CAMP_A, "search": "tok-check-", "limit": 100})
    for o in objs if isinstance(objs, list) else []:
        if o.get("name", "").startswith("tok-check-"):
            call(URL + "/storage/v1/object/campaign-files/%s/%s" % (CAMP_A, o["name"]), SR, method="DELETE")
    rest("/rest/v1/campaign_chat?join_code=eq." + CODE, method="DELETE")
    # the GM tables' test rows go with the campaign (campaign_id is on delete cascade)
    for t, i in (("characters", CHAR_A), ("characters", CHAR_B), ("campaigns", CAMP_A)):
        rest("/rest/v1/%s?id=eq.%s" % (t, i), method="DELETE")
    for k in (SAVE_A1, SAVE_A2, SAVE_B):
        rest("/rest/v1/saves?save_key=eq." + k, method="DELETE")
    st, users = rest("/auth/v1/admin/users")
    for u in (users or {}).get("users", []):
        if u["email"].startswith("aria-tok-"):
            rest("/auth/v1/admin/users/" + u["id"], method="DELETE")


import urllib.parse  # noqa: E402  (used by ably_publish)

cleanup()
tokA, uidA = account("aria-tok-a@example.com")
tokB, uidB = account("aria-tok-b@example.com")
tokC, uidC = account("aria-tok-c@example.com")
assert tokA and tokB and tokC, "comptes de test"
m = "resolution=merge-duplicates,return=minimal"
rest("/rest/v1/saves", data=[{"save_key": SAVE_A1, "type": "player", "owner": uidA},
                             {"save_key": SAVE_A2, "type": "gm", "owner": uidA},
                             {"save_key": SAVE_B, "type": "player", "owner": uidB}], prefer=m)
rest("/rest/v1/characters", data=[{"id": CHAR_A, "save_key": SAVE_A1, "name": "A", "campaign_key": CODE},
                                  {"id": CHAR_B, "save_key": SAVE_B, "name": "B", "campaign_key": CODE}], prefer=m)
rest("/rest/v1/campaigns", data={"id": CAMP_A, "save_key": SAVE_A2, "name": "Tok", "join_code": CODE}, prefer=m)

try:
    print("-- base : plus rien d'anonyme --")
    st, rows = rest("/rest/v1/saves?select=save_key", ANON)
    check("anon ne liste plus les cles de sauvegarde", st in (401, 403) or rows == [], (st, rows))
    st, rows = rest("/rest/v1/app_config?select=*", ANON, tokC)
    check("app_config n'existe plus (la cle Ably n'est plus en base)", st == 404, (st, rows))

    print("-- fonction : l'identite est celle du compte --")
    st, a = token({"kind": "player", "charId": CHAR_A, "code": CODE}, tokA)
    check("joueur A obtient un jeton pour son personnage", st == 200 and a["clientId"] == CHAR_A, (st, a))
    st, x = token({"kind": "player", "charId": CHAR_B, "code": CODE}, tokA)
    check("joueur A refuse pour le personnage de B", st == 403, (st, x))
    st, x = token({"kind": "player", "charId": CHAR_A, "code": CODE})
    check("sans session : refuse", st == 401, (st, x))
    st, g = token({"kind": "gm", "campaignId": CAMP_A}, tokA)
    check("MJ A obtient 'gm-<campagne>'", st == 200 and g["clientId"] == "gm-" + CAMP_A, (st, g))
    st, x = token({"kind": "gm", "campaignId": CAMP_A}, tokB)
    check("B ne peut pas etre le MJ de la campagne de A", st == 403, (st, x))
    st, o = token({"kind": "overlay", "saveKey": SAVE_A2, "code": CODE, "overlay": "gm_" + CAMP_A})
    check("overlay : jeton avec sa cle de sauvegarde", st == 200 and not o.get("clientId"), (st, o))
    st, x = token({"kind": "overlay", "saveKey": str(uuid.uuid4())})
    check("overlay : cle inconnue refusee", st == 403, (st, x))
    st, x = token({"kind": "overlay", "saveKey": SAVE_B, "overlay": "gm_" + CAMP_A})
    check("overlay : la mise en page d'un autre refusee", st == 403, (st, x))
    st, x = token({"kind": "overlay", "saveKey": SAVE_B, "code": "ZZZZZ"})
    check("overlay : une campagne etrangere refusee", st == 403, (st, x))
    st, x = token({"kind": "sessions", "code": CODE}, tokC)
    check("tableau RDV : un inconnu n'a pas le chat de la campagne", st == 403, (st, x))
    st, sb = token({"kind": "sessions", "code": CODE}, tokB)
    check("tableau RDV : B y est son personnage", st == 200 and sb.get("self") == CHAR_B, (st, sb))

    cap = json.loads(a["tokenRequest"]["capability"])
    check("joueur : pas de lecture de la boite privee du MJ",
          "subscribe" not in cap.get("aria-chat-%s:gm" % CODE, []) and "aria-chat-%s:*" % CODE in cap, cap)

    print("-- Ably applique les droits --")
    ta, tg, to = ably_token(a["tokenRequest"]), ably_token(g["tokenRequest"]), ably_token(o["tokenRequest"])
    check("Ably accepte les jetons signes par la fonction", bool(ta and tg and to))
    check("joueur publie un jet", ably_publish(ta, "aria-rolls-" + CODE) in (200, 201))
    check("joueur ne peut pas publier de musique", ably_publish(ta, "aria-music-" + CODE) == 401)
    check("joueur ne peut pas usurper le clientId du MJ",
          ably_publish(ta, "aria-damage-" + CODE, "gm-" + CAMP_A) in (400, 401))
    check("joueur ecrit dans la boite du MJ", ably_publish(ta, "aria-chat-%s:gm" % CODE) in (200, 201))
    check("joueur ne publie pas de message sur le canal de presence",
          ably_publish(ta, "aria-presence-" + CODE) == 401)
    check("joueur ne touche pas a une autre campagne", ably_publish(ta, "aria-rolls-ZZZZZ") == 401)
    check("MJ publie la musique", ably_publish(tg, "aria-music-" + CODE) in (200, 201))
    check("overlay ne peut pas publier de jet", ably_publish(to, "aria-rolls-" + CODE) == 401)

    print("-- campaign_chat : participants seulement --")
    msg = lambda i, th, au: {"id": "tok-%s" % i, "join_code": CODE, "thread": th, "author_id": au,
                             "author_name": "x", "body": "probe"}
    st, _ = rest("/rest/v1/campaign_chat", ANON, tokB, data=msg(1, "global", CHAR_B), prefer="return=minimal")
    check("B ecrit dans le fil general", st == 201, st)
    st, _ = rest("/rest/v1/campaign_chat", ANON, tokB, data=msg(2, "global", "gm"), prefer="return=minimal")
    check("B ne peut pas ecrire au nom du MJ", st in (401, 403), st)
    st, _ = rest("/rest/v1/campaign_chat", ANON, tokB, data=msg(3, "%s|gm" % CHAR_A, CHAR_B), prefer="return=minimal")
    check("B ne peut pas ecrire dans le fil prive A|MJ", st in (401, 403), st)
    th = "|".join(sorted(["gm", CHAR_A]))
    st, _ = rest("/rest/v1/campaign_chat", ANON, tokA, data=msg(4, th, "gm"), prefer="return=minimal")
    check("le MJ ecrit a A en prive", st == 201, st)
    st, rows = rest("/rest/v1/campaign_chat?join_code=eq.%s&select=thread" % CODE, ANON, tokB)
    check("B lit le general mais pas le prive A|MJ",
          isinstance(rows, list) and {r["thread"] for r in rows} == {"global"}, rows)
    st, rows = rest("/rest/v1/campaign_chat?join_code=eq.%s&select=id" % CODE, ANON, tokC)
    check("un compte etranger a la campagne ne lit rien", rows == [], rows)
    st, _ = rest("/rest/v1/campaign_chat?join_code=eq." + CODE, ANON, tokB, method="DELETE", prefer="return=minimal")
    st, rows = rest("/rest/v1/campaign_chat?join_code=eq.%s&select=id" % CODE)
    check("B ne peut pas effacer le chat de la campagne", len(rows or []) == 2, rows)

    print("-- tables du MJ : un autre compte ne lit ni n'ecrit rien --")
    # A permissive policy left over from before accounts (aria_anon_all, `using (true)`
    # with no role, from gm_tables_rls.sql) would be OR'd with the owner policy: anon is
    # revoked, but every signed-in account would read and write every campaign. B plays
    # at the table (CHAR_B is linked to CODE) and still owns none of this.
    gm_tables = ["monsters", "campaign_potions", "campaign_files", "campaign_maps", "campaign_notes",
                 "campaign_music", "campaign_known_players", "campaign_rolls", "campaign_card_history"]
    no_text_id = {"campaign_rolls", "campaign_card_history"}   # uuid id, defaulted
    row = lambda t, i: {"campaign_id": CAMP_A, **({} if t in no_text_id else {"id": "tok-%s-%s" % (t, i)})}
    for t in gm_tables:
        st, _ = rest("/rest/v1/" + t, data=row(t, "a"), prefer="return=minimal")
        if st != 201:
            check("%s : ligne de test creee" % t, False, st)
            continue
        q = "/rest/v1/%s?campaign_id=eq.%s" % (t, CAMP_A)
        st, rows = rest(q + "&select=campaign_id", ANON, tokA)
        check("%s : le MJ lit sa ligne" % t, isinstance(rows, list) and len(rows) == 1, (st, rows))
        st, rows = rest(q + "&select=campaign_id", ANON, tokB)
        check("%s : B ne lit rien" % t, rows == [], (st, rows))
        st, _ = rest("/rest/v1/" + t, ANON, tokB, data=row(t, "b"), prefer="return=minimal")
        check("%s : B ne peut pas inserer" % t, st in (401, 403), st)
        rest(q, ANON, tokB, method="DELETE", prefer="return=minimal")
        st, rows = rest(q + "&select=campaign_id")
        check("%s : B ne peut pas supprimer" % t, len(rows or []) == 1, rows)

    print("-- campaign_sessions : plus de tableau public --")
    # It carried join codes readable by any signed-in account. Rows go with A's account.
    rest("/rest/v1/campaign_sessions", data={"id": "tok-sess", "join_code": CODE, "title": "t",
                                            "host_id": uidA, "starts_at": "2030-01-01T20:00:00Z"},
         prefer="return=minimal")
    rest("/rest/v1/session_signups", data={"id": "tok-sess:" + uidB, "session_id": "tok-sess",
                                          "user_id": uidB}, prefer="return=minimal")
    st, rows = rest("/rest/v1/campaign_sessions?id=eq.tok-sess&select=join_code", ANON, tokA)
    check("l'hote lit sa seance", isinstance(rows, list) and len(rows) == 1, (st, rows))
    st, rows = rest("/rest/v1/campaign_sessions?id=eq.tok-sess&select=join_code", ANON, tokC)
    check("un inconnu ne lit pas la seance (ni son code)", rows == [], (st, rows))
    st, rows = rest("/rest/v1/session_signups?session_id=eq.tok-sess&select=user_id", ANON, tokA)
    check("l'hote lit les inscrits", isinstance(rows, list) and len(rows) == 1, (st, rows))
    st, rows = rest("/rest/v1/session_signups?session_id=eq.tok-sess&select=user_id", ANON, tokC)
    check("un inconnu ne lit pas les inscrits", rows == [], (st, rows))

    print("-- stockage : pas d'ecrasement ni de suppression chez un autre --")
    # uploads land under something the uploader owns (security_hardening.sql)
    path = "campaign-files/%s/tok-check-%s.txt" % (CAMP_A, uuid.uuid4().hex[:8])
    st, _ = call(URL + "/storage/v1/object/" + path, ANON, tokA, raw=b"probe", headers={"Content-Type": "text/plain"})
    check("A depose un fichier", st == 200, st)
    st, _ = call(URL + "/storage/v1/object/campaign-files/tok-check-root.txt", ANON, tokA, raw=b"probe",
                 headers={"Content-Type": "text/plain"})
    check("A ne depose pas hors de ses dossiers", st >= 400, st)
    st, _ = call(URL + "/storage/v1/object/campaign-files/%s/tok-check-b.txt" % CAMP_A, ANON, tokB, raw=b"evil",
                 headers={"Content-Type": "text/plain"})
    check("B ne depose pas dans la campagne de A", st >= 400, st)
    st, _ = call(URL + "/storage/v1/object/campaign-files/%s/tok-check.html" % CAMP_A, ANON, tokA, raw=b"<p>x</p>",
                 headers={"Content-Type": "text/html"})
    check("type HTML refuse", st >= 400, st)
    st, objs = call(URL + "/storage/v1/object/list/campaign-files", ANON, data={"prefix": CAMP_A, "limit": 10})
    check("un anonyme ne liste rien", objs == [] or st >= 400, (st, objs))
    st, objs = call(URL + "/storage/v1/object/list/campaign-files", ANON, tokB, data={"prefix": CAMP_A, "limit": 10})
    check("B ne liste pas les fichiers de A", objs == [] or st >= 400, (st, objs))
    call(URL + "/storage/v1/object/" + path, ANON, tokB, method="DELETE")
    # Existence through the API, not the public URL: that one is CDN-cached.
    exists = lambda: call(URL + "/storage/v1/object/info/" + path, SR)[0] == 200
    check("B ne peut pas le supprimer", exists())
    st, _ = call(URL + "/storage/v1/object/" + path, ANON, tokB, raw=b"evil", method="PUT",
                 headers={"Content-Type": "text/plain", "x-upsert": "true"})
    check("B ne peut pas l'ecraser", st >= 400, st)
    call(URL + "/storage/v1/object/" + path, ANON, tokA, method="DELETE")
    check("A peut le supprimer", not exists())

    print("-- codes de table : casse, jeton joueur, seances --")
    st, _ = rest("/rest/v1/saves", ANON, tokC, data={"save_key": SAVE_C, "type": "gm"})
    st, _ = rest("/rest/v1/campaigns", ANON, tokC, data={"id": "tok-camp-c", "save_key": SAVE_C, "join_code": CODE.lower()})
    check("C ne prend pas le code de A en minuscules", st >= 400, st)
    st, body = token({"kind": "player", "charId": CHAR_A, "code": "ZZZZZZZZ"}, tokA)
    check("jeton joueur refuse pour une table ou le perso n'est pas", st == 403, (st, body))
    st, _ = rest("/rest/v1/campaign_sessions", ANON, tokC, data={"id": "tok-sess-c", "join_code": CODE, "title": "x",
                                                                 "starts_at": "2030-01-01T00:00:00Z"})
    check("C ne cree pas de seance sur le code de A", st >= 400, st)
    st, _ = rest("/rest/v1/hub_messages", ANON, tokC, data={"to_user": uidB, "body": "spam"})
    check("C n'ecrit pas a un inconnu", st >= 400, st)
finally:
    rest("/rest/v1/campaigns?id=eq.tok-camp-c", method="DELETE")
    rest("/rest/v1/saves?save_key=eq." + SAVE_C, method="DELETE")
    cleanup()

print()
print("ECHECS:", fails if fails else "aucun")
