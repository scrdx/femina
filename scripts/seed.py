# -*- coding: utf-8 -*-
"""通过 API 播种演示人物，用于前端可视化验证。"""
import json
import os
import urllib.request

BASE = "http://localhost:8080/api"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "testdata", "people"))


def call(method, path, token=None, body=None):
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    hdrs = {}
    if data:
        hdrs["Content-Type"] = "application/json; charset=utf-8"
    if token:
        hdrs["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, data=data, headers=hdrs, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


login = call("POST", "/auth/login", body={"username": "admin", "password": "newpass123"})
token = login["data"]["token"]
print("login ok")

# 清理已有演示人物
existing = call("GET", "/persons?page=1&size=100", token)["data"]["items"]
for p in existing:
    call("DELETE", "/persons/" + p["id"], token)
print("cleared", len(existing), "existing persons")

PEOPLE = [
    {"dir": "alice", "name": "林薇", "nick": "薇薇", "byear": False, "bdate": "2001-03-14",
     "home": "浙江杭州", "edu": "本科", "h": 168, "w": 48.0,
     "acc": [{"type": "手机号", "value": "18437928836"}, {"type": "小红书", "value": "weiwei_0314"}],
     "tags": ["清纯", "学生", "长发"]},
    {"dir": "bella", "name": "苏晴", "nick": "晴子", "byear": True, "bdate": None, "birthYear": 1999,
     "home": "江苏南京", "edu": "硕士", "h": 172, "w": 51.5,
     "acc": [{"type": "Telegram", "value": "@suqing"}, {"type": "微博", "value": "苏晴Sunny"}],
     "tags": ["御姐", "模特"]},
    {"dir": "cecile", "name": "叶婉", "nick": "婉儿", "byear": False, "bdate": "2000-11-02",
     "home": "四川成都", "edu": "大专", "h": 165, "w": 46.0,
     "acc": [{"type": "抖音", "value": "waner_1102"}],
     "tags": ["可爱", "舞蹈", "川妹子"]},
    {"dir": "diana", "name": "顾涵", "nick": "涵涵", "byear": False, "bdate": "1998-07-21",
     "home": "广东深圳", "edu": "本科", "h": 170, "w": 50.0,
     "acc": [{"type": "手机号", "value": "17342051905"}, {"type": "Instagram", "value": "han.gu"}],
     "tags": ["知性", "职场"]},
    {"dir": "elena", "name": "白露", "nick": "露露", "byear": True, "bdate": None, "birthYear": 2002,
     "home": "山东青岛", "edu": "高中", "h": 167, "w": 47.0,
     "acc": [{"type": "快手", "value": "bailu_2002"}],
     "tags": ["清新", "海边"]},
    {"dir": "faye", "name": "沈悦", "nick": "悦悦", "byear": False, "bdate": "1997-01-09",
     "home": "湖北武汉", "edu": "博士", "h": 174, "w": 53.0,
     "acc": [{"type": "微信", "value": "yue_shen_0109"}, {"type": "Twitter/X", "value": "@faye_shen"}],
     "tags": ["高挑", "学霸", "气质"]},
]

for p in PEOPLE:
    mediaDir = os.path.join(ROOT, p["dir"]).replace("\\", "/")
    body = {
        "name": p["name"], "nickname": p["nick"],
        "birthYearOnly": p["byear"],
        "birthDate": p["bdate"] or "",
        "birthYear": p.get("birthYear") or "",
        "hometown": p["home"], "education": p["edu"],
        "heightCm": p["h"], "weightKg": p["w"],
        "mediaDir": mediaDir, "coverPath": "cover.jpg",
        "accounts": p["acc"], "tags": p["tags"],
    }
    r = call("POST", "/persons", token, body)
    print("created", p["name"], r["data"]["id"])

total = call("GET", "/persons?page=1&size=100", token)["data"]["total"]
print("total persons now:", total)
print("SEED DONE")
