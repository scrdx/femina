# -*- coding: utf-8 -*-
"""Femina backend smoke test (UTF-8 safe, uses urllib only)."""
import json
import urllib.request
import urllib.parse
import urllib.error

BASE = "http://localhost:8080/api"
PASSWORD = "newpass123"  # changed in previous run


def call(method, path, token=None, body=None, raw=False, headers=None):
    url = BASE + path
    data = None
    hdrs = headers or {}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        hdrs["Content-Type"] = "application/json; charset=utf-8"
    if token:
        hdrs["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            if raw:
                return resp.status, resp.headers, content
            return resp.status, json.loads(content.decode("utf-8"))
    except urllib.error.HTTPError as e:
        content = e.read()
        if raw:
            return e.code, e.headers, content
        try:
            return e.code, json.loads(content.decode("utf-8"))
        except Exception:
            return e.code, content


def show(label, res):
    print(label, json.dumps(res, ensure_ascii=False))


# login
st, login = call("POST", "/auth/login", body={"username": "admin", "password": PASSWORD})
token = login["data"]["token"]
print("login ok, token len", len(token))

# create full person
person = {
    "name": "测试人物", "nickname": "小测",
    "birthYearOnly": False, "birthDate": "2000-05-20",
    "hometown": "河南洛阳", "education": "本科",
    "heightCm": 168, "weightKg": 48.5,
    "mediaDir": "D:/Workspace/femina/testdata/media1", "coverPath": "photo1.png",
    "accounts": [{"type": "手机号", "value": "18437928836"}, {"type": "Telegram", "value": "@test_tg"}],
    "tags": ["测试", "新人"],
}
st, create = call("POST", "/persons", token, person)
show("== create ==", create)
pid = create["data"]["id"]

# create year-only
st, c2 = call("POST", "/persons", token, {"name": "年份人物", "birthYearOnly": True, "birthYear": 1998})
show("== create year-only ==", c2)
pid2 = c2["data"]["id"]

# detail
st, detail = call("GET", "/persons/" + pid, token)
show("== detail ==", detail)
print("   photos:", len(detail["data"]["photos"]), "videos:", len(detail["data"]["videos"]))

# list & search
show("== list ==", call("GET", "/persons?page=1&size=10", token)[1])
for kw in ["小测", "18437928836", "新人", "notexist"]:
    q = urllib.parse.quote(kw)
    st, r = call("GET", "/persons?keyword=" + q, token)
    print("== search %-16s total=%s" % (kw, r["data"]["total"]))

# media file (via token query, like <img>/<video>)
url_file = "/media/file?personId=%s&path=photo1.png&token=%s" % (pid, token)
st, hdrs, content = call("GET", url_file, raw=True)
print("== photo fetch ==", st, hdrs.get("Content-Type"), len(content), "bytes")

# range request on video
st, hdrs, content = call("GET", "/media/file?personId=%s&path=video1.mp4" % pid,
                         token=None, raw=True, headers={"Authorization": "Bearer " + token, "Range": "bytes=5-10"})
print("== video range ==", st, "Content-Range=", hdrs.get("Content-Range"),
      "Content-Length=", hdrs.get("Content-Length"), "Accept-Ranges=", hdrs.get("Accept-Ranges"),
      "body=", content)

# path traversal
show("== traversal ==", call("GET", "/media/file?personId=%s&path=%s" % (pid, urllib.parse.quote("../../backend/pom.xml")), token)[1])
# missing file
show("== missing ==", call("GET", "/media/file?personId=%s&path=nope.png" % pid, token)[1])

# rescan
show("== rescan ==", call("POST", "/persons/%s/rescan" % pid, token)[1])

# update
upd = dict(person)
upd.update({"name": "测试人物改", "nickname": "小测改", "birthYearOnly": True, "birthYear": 2001,
            "hometown": "郑州", "education": "硕士", "coverPath": "sub/photo2.jpg",
            "accounts": [{"type": "抖音", "value": "dy_123"}], "tags": ["测试"]})
show("== update ==", call("PUT", "/persons/" + pid, token, upd)[1])
st, d2 = call("GET", "/persons/" + pid, token)
print("== after update name ==", d2["data"]["name"], "nickname", d2["data"]["nickname"],
      "yearOnly", d2["data"]["birthYearOnly"], "birthYear", d2["data"]["birthYear"],
      "accounts", d2["data"]["accounts"], "tags", d2["data"]["tags"])

# validation: missing name
show("== validation (no name) ==", call("POST", "/persons", token, {"name": ""})[1])

# tags
show("== tags ==", call("GET", "/tags", token)[1])

# delete
show("== delete 1 ==", call("DELETE", "/persons/" + pid, token)[1])
show("== delete 2 ==", call("DELETE", "/persons/" + pid2, token)[1])
print("== final total ==", call("GET", "/persons", token)[1]["data"]["total"])
print("SMOKE TEST DONE")
