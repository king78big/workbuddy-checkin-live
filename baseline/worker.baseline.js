var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var Trae = (() => {
  const API = "https://api.trae.cn";
  const EP = {
    claim: "/trae/api/v2/ug/checkin_credits/claim",
    status: "/trae/api/v2/ug/checkin_credits/status",
    entitle: "/trae/api/v2/pay/user_current_entitlement_list",
    exchange: "/trae/api/v3/oauth/ExchangeToken",
    exchangeLegacy: "https://api.trae.com.cn/cloudide/api/v3/trae/oauth/ExchangeToken"
  };
  const CLIENT_ID_IDE = "ono9krqynydwx5";
  const CLIENT_ID_OLD = "en1oxy7wnw8j9n";
  const IDE_VERSION = "1.107.1";
  const UA = "Trae/" + IDE_VERSION;
  const AUTHORIZE_BASE = "https://www.trae.cn";
  const OAUTH_APP_ID = "6eefa01c-1036-4c7e-9ca5-d891f63bfcd8";
  const OAUTH_APP_VERSION = "3.3.100";
  const OAUTH_PLUGIN_VERSION = "2.3.83560";
  const CALLBACK_LOCAL = "http://127.0.0.1:17388/authorize";
  const TRAE_LINE = { authFrom: "trae", clientId: "ono9krqynydwx5", platform: "IDE_PC", label: "Trae" };
  const LOGIN_TTL = 900;
  const LOGIN_LATEST = "login:latest";
  const REQ_BODY = '{"req_source": 1}';
  const CODE_OK = 0;
  const CODE_ALREADY = 9095;
  const CODE_RATE = 9074;
  const AUTH_FAIL_CODES = [1001, 1002, 401, 403];
  const COOLDOWN_MIN = 55;
  const PEAK_COOLDOWN_MIN = 12;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  function b64encode(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  __name(b64encode, "b64encode");
  function b64decode(str) {
    const bin = atob(String(str).replace(/\s+/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  __name(b64decode, "b64decode");
  function b64urlEncode(buf) {
    return b64encode(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  __name(b64urlEncode, "b64urlEncode");
  function b64urlDecode(str) {
    const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
    return b64decode(s + "=".repeat((4 - s.length % 4) % 4));
  }
  __name(b64urlDecode, "b64urlDecode");
  function randomId(bytes = 12) {
    return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
  }
  __name(randomId, "randomId");
  function randomHex(bytes = 16) {
    const b = crypto.getRandomValues(new Uint8Array(bytes));
    let s = "";
    for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
    return s;
  }
  __name(randomHex, "randomHex");
  function timingSafeEqual(a, b) {
    const x = enc.encode(String(a ?? ""));
    const y = enc.encode(String(b ?? ""));
    if (x.length !== y.length) return false;
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
  }
  __name(timingSafeEqual, "timingSafeEqual");
  async function deriveKey(env, salt) {
    const raw = env.TRAE_MASTER_KEY;
    if (!raw) throw new Error("\u7F3A\u5C11 MASTER_KEY");
    let master;
    try {
      master = b64decode(raw.trim());
    } catch {
      throw new Error("MASTER_KEY \u4E0D\u662F\u5408\u6CD5 base64");
    }
    if (master.length !== 32) throw new Error("MASTER_KEY \u5FC5\u987B\u662F 32 \u5B57\u8282\uFF08base64 \u540E 44 \u5B57\u7B26\uFF09");
    const base = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("trae-signin/v1/account") },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
  __name(deriveKey, "deriveKey");
  async function sealRecord(env, obj) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(env, salt);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
    return JSON.stringify({ v: 1, s: b64encode(salt), i: b64encode(iv), d: b64encode(ct) });
  }
  __name(sealRecord, "sealRecord");
  async function openRecord(env, text) {
    const box = JSON.parse(text);
    if (box.v !== 1) throw new Error("\u4E0D\u8BA4\u8BC6\u7684\u8BB0\u5F55\u7248\u672C");
    const key = await deriveKey(env, b64decode(box.s));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(box.i) }, key, b64decode(box.d));
    return JSON.parse(dec.decode(pt));
  }
  __name(openRecord, "openRecord");
  const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
  function pemToDer(pem) {
    const body = String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
    return b64decode(body);
  }
  __name(pemToDer, "pemToDer");
  function bytesToBig(bytes) {
    let h = "";
    for (const b of bytes) h += b.toString(16).padStart(2, "0");
    return h ? BigInt("0x" + h) : 0n;
  }
  __name(bytesToBig, "bytesToBig");
  function bigToBytes(x) {
    let h = x.toString(16);
    if (h.length % 2) h = "0" + h;
    const out = [];
    for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
    return Uint8Array.from(out);
  }
  __name(bigToBytes, "bigToBytes");
  function derInt(bytes) {
    const arr = Array.from(bytes);
    let i = 0;
    while (i < arr.length - 1 && arr[i] === 0) i++;
    let v = arr.slice(i);
    if (v.length === 0 || v[0] & 128) v = [0, ...v];
    return [2, v.length, ...v];
  }
  __name(derInt, "derInt");
  function derSig(rBytes, sBytes) {
    const body = derInt(rBytes).concat(derInt(sBytes));
    return Uint8Array.from([48, body.length, ...body]);
  }
  __name(derSig, "derSig");
  function derNext(buf, i) {
    const tag = buf[i++];
    let len = buf[i++];
    if (len & 128) {
      const n = len & 127;
      len = 0;
      for (let k = 0; k < n; k++) len = len * 256 + buf[i++];
    }
    return { tag, val: buf.subarray(i, i + len), next: i + len };
  }
  __name(derNext, "derNext");
  function sec1Scalar(pem) {
    const der = pemToDer(pem);
    const outer = derNext(der, 0);
    if (outer.tag !== 48) throw new Error("SEC1 \u79C1\u94A5\u7ED3\u6784\u5F02\u5E38");
    let i = 0;
    let d = null;
    while (i < outer.val.length) {
      const node = derNext(outer.val, i);
      if (node.tag === 4 && !d) d = node.val;
      i = node.next;
    }
    if (!d) throw new Error("SEC1 \u79C1\u94A5\u91CC\u6CA1\u627E\u5230\u79C1\u94A5\u6807\u91CF");
    return d;
  }
  __name(sec1Scalar, "sec1Scalar");
  function spkiPoint(pem) {
    const der = pemToDer(pem);
    const outer = derNext(der, 0);
    if (outer.tag !== 48) throw new Error("\u516C\u94A5\u7ED3\u6784\u5F02\u5E38");
    const alg = derNext(outer.val, 0);
    const bits = derNext(outer.val, alg.next);
    if (bits.tag !== 3 || bits.val[0] !== 0 || bits.val[1] !== 4) {
      throw new Error("\u516C\u94A5\u4E0D\u662F\u672A\u538B\u7F29\u7684 P-256 \u70B9");
    }
    return { x: bits.val.subarray(2, 34), y: bits.val.subarray(34, 66) };
  }
  __name(spkiPoint, "spkiPoint");
  const ecdsaAlg = { name: "ECDSA", namedCurve: "P-256" };
  async function importPrivateKey(pem, pubPem) {
    if (!pem) throw new Error("\u7F3A\u5C11\u8BBE\u5907\u79C1\u94A5");
    try {
      return await crypto.subtle.importKey("pkcs8", pemToDer(pem), ecdsaAlg, false, ["sign"]);
    } catch (e) {
      if (!pubPem) throw new Error("\u79C1\u94A5\u4E0D\u662F PKCS#8\uFF0C\u4E14\u6CA1\u6709\u516C\u94A5\u53EF\u7528\u4E8E SEC1 \u8F6C\u6362");
      const d = sec1Scalar(pem);
      const { x, y } = spkiPoint(pubPem);
      return crypto.subtle.importKey(
        "jwk",
        { kty: "EC", crv: "P-256", d: b64urlEncode(d), x: b64urlEncode(x), y: b64urlEncode(y), ext: true },
        ecdsaAlg,
        false,
        ["sign"]
      );
    }
  }
  __name(importPrivateKey, "importPrivateKey");
  async function ecSign(pem, data, pubPem) {
    const key = await importPrivateKey(pem, pubPem);
    const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data));
    let r = bytesToBig(raw.subarray(0, 32));
    let s = bytesToBig(raw.subarray(32));
    if (s > P256_N >> 1n) s = P256_N - s;
    return b64encode(derSig(bigToBytes(r), bigToBytes(s)));
  }
  __name(ecSign, "ecSign");
  async function traeFetch(path, { method = "POST", headers = {}, body = "{}", timeout = 2e4 } = {}) {
    const url = path.startsWith("http") ? path : API + path;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: method === "GET" ? void 0 : body,
        signal: ctrl.signal
      });
      const text = await res.text();
      let json3 = null;
      try {
        json3 = JSON.parse(text);
      } catch {
      }
      return { status: res.status, json: json3, text };
    } finally {
      clearTimeout(timer);
    }
  }
  __name(traeFetch, "traeFetch");
  function ugHeaders(token, acct) {
    const h = {
      Authorization: "Cloud-IDE-JWT " + token,
      "X-User-Region": "CN",
      "User-Agent": UA,
      "Content-Type": "application/json"
    };
    const did = String(acct?.deviceId ?? "").trim();
    if (did) h["x-device-id"] = did;
    h["x-device-type"] = String(acct?.deviceType || "Windows");
    h["x-os-version"] = String(acct?.osVersion || "10.0.19045");
    h["x-app-version"] = IDE_VERSION;
    const brand = String(acct?.deviceBrand ?? "").trim();
    if (brand) h["x-device-brand"] = brand;
    return h;
  }
  __name(ugHeaders, "ugHeaders");
  function jwtExp(token) {
    try {
      const json3 = JSON.parse(dec.decode(b64urlDecode(String(token).split(".")[1])));
      let v = Number(json3.exp || json3.TokenExpireAt || 0) || 0;
      if (v > 1e12) v = Math.floor(v / 1e3);
      return v;
    } catch {
      return 0;
    }
  }
  __name(jwtExp, "jwtExp");
  async function buildProof(acct, path, clientId, platformCode, refreshToken) {
    const ts = Math.floor(Date.now() / 1e3);
    const nonce = randomHex(16);
    const canonical = ["POST", path, clientId, refreshToken, String(ts), nonce].join("\n");
    const signature = await ecSign(acct.privateKeyPem, enc.encode(canonical), acct.publicKeyPem);
    return {
      proof: { Timestamp: ts, Nonce: nonce, Signature: signature },
      info: {
        DeviceID: String(acct.deviceId || ""),
        MachineID: String(acct.machineId || ""),
        PlatformCode: platformCode,
        DeviceType: "PC",
        DeviceName: String(acct.deviceName || "PC"),
        DeviceModel: String(acct.deviceModel || ""),
        ClientVersion: IDE_VERSION,
        DevicePublicKey: String(acct.publicKeyPem || ""),
        DeviceBrand: String(acct.deviceBrand || ""),
        DeviceCPU: "",
        OSInfo: String(acct.osInfo || "Windows"),
        OSVersion: String(acct.osVersion || "10.0.19045")
      }
    };
  }
  __name(buildProof, "buildProof");
  function explainRefreshErr(json3, text) {
    const err = json3?.ResponseMetadata?.Error || {};
    const code = err.Code;
    const msg = err.Data && err.Data["__Message.error"] || err.Message || String(text).slice(0, 200);
    const hint = {
      20101: "refreshToken \u5DF2\u5931\u6548\u6216\u88AB\u522B\u5904\u8F6E\u6362\uFF0C\u8BF7\u5220\u6389\u8BE5\u8D26\u53F7\u91CD\u65B0\u626B\u7801\u767B\u5F55",
      10101: "refreshToken \u4E0E\u5F53\u524D\u4EA7\u54C1\u7EBF\u4E0D\u5339\u914D\uFF0C\u8BF7\u7528\u5BF9\u5E94\u6309\u94AE\u91CD\u65B0\u626B\u7801\u767B\u5F55",
      20405: "\u670D\u52A1\u7AEF\u8981\u6C42\u8BBE\u5907\u8BC1\u660E\uFF0C\u4F46\u8BE5\u8D26\u53F7\u7F3A\u5C11\u8BBE\u5907\u5BC6\u94A5\uFF0C\u8BF7\u5220\u6389\u540E\u91CD\u65B0\u626B\u7801\u767B\u5F55",
      20403: "\u8BBE\u5907\u5BC6\u94A5\u4E0E\u4EE4\u724C\u4E0D\u5339\u914D\uFF0C\u8BF7\u5220\u6389\u8BE5\u8D26\u53F7\u91CD\u65B0\u626B\u7801\u767B\u5F55"
    }[code] || "";
    return `code=${code ?? "?"} ${msg}${hint ? "\uFF08" + hint + "\uFF09" : ""}`;
  }
  __name(explainRefreshErr, "explainRefreshErr");
  async function refreshTokens(acct) {
    const rt = String(acct.refreshToken || "").trim();
    if (!rt) throw new Error("\u8D26\u53F7\u6CA1\u6709 refreshToken");
    const hasKeys = !!(acct.privateKeyPem && acct.publicKeyPem);
    if (!hasKeys) {
      const body = JSON.stringify({
        ClientID: CLIENT_ID_OLD,
        RefreshToken: rt,
        ClientSecret: "-",
        UserID: ""
      });
      const r = await traeFetch(EP.exchangeLegacy, {
        headers: { Accept: "application/json", "User-Agent": UA },
        body
      });
      const token = r.json?.Result?.Token;
      if (r.status >= 400 || !token) throw new Error("\u5237\u65B0\u4EE4\u724C\u5931\u8D25: " + explainRefreshErr(r.json, r.text));
      return {
        accessToken: token,
        refreshToken: r.json.Result.RefreshToken || rt
      };
    }
    const combos = [
      [acct.clientId || CLIENT_ID_IDE, acct.platformCode || "IDE_PC"],
      [CLIENT_ID_OLD, "IDE_PC"],
      [CLIENT_ID_OLD, "SOLO_PC"]
    ].filter((v, i, arr) => arr.findIndex((x) => x[0] === v[0] && x[1] === v[1]) === i);
    let lastErr = null;
    for (const [clientId, platformCode] of combos) {
      let built;
      try {
        built = await buildProof(acct, EP.exchange, clientId, platformCode, rt);
      } catch (e) {
        throw new Error("\u8BBE\u5907\u7B7E\u540D\u5931\u8D25\uFF08\u68C0\u67E5\u8BBE\u5907\u79C1\u94A5\uFF09: " + e.message);
      }
      const body = JSON.stringify({
        ClientID: clientId,
        ClientSecret: "",
        RefreshToken: rt,
        DeviceInfo: built.info,
        DeviceProof: built.proof,
        IDEVersion: IDE_VERSION
      });
      const r = await traeFetch(EP.exchange, {
        headers: { "x-cloudide-token": "" },
        body
      });
      const token = r.json?.Result?.Token;
      if (r.status < 400 && token) {
        return { accessToken: token, refreshToken: r.json.Result.RefreshToken || rt };
      }
      lastErr = explainRefreshErr(r.json, r.text);
      const raw = String(r.text || "");
      if (!raw.includes("10101") && !raw.includes("20403")) break;
    }
    throw new Error("\u5237\u65B0\u4EE4\u724C\u5931\u8D25: " + (lastErr || "\u672A\u77E5\u9519\u8BEF"));
  }
  __name(refreshTokens, "refreshTokens");
  async function claim(token, acct) {
    const r = await traeFetch(EP.claim, { headers: ugHeaders(token, acct), body: REQ_BODY });
    if (!r.json) return { status: r.status, code: "?", msg: String(r.text).slice(0, 160), points: null };
    const data = r.json.data;
    const points = data && typeof data === "object" ? data.points ?? null : null;
    return {
      status: r.status,
      code: r.json.code ?? -1,
      msg: r.json.message || String(r.text).slice(0, 160),
      points
    };
  }
  __name(claim, "claim");
  async function statusOf(token, acct) {
    const r = await traeFetch(EP.status, { headers: ugHeaders(token, acct), body: REQ_BODY });
    if (!r.json) return { ok: false, code: "?", raw: String(r.text).slice(0, 160) };
    if (r.status >= 400) return { ok: false, code: r.json.code ?? -1, raw: String(r.text).slice(0, 160) };
    return {
      ok: true,
      checked: r.json.checked_in === true,
      credits: typeof r.json.credits === "number" ? r.json.credits : null,
      enable: r.json.enable ?? null,
      code: r.json.code ?? -1
    };
  }
  __name(statusOf, "statusOf");
  async function creditsOf(token, acct) {
    const r = await traeFetch(EP.entitle, { headers: ugHeaders(token, acct), body: '{"require_usage": true}' });
    const d = r.json;
    if (!d) return null;
    const root = d.data || d;
    const us = root.usage_summary || {};
    const total = Number(us.total_amount || 0);
    const used = Number(us.consumed_amount || 0);
    if (total > 0) return total - used;
    const packs = root.user_entitlement_pack_list || [];
    let sum = 0;
    let found = false;
    for (const p of packs) {
      const limit = Number(p?.entitlement_base_info?.quota?.credits_limit || 0);
      const consumed = Number(p?.usage?.credits_amount || 0);
      if (limit > 0) {
        found = true;
        sum += Math.max(limit - consumed, 0);
      }
    }
    return found ? sum : null;
  }
  __name(creditsOf, "creditsOf");
  const acctKey = /* @__PURE__ */ __name((id) => `acct:${id}`, "acctKey");
  const INDEX_KEY = "index:accounts";
  async function listAccounts(env) {
    const raw = await env.TRAE_KV.get(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  __name(listAccounts, "listAccounts");
  async function saveIndex(env, list) {
    await env.TRAE_KV.put(INDEX_KEY, JSON.stringify(list));
  }
  __name(saveIndex, "saveIndex");
  async function getAccount(env, id) {
    const raw = await env.TRAE_KV.get(acctKey(id));
    if (!raw) return null;
    return openRecord(env, raw);
  }
  __name(getAccount, "getAccount");
  async function putAccount(env, acct) {
    await env.TRAE_KV.put(acctKey(acct.id), await sealRecord(env, acct));
  }
  __name(putAccount, "putAccount");
  const bjDay = /* @__PURE__ */ __name((ms = Date.now()) => new Date(ms + 8 * 36e5).toISOString().slice(0, 10), "bjDay");
  const bjHour = /* @__PURE__ */ __name((ms = Date.now()) => new Date(ms + 8 * 36e5).getUTCHours(), "bjHour");
  function cooldownMinutes() {
    return bjHour() === 0 ? PEAK_COOLDOWN_MIN : COOLDOWN_MIN;
  }
  __name(cooldownMinutes, "cooldownMinutes");
  async function signinOne(env, acct, { force = false } = {}) {
    const now = Date.now();
    const today = bjDay(now);
    const base = { id: acct.id, label: acct.label };
    if (!force && Number(acct.cooldownUntil || 0) > now) {
      const left = Math.ceil((acct.cooldownUntil - now) / 6e4);
      return { ...base, state: "cooldown", msg: `\u9650\u6D41\u51B7\u5374\u4E2D\uFF0C\u7EA6 ${left} \u5206\u949F` };
    }
    if (!force && acct.lastOkDate === today) {
      return { ...base, state: "skipped", msg: "\u4ECA\u65E5\u5DF2\u5B8C\u6210" };
    }
    let token = String(acct.accessToken || "");
    const exp = jwtExp(token);
    const usable = token && (!exp || exp * 1e3 - now > 12e4);
    if (!usable) {
      try {
        const t = await refreshTokens(acct);
        token = t.accessToken;
        acct.refreshToken = t.refreshToken;
        acct.accessToken = token;
        acct.accessExp = jwtExp(token);
        acct.tokenRefreshedAt = now;
        await putAccount(env, acct);
      } catch (e) {
        acct.lastState = "token_dead";
        acct.lastMsg = e.message;
        acct.lastRun = now;
        await putAccount(env, acct);
        return { ...base, state: "token_dead", msg: e.message };
      }
    }
    let res = await claim(token, acct);
    if (AUTH_FAIL_CODES.includes(res.code)) {
      try {
        const t = await refreshTokens(acct);
        token = t.accessToken;
        acct.refreshToken = t.refreshToken;
        acct.accessToken = token;
        acct.accessExp = jwtExp(token);
        await putAccount(env, acct);
        res = await claim(token, acct);
      } catch (e) {
        acct.lastState = "token_dead";
        acct.lastMsg = e.message;
        acct.lastRun = now;
        await putAccount(env, acct);
        return { ...base, state: "token_dead", msg: e.message };
      }
    }
    acct.lastRun = now;
    if (res.code === CODE_RATE || res.status === 429 || res.status >= 500) {
      const mins = cooldownMinutes();
      acct.cooldownUntil = now + mins * 6e4;
      acct.lastState = "rate";
      acct.lastMsg = `\u9650\u6D41 9074\uFF0C\u51B7\u5374 ${mins} \u5206\u949F`;
      await putAccount(env, acct);
      return { ...base, state: "rate", msg: acct.lastMsg };
    }
    if (res.code === CODE_ALREADY) {
      acct.lastState = "already";
      acct.lastMsg = "\u4ECA\u65E5\u5DF2\u7B7E";
      acct.lastOkDate = today;
      acct.cooldownUntil = 0;
      const st = await statusOf(token, acct).catch(() => null);
      if (st?.ok) {
        acct.credits = st.credits ?? acct.credits ?? null;
        acct.checkedIn = true;
      }
      await putAccount(env, acct);
      return { ...base, state: "already", msg: "\u4ECA\u65E5\u5DF2\u7B7E", credits: acct.credits ?? null };
    }
    if (res.code !== CODE_OK) {
      acct.lastState = "error";
      acct.lastMsg = `\u7B7E\u5230\u5931\u8D25 code=${res.code} ${res.msg ?? ""}`.trim();
      await putAccount(env, acct);
      return { ...base, state: "error", msg: acct.lastMsg };
    }
    let confirmed = false;
    let credits = null;
    try {
      const st = await statusOf(token, acct);
      if (st.ok) {
        confirmed = st.checked === true;
        credits = st.credits;
      }
    } catch {
    }
    if (!confirmed) {
      const bal2 = await creditsOf(token, acct).catch(() => null);
      acct.lastState = "pending";
      acct.lastMsg = "\u5DF2\u63D0\u4EA4\uFF0C\u4F46\u56DE\u67E5\u672A\u786E\u8BA4\uFF0C\u7B49\u4E0B\u8F6E\u518D\u8BD5";
      acct.credits = bal2 ?? credits ?? acct.credits ?? null;
      acct.cooldownUntil = now + 12 * 6e4;
      await putAccount(env, acct);
      return { ...base, state: "pending", msg: acct.lastMsg, credits: acct.credits ?? null };
    }
    const bal = await creditsOf(token, acct).catch(() => null);
    acct.lastState = "checked";
    acct.lastMsg = res.points ? `+${res.points} \u79EF\u5206` : "\u7B7E\u5230\u6210\u529F";
    acct.lastOkDate = today;
    acct.lastCredit = res.points ?? null;
    acct.totalCredit = (acct.totalCredit ?? 0) + (Number(res.points) || 0);
    acct.totalSigned = (acct.totalSigned ?? 0) + 1;
    acct.credits = bal ?? credits ?? acct.credits ?? null;
    acct.checkedIn = true;
    acct.cooldownUntil = 0;
    await putAccount(env, acct);
    return {
      ...base,
      state: "checked",
      msg: acct.lastMsg,
      credits: acct.credits ?? null,
      points: res.points ?? null
    };
  }
  __name(signinOne, "signinOne");
  function json2(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
  __name(json2, "json");
  function requireAdmin2(request, env) {
    const url = new URL(request.url);
    const given = request.headers.get("X-Admin-Token") || (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") || url.searchParams.get("token");
    if (!env.ADMIN_TOKEN) return { ok: false, res: json2({ error: "\u672A\u914D\u7F6E ADMIN_TOKEN" }, 500) };
    if (!timingSafeEqual(given, env.ADMIN_TOKEN)) return { ok: false, res: json2({ error: "\u767B\u5F55\u5BC6\u7801\u4E0D\u6B63\u786E" }, 401) };
    return { ok: true };
  }
  __name(requireAdmin2, "requireAdmin");
  function requireCron2(request, env) {
    const secret = env.CRON_SECRET || env.ADMIN_TOKEN;
    const url = new URL(request.url);
    const given = request.headers.get("X-Cron-Secret") || url.searchParams.get("key");
    if (!secret) return { ok: false, res: json2({ error: "\u672A\u914D\u7F6E CRON_SECRET / ADMIN_TOKEN" }, 500) };
    if (!timingSafeEqual(given, secret)) return { ok: false, res: json2({ error: "\u53E3\u4EE4\u4E0D\u5BF9" }, 401) };
    return { ok: true };
  }
  __name(requireCron2, "requireCron");
  async function readBody(request) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }
  __name(readBody, "readBody");
  async function handleRemove(request, env) {
    const body = await readBody(request);
    const id = String(body.id ?? "").trim();
    if (!id) return json2({ error: "\u7F3A\u5C11 id" }, 400);
    await env.TRAE_KV.delete(acctKey(id));
    const list = (await listAccounts(env)).filter((x) => x.id !== id);
    await saveIndex(env, list);
    return json2({ ok: true, removed: id });
  }
  __name(handleRemove, "handleRemove");
  async function handleRename(request, env) {
    const body = await readBody(request);
    const id = String(body.id ?? "").trim();
    const label = String(body.label ?? "").trim().slice(0, 40);
    if (!id) return json2({ error: "\u7F3A\u5C11 id" }, 400);
    if (!label) return json2({ error: "\u5907\u6CE8\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
    const acct = await getAccount(env, id);
    if (!acct) return json2({ error: "\u8D26\u53F7\u4E0D\u5B58\u5728" }, 404);
    acct.label = label;
    await putAccount(env, acct);
    const list = await listAccounts(env);
    await saveIndex(env, list.map((x) => x.id === id ? { ...x, label } : x));
    return json2({ ok: true, id, label });
  }
  __name(handleRename, "handleRename");
  async function handleList(request, env) {
    const list = await listAccounts(env);
    const out = [];
    const now = Date.now();
    const today = bjDay(now);
    for (const meta of list) {
      const a = await getAccount(env, meta.id);
      if (!a) continue;
      out.push({
        id: a.id,
        label: a.label,
        lastState: a.lastState,
        lastMsg: a.lastMsg,
        lastRun: a.lastRun ? new Date(a.lastRun + 8 * 36e5).toISOString().replace("Z", " +08:00") : null,
        lastOkDate: a.lastOkDate ?? null,
        lastCredit: a.lastCredit ?? null,
        credits: typeof a.credits === "number" ? Math.round(a.credits * 100) / 100 : null,
        totalCredit: a.totalCredit ?? 0,
        totalSigned: a.totalSigned ?? 0,
        cooldownUntil: Number(a.cooldownUntil || 0) > now ? a.cooldownUntil : 0,
        hasKeys: !!(a.privateKeyPem && a.publicKeyPem),
        hasDevice: !!String(a.deviceId || "").trim(),
        // 服务端当场判定，避免前端拿历史状态跨天残留
        today,
        signedToday: a.lastOkDate === today,
        ranToday: a.lastRun ? bjDay(a.lastRun) === today : false
        // 令牌与私钥永不下发
      });
    }
    return json2({ count: out.length, today, accounts: out });
  }
  __name(handleList, "handleList");
  async function handleRun(request, env, force) {
    const list = await listAccounts(env);
    const results = [];
    for (const meta of list) {
      const a = await getAccount(env, meta.id);
      if (!a) continue;
      try {
        results.push(await signinOne(env, a, { force }));
      } catch (e) {
        results.push({ id: a.id, label: a.label, state: "error", msg: e.message });
      }
    }
    return json2({
      at: new Date(Date.now() + 8 * 36e5).toISOString().replace("Z", " +08:00"),
      accounts: results.length,
      checked: results.filter((r) => r.state === "checked").length,
      already: results.filter((r) => ["already", "skipped"].includes(r.state)).length,
      failed: results.filter((r) => ["error", "token_dead"].includes(r.state)).length,
      cooling: results.filter((r) => ["rate", "cooldown", "pending"].includes(r.state)).length,
      results
    });
  }
  __name(handleRun, "handleRun");
  const b64std = /* @__PURE__ */ __name((buf) => b64encode(buf), "b64std");
  function toPem(der, label) {
    const b = b64std(der);
    const lines = b.match(/.{1,64}/g) || [];
    return `-----BEGIN ${label}-----
${lines.join("\n")}
-----END ${label}-----`;
  }
  __name(toPem, "toPem");
  async function genDeviceIdentity() {
    const kp = await crypto.subtle.generateKey(ecdsaAlg, true, ["sign", "verify"]);
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
    const spki = await crypto.subtle.exportKey("spki", kp.publicKey);
    return {
      privateKeyPem: toPem(pkcs8, "PRIVATE KEY"),
      publicKeyPem: toPem(spki, "PUBLIC KEY")
    };
  }
  __name(genDeviceIdentity, "genDeviceIdentity");
  function genDeviceId() {
    const a = crypto.getRandomValues(new Uint8Array(15));
    let s = String(1 + a[0] % 9);
    for (let i = 1; i < 15; i++) s += String(a[i] % 10);
    return s;
  }
  __name(genDeviceId, "genDeviceId");
  async function pkcePair() {
    const verifier = randomHex(32);
    const digest = await crypto.subtle.digest("SHA-256", enc.encode(verifier));
    return { verifier, challenge: b64urlEncode(digest) };
  }
  __name(pkcePair, "pkcePair");
  function qsQuote(v) {
    return encodeURIComponent(String(v)).replace(/%2F/g, "/");
  }
  __name(qsQuote, "qsQuote");
  function buildAuthorizeUrl(o) {
    const params = [
      ["login_version", "1"],
      ["auth_from", o.authFrom],
      ["login_channel", "native_ide"],
      ["plugin_version", OAUTH_PLUGIN_VERSION],
      ["auth_type", "local"],
      ["client_id", o.clientId],
      ["redirect", "0"],
      ["login_trace_id", o.trace],
      ["auth_callback_url", o.callback],
      ["machine_id", o.machineId],
      ["device_id", o.deviceId],
      ["x_device_id", o.deviceId],
      ["x_machine_id", o.machineId],
      ["x_device_brand", "PC"],
      ["x_device_type", "Windows"],
      ["x_os_version", "10.0.19045"],
      ["x_env", ""],
      ["x_app_version", OAUTH_APP_VERSION],
      ["x_app_type", "stable"],
      ["code_challenge", o.challenge],
      ["code_challenge_method", "S256"],
      ["channel_name", "common"]
    ];
    return AUTHORIZE_BASE + "/authorization?" + params.map(([k, v]) => k + "=" + qsQuote(v)).join("&");
  }
  __name(buildAuthorizeUrl, "buildAuthorizeUrl");
  function hostBase(h) {
    const s = String(h || "").trim();
    if (!s) return "https://api.trae.cn";
    if (/^https?:\/\//i.test(s)) return s.replace(/\/+$/, "");
    return "https://" + s.replace(/\/+$/, "");
  }
  __name(hostBase, "hostBase");
  function deepFind(obj, keys, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 6) return "";
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    for (const v of Object.values(obj)) {
      const r = deepFind(v, keys, depth + 1);
      if (r) return r;
    }
    return "";
  }
  __name(deepFind, "deepFind");
  const ACCESS_KEYS = ["AccessToken", "access_token", "token", "Jwt", "JWT"];
  const REFRESH_KEYS = ["RefreshToken", "refresh_token"];
  const NICK_KEYS = [
    "Nickname",
    "nickname",
    "NickName",
    "nick_name",
    "UserName",
    "userName",
    "user_name",
    "username",
    "ScreenName",
    "screen_name",
    "DisplayName",
    "displayName",
    "display_name",
    "Name",
    "name"
  ];
  function pickNickname(obj, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 5) return "";
    for (const k of NICK_KEYS) {
      const v = obj[k];
      if (typeof v === "string") {
        const s = v.trim();
        if (s && s.length <= 32 && !/^(pc|windows|web|ide|trae|unknown)$/i.test(s)) return s;
      }
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") {
        const r = pickNickname(v, depth + 1);
        if (r) return r;
      }
    }
    return "";
  }
  __name(pickNickname, "pickNickname");
  function nicknameFromJwt(tok) {
    const parts = String(tok || "").split(".");
    if (parts.length < 3) return "";
    try {
      return pickNickname(JSON.parse(dec.decode(b64urlDecode(parts[1]))));
    } catch {
      return "";
    }
  }
  __name(nicknameFromJwt, "nicknameFromJwt");
  function describeExchangeErr(json3, text, status) {
    const err = json3?.ResponseMetadata?.Error || json3?.error || {};
    const code = err.Code ?? json3?.code;
    const msg = err.Data && err.Data["__Message.error"] || err.Message || json3?.message || json3?.msg || String(text || "").slice(0, 160);
    return `code=${code ?? "?"} ${msg} (HTTP ${status})`;
  }
  __name(describeExchangeErr, "describeExchangeErr");
  async function exchangeAuthCode({ authCode, verifier, device, clientId, platform, host }) {
    const dev = {
      DeviceID: String(device.deviceId || ""),
      MachineID: String(device.machineId || ""),
      PlatformCode: platform,
      DeviceType: "PC",
      DeviceName: "PC",
      DeviceModel: "",
      ClientVersion: OAUTH_APP_VERSION,
      DevicePublicKey: String(device.publicKeyPem || ""),
      DeviceBrand: "",
      DeviceCPU: "",
      OSInfo: "Windows",
      OSVersion: "10.0.19045"
    };
    const baseHeaders = {
      Accept: "*/*",
      "User-Agent": "Trae/" + OAUTH_APP_VERSION,
      "x-device-id": dev.DeviceID,
      "x-app-id": OAUTH_APP_ID,
      "x-platform-code": platform
    };
    const variants = [
      {
        tag: "DeviceInfo",
        url: hostBase(host) + EP.exchange,
        headers: { ...baseHeaders, "x-cloudide-token": "" },
        body: {
          ClientID: clientId,
          AuthCode: authCode,
          CodeVerifier: verifier,
          DeviceInfo: dev,
          IDEVersion: OAUTH_APP_VERSION
        }
      },
      {
        tag: "AuthCode",
        url: EP.exchangeLegacy,
        headers: baseHeaders,
        body: {
          ClientID: clientId,
          AuthCode: authCode,
          CodeVerifier: verifier,
          DeviceID: dev.DeviceID,
          PlatformCode: platform
        }
      },
      {
        tag: "Code",
        url: EP.exchangeLegacy,
        headers: baseHeaders,
        body: {
          ClientID: clientId,
          Code: authCode,
          CodeVerifier: verifier,
          DeviceID: dev.DeviceID,
          PlatformCode: platform
        }
      }
    ];
    const errors = [];
    for (const v of variants) {
      const { status, json: json3, text } = await traeFetch(v.url, {
        method: "POST",
        headers: v.headers,
        body: JSON.stringify(v.body)
      });
      const refreshToken = deepFind(json3, REFRESH_KEYS);
      const accessToken = deepFind(json3, ACCESS_KEYS);
      if (refreshToken) {
        return { tokens: { refreshToken, accessToken }, tag: v.tag, name: pickNickname(json3) || nicknameFromJwt(accessToken) };
      }
      if (accessToken) {
        errors.push(`${v.tag}: \u54CD\u5E94\u53EA\u6709 AccessToken\uFF0C\u6CA1\u6709 RefreshToken\uFF08\u65E0\u6CD5\u7EED\u671F\uFF09${describeExchangeErr(json3, text, status)}`);
      } else {
        errors.push(`${v.tag}: ${describeExchangeErr(json3, text, status)}`);
      }
    }
    throw new Error("\u767B\u5F55\u5931\u8D25 \u2192 " + errors.join(" | "));
  }
  __name(exchangeAuthCode, "exchangeAuthCode");
  const loginKey = /* @__PURE__ */ __name((trace) => `login:${trace}`, "loginKey");
  async function putLoginSession(env, sess) {
    await env.TRAE_KV.put(loginKey(sess.trace), await sealRecord(env, sess), { expirationTtl: LOGIN_TTL });
    await env.TRAE_KV.put(LOGIN_LATEST, sess.trace, { expirationTtl: LOGIN_TTL });
  }
  __name(putLoginSession, "putLoginSession");
  async function getLoginSession(env, trace) {
    const raw = await env.TRAE_KV.get(loginKey(trace));
    if (!raw) return null;
    try {
      return await openRecord(env, raw);
    } catch {
      return null;
    }
  }
  __name(getLoginSession, "getLoginSession");
  async function saveScannedAccount(env, { label, refreshToken, device, clientId, platform }) {
    const rt = String(refreshToken || "").trim();
    if (!rt) throw new Error("\u767B\u5F55\u54CD\u5E94\u91CC\u6CA1\u6709 refreshToken");
    const id = randomId(9);
    const acct = {
      id,
      label: String(label || "").trim().slice(0, 40) || `Trae-${String(device.deviceId || "").slice(-4)}`,
      refreshToken: rt,
      deviceId: String(device.deviceId || ""),
      machineId: String(device.machineId || ""),
      privateKeyPem: String(device.privateKeyPem || ""),
      publicKeyPem: String(device.publicKeyPem || ""),
      deviceName: "PC",
      deviceModel: "",
      deviceBrand: "",
      deviceType: "Windows",
      osInfo: "Windows",
      osVersion: "10.0.19045",
      clientId: String(clientId || ""),
      platformCode: String(platform || ""),
      source: "scan",
      createdAt: Date.now(),
      lastState: "new",
      lastMsg: "\u626B\u7801\u767B\u5F55\uFF0C\u5C1A\u672A\u8FD0\u884C",
      cooldownUntil: 0
    };
    await putAccount(env, acct);
    const list = await listAccounts(env);
    list.push({ id, label: acct.label, createdAt: acct.createdAt });
    await saveIndex(env, list);
    return acct;
  }
  __name(saveScannedAccount, "saveScannedAccount");
  function parseCallbackParams(url) {
    const q = url.searchParams;
    let authCode = "";
    const raw = q.get("authCodeInfo");
    if (raw) {
      try {
        authCode = String(JSON.parse(raw).AuthCode || "").trim();
      } catch {
      }
    }
    if (!authCode) authCode = String(q.get("code") || q.get("AuthCode") || "").trim();
    let refreshToken = "";
    for (const k of ["refreshToken", "refresh_token", "RefreshToken"]) {
      const v = String(q.get(k) || "").trim().replace(/^"+|"+$/g, "");
      if (v) {
        refreshToken = v;
        break;
      }
    }
    return {
      authCode,
      refreshToken,
      trace: String(q.get("loginTraceID") || q.get("login_trace_id") || q.get("state") || "").trim(),
      host: String(q.get("host") || "").trim(),
      name: String(q.get("name") || q.get("nickname") || q.get("userName") || "").trim(),
      uid: String(q.get("uid") || "").trim(),
      error: String(q.get("error") || "").trim()
    };
  }
  __name(parseCallbackParams, "parseCallbackParams");
  async function completeLogin(env, sess, p) {
    if (sess.status === "ok") return { ok: true, label: sess.label, id: sess.accountId, repeat: true };
    let refreshToken = p.refreshToken;
    let via = "callback";
    let nick = p.name || nicknameFromJwt(p.refreshToken);
    if (!refreshToken) {
      if (!p.authCode) throw new Error("\u56DE\u8C03\u91CC\u65E2\u6CA1\u6709 AuthCode \u4E5F\u6CA1\u6709 refreshToken");
      const r = await exchangeAuthCode({
        authCode: p.authCode,
        verifier: sess.verifier,
        device: sess,
        clientId: sess.clientId,
        platform: sess.platform,
        host: p.host
      });
      refreshToken = r.tokens.refreshToken;
      via = r.tag;
      nick = nick || r.name;
    }
    const label = String(nick || p.uid || "").trim() || `Trae-${String(sess.deviceId || "").slice(-4)}`;
    const acct = await saveScannedAccount(env, {
      label,
      refreshToken,
      device: sess,
      clientId: sess.clientId,
      platform: sess.platform
    });
    sess.status = "ok";
    sess.label = acct.label;
    sess.accountId = acct.id;
    sess.via = via;
    sess.error = "";
    await putLoginSession(env, sess);
    return { ok: true, label: acct.label, id: acct.id, via };
  }
  __name(completeLogin, "completeLogin");
  function escHtml(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }
  __name(escHtml, "escHtml");
  function oauthPage(title, detail, ok, label = "") {
    const payload = JSON.stringify({ type: "trae-login", ok: !!ok, label: String(label || "") }).replace(/</g, "\\u003c");
    const color = ok ? "#0d8a61" : "#bf3529";
    const bg = ok ? "rgba(13,138,97,.10)" : "rgba(191,53,41,.10)";
    const icon = ok ? '<path d="M4.5 12.6l4.6 4.6L19.5 6.8"/>' : '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>';
    const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escHtml(title) + '</title><style>*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#eef1f5;color:#0c141d;padding:24px}.c{width:min(420px,92vw);background:#fff;border:1px solid rgba(15,23,42,.09);border-radius:18px;padding:28px;text-align:center;box-shadow:0 18px 44px -24px rgba(15,23,42,.35)}.m{width:52px;height:52px;margin:0 auto 16px;border-radius:16px;display:grid;place-items:center;background:' + bg + "}.m svg{width:26px;height:26px;fill:none;stroke:" + color + ';stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}h1{font-size:19px;margin:0 0 8px;letter-spacing:-.01em}p{margin:0;color:#5e6a78;font-size:13.5px;word-break:break-word}.tip{margin-top:18px;font-size:12px;color:#8b98a7}</style></head><body><div class="c"><div class="m"><svg viewBox="0 0 24 24">' + icon + "</svg></div><h1>" + escHtml(title) + "</h1><p>" + escHtml(detail) + '</p><div class="tip">' + (ok ? "\u7A97\u53E3\u5C06\u81EA\u52A8\u5173\u95ED" : "\u53EF\u4EE5\u5173\u95ED\u6B64\u7A97\u53E3\uFF0C\u56DE\u5230\u63A7\u5236\u53F0\u91CD\u8BD5") + "</div></div><script>try{if(window.opener)window.opener.postMessage(" + payload + ",'*')}catch(e){}" + (ok ? "setTimeout(function(){try{window.close()}catch(e){}},1400);" : "") + "<\/script></body></html>";
    return new Response(html, {
      status: ok ? 200 : 400,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
  __name(oauthPage, "oauthPage");
  async function handleLoginStart(request, env) {
    const callback = CALLBACK_LOCAL;
    const device = await genDeviceIdentity();
    const deviceId = genDeviceId();
    const machineId = randomHex(16);
    const { verifier, challenge } = await pkcePair();
    const trace = randomHex(8);
    const authUrl = buildAuthorizeUrl({
      authFrom: TRAE_LINE.authFrom,
      clientId: TRAE_LINE.clientId,
      trace,
      callback,
      deviceId,
      machineId,
      challenge
    });
    const sess = {
      trace,
      line: "trae",
      verifier,
      callback,
      deviceId,
      machineId,
      privateKeyPem: device.privateKeyPem,
      publicKeyPem: device.publicKeyPem,
      clientId: TRAE_LINE.clientId,
      platform: TRAE_LINE.platform,
      status: "pending",
      createdAt: Date.now()
    };
    await putLoginSession(env, sess);
    return json2({
      ok: true,
      trace,
      authUrl,
      callback,
      deviceId,
      line: "trae",
      label: TRAE_LINE.label
    });
  }
  __name(handleLoginStart, "handleLoginStart");
  async function handleOauthCallback(request, env) {
    const url = new URL(request.url);
    const p = parseCallbackParams(url);
    if (!p.authCode && !p.refreshToken && !p.error && !p.trace) {
      return new Response("ok", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
    }
    if (p.error) return oauthPage("\u6388\u6743\u672A\u5B8C\u6210", p.error, false);
    let trace = p.trace;
    if (!trace) trace = String(await env.TRAE_KV.get(LOGIN_LATEST) || "");
    if (!trace) return oauthPage("\u767B\u5F55\u4F1A\u8BDD\u4E22\u5931", "\u627E\u4E0D\u5230\u5BF9\u5E94\u7684\u767B\u5F55\u4F1A\u8BDD\uFF0C\u8BF7\u56DE\u5230\u63A7\u5236\u53F0\u91CD\u65B0\u53D1\u8D77", false);
    const sess = await getLoginSession(env, trace);
    if (!sess) return oauthPage("\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F", "\u4E8C\u7EF4\u7801\u6709\u6548\u671F 15 \u5206\u949F\uFF0C\u8BF7\u56DE\u5230\u63A7\u5236\u53F0\u91CD\u65B0\u83B7\u53D6", false);
    try {
      const r = await completeLogin(env, sess, p);
      return oauthPage(r.repeat ? "\u8FD9\u4E2A\u4E8C\u7EF4\u7801\u5DF2\u7ECF\u7528\u8FC7\u4E86" : "\u767B\u5F55\u6210\u529F", `\u5DF2\u4FDD\u5B58\u4E3A\u300C${r.label}\u300D`, true, r.label);
    } catch (e) {
      sess.status = "error";
      sess.error = e.message;
      await putLoginSession(env, sess);
      return oauthPage("\u6362\u53D6\u4EE4\u724C\u5931\u8D25", e.message, false);
    }
  }
  __name(handleOauthCallback, "handleOauthCallback");
  async function handleLoginPoll(request, env) {
    const url = new URL(request.url);
    const trace = String(url.searchParams.get("trace") || "").trim();
    if (!trace) return json2({ error: "\u7F3A\u5C11 trace" }, 400);
    const sess = await getLoginSession(env, trace);
    if (!sess) return json2({ status: "expired" });
    return json2({
      status: sess.status || "pending",
      label: sess.label || "",
      error: sess.error || "",
      accountId: sess.accountId || "",
      via: sess.via || ""
    });
  }
  __name(handleLoginPoll, "handleLoginPoll");
  async function handleLoginClaim(request, env) {
    const body = await readBody(request);
    const text = String(body.url || body.text || "").trim();
    if (!text) return json2({ error: "\u8BF7\u7C98\u8D34\u56DE\u8C03\u5730\u5740" }, 400);
    let u;
    try {
      u = new URL(text);
    } catch {
      try {
        const tail = text.startsWith("?") ? text : text.replace(/^[?/]+/, "");
        u = new URL("https://placeholder.local/" + tail);
      } catch {
        return json2({ error: "\u8FD9\u4E0D\u50CF\u662F\u56DE\u8C03\u5730\u5740" }, 400);
      }
    }
    const p = parseCallbackParams(u);
    if (!p.authCode && !p.refreshToken) {
      return json2({ error: "\u5730\u5740\u91CC\u6CA1\u627E\u5230 authCodeInfo / code\uFF0C\u8BF7\u590D\u5236\u5B8C\u6574\u5730\u5740\uFF08\u542B ? \u4E4B\u540E\u7684\u90E8\u5206\uFF09" }, 400);
    }
    let trace = p.trace || String(await env.TRAE_KV.get(LOGIN_LATEST) || "");
    if (!trace) return json2({ error: "\u6CA1\u6709\u5F85\u5B8C\u6210\u7684\u767B\u5F55\u4F1A\u8BDD\uFF0C\u8BF7\u5148\u70B9\u300C\u6DFB\u52A0\u8D26\u53F7\u300D" }, 400);
    const sess = await getLoginSession(env, trace);
    if (!sess) return json2({ error: "\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77" }, 400);
    try {
      const r = await completeLogin(env, sess, p);
      return json2({ ok: true, label: r.label, id: r.id, via: r.via });
    } catch (e) {
      sess.status = "error";
      sess.error = e.message;
      await putLoginSession(env, sess);
      return json2({ error: e.message }, 502);
    }
  }
  __name(handleLoginClaim, "handleLoginClaim");
  const PAGE2 = '<!DOCTYPE html><meta charset="utf-8"><title>\u63A7\u5236\u53F0</title><p>\u63A7\u5236\u53F0\u5728\u6839\u8DEF\u5F84 <a href="/">/</a>\u3002</p>';
  const __mod = {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const method = request.method.toUpperCase();
      try {
        if (path === "/" || path === "/index.html") {
          return new Response(PAGE2, {
            headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
          });
        }
        if (path === "/cron") {
          const c = requireCron2(request, env);
          if (!c.ok) return c.res;
          return handleRun(request, env, false);
        }
        if (path === "/oauth/callback" && method === "GET") return handleOauthCallback(request, env);
        if (path === "/oauth/probe" && (method === "GET" || method === "HEAD")) {
          return new Response("ok", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
        }
        if (!path.startsWith("/api/")) return json2({ error: "not found" }, 404);
        const a = requireAdmin2(request, env);
        if (!a.ok) return a.res;
        if (path === "/api/login/start" && method === "POST") return handleLoginStart(request, env);
        if (path === "/api/login/poll" && method === "GET") return handleLoginPoll(request, env);
        if (path === "/api/login/claim" && method === "POST") return handleLoginClaim(request, env);
        if (path === "/api/list" && method === "GET") return handleList(request, env);
        if (path === "/api/accounts/remove" && method === "POST") return handleRemove(request, env);
        if (path === "/api/rename" && method === "POST") return handleRename(request, env);
        if (path === "/api/run" && method === "POST") {
          const force = url.searchParams.get("force") === "1";
          return handleRun(request, env, force);
        }
        return json2({ error: "not found" }, 404);
      } catch (e) {
        return json2({ error: e.message || String(e) }, 500);
      }
    },
    /** Cloudflare Cron Trigger 到点自动跑 */
    async scheduled(event, env, ctx) {
      ctx.waitUntil(
        (async () => {
          const list = await listAccounts(env);
          for (const meta of list) {
            const acct = await getAccount(env, meta.id);
            if (!acct) continue;
            try {
              await signinOne(env, acct, { force: false });
            } catch {
            }
          }
        })()
      );
    }
  };
  const __internal = { ecSign, importPrivateKey, derSig, jwtExp, buildProof, PEM_TEST: true };
  return { fetch: __mod.fetch, scheduled: __mod.scheduled, __internal };
})();
var WorkBuddy = (() => {
  const API = "https://copilot.tencent.com";
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  function b64encode(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  __name(b64encode, "b64encode");
  function b64decode(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  __name(b64decode, "b64decode");
  function b64urlEncode(buf) {
    return b64encode(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  __name(b64urlEncode, "b64urlEncode");
  function b64urlDecode(str) {
    const s = str.replace(/-/g, "+").replace(/_/g, "/");
    return b64decode(s + "=".repeat((4 - s.length % 4) % 4));
  }
  __name(b64urlDecode, "b64urlDecode");
  function randomId(bytes = 12) {
    return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
  }
  __name(randomId, "randomId");
  function timingSafeEqual(a, b) {
    const x = enc.encode(String(a ?? ""));
    const y = enc.encode(String(b ?? ""));
    if (x.length !== y.length) return false;
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
  }
  __name(timingSafeEqual, "timingSafeEqual");
  async function deriveKey(env, salt) {
    const raw = env.WB_MASTER_KEY;
    if (!raw) throw new Error("\u7F3A\u5C11 MASTER_KEY");
    let master;
    try {
      master = b64decode(raw.trim());
    } catch {
      throw new Error("MASTER_KEY \u4E0D\u662F\u5408\u6CD5 base64");
    }
    if (master.length !== 32) throw new Error("MASTER_KEY \u5FC5\u987B\u662F 32 \u5B57\u8282\uFF08base64 \u540E 44 \u5B57\u7B26\uFF09");
    const base = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("wb-signin/v1/account") },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
  __name(deriveKey, "deriveKey");
  async function sealRecord(env, obj) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(env, salt);
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(JSON.stringify(obj))
    );
    return JSON.stringify({ v: 1, s: b64encode(salt), i: b64encode(iv), d: b64encode(ct) });
  }
  __name(sealRecord, "sealRecord");
  async function openRecord(env, text) {
    const box = JSON.parse(text);
    if (box.v !== 1) throw new Error("\u4E0D\u8BA4\u8BC6\u7684\u8BB0\u5F55\u7248\u672C");
    const key = await deriveKey(env, b64decode(box.s));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64decode(box.i) },
      key,
      b64decode(box.d)
    );
    return JSON.parse(dec.decode(pt));
  }
  __name(openRecord, "openRecord");
  const acctKey = /* @__PURE__ */ __name((id) => `acct:${id}`, "acctKey");
  const INDEX_KEY = "index:accounts";
  async function listAccounts(env) {
    const raw = await env.WB_KV.get(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  __name(listAccounts, "listAccounts");
  async function saveIndex(env, list) {
    await env.WB_KV.put(INDEX_KEY, JSON.stringify(list));
  }
  __name(saveIndex, "saveIndex");
  async function getAccount(env, id) {
    const raw = await env.WB_KV.get(acctKey(id));
    if (!raw) return null;
    return openRecord(env, raw);
  }
  __name(getAccount, "getAccount");
  async function putAccount(env, acct) {
    await env.WB_KV.put(acctKey(acct.id), await sealRecord(env, acct));
  }
  __name(putAccount, "putAccount");
  async function wbFetch(path, { method = "POST", headers = {}, body = "{}", timeout = 2e4 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(API + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "workbuddy-signin-worker/1.0",
          ...headers
        },
        body: method === "GET" ? void 0 : body,
        signal: ctrl.signal
      });
      const text = await res.text();
      let json3;
      try {
        json3 = JSON.parse(text);
      } catch {
        throw new Error(`\u54CD\u5E94\u4E0D\u662F JSON (HTTP ${res.status}): ${text.slice(0, 120)}`);
      }
      return { status: res.status, json: json3 };
    } finally {
      clearTimeout(timer);
    }
  }
  __name(wbFetch, "wbFetch");
  async function refreshTokens(refreshToken) {
    const { status, json: json3 } = await wbFetch("/v2/plugin/auth/token/refresh", {
      headers: {
        "X-Refresh-Token": refreshToken,
        "X-Auth-Refresh-Source": "plugin",
        "X-Domain": "copilot.tencent.com"
      }
    });
    if (json3?.code !== 0 || !json3?.data) {
      const err = new Error(
        `\u5237\u65B0\u4EE4\u724C\u5931\u8D25 code=${json3?.code} ${json3?.msg ?? ""} (HTTP ${status})`
      );
      err.code = json3?.code;
      err.fatal = true;
      throw err;
    }
    const d = json3.data;
    return {
      accessToken: d.accessToken,
      refreshToken: d.refreshToken || refreshToken,
      expiresIn: Number(d.expiresIn) || 0,
      refreshExpiresIn: Number(d.refreshExpiresIn) || 0
    };
  }
  __name(refreshTokens, "refreshTokens");
  async function requestLoginState() {
    const { status, json: json3 } = await wbFetch("/v2/plugin/auth/state?platform=workbuddy", {
      headers: {
        "X-No-Authorization": "true",
        "X-No-User-Id": "true",
        "X-No-Enterprise-Id": "true",
        "X-No-Department-Info": "true",
        "X-Domain": "copilot.tencent.com"
      }
    });
    if (json3?.code !== 0 || !json3?.data?.state) {
      throw new Error(`\u7533\u8BF7\u767B\u5F55\u6001\u5931\u8D25 code=${json3?.code} ${json3?.msg ?? ""} (HTTP ${status})`);
    }
    return { state: json3.data.state, authUrl: json3.data.authUrl };
  }
  __name(requestLoginState, "requestLoginState");
  async function pollLoginToken(state) {
    const { status, json: json3 } = await wbFetch(
      `/v2/plugin/auth/token?state=${encodeURIComponent(state)}`,
      {
        method: "GET",
        headers: {
          "X-No-Authorization": "true",
          "X-No-User-Id": "true",
          "X-No-Enterprise-Id": "true",
          "X-No-Department-Info": "true",
          "X-Domain": "copilot.tencent.com"
        }
      }
    );
    if (json3?.code === 11217) return { pending: true };
    if (json3?.code === 0 && json3?.data?.accessToken) return { tokens: json3.data };
    throw new Error(`\u8F6E\u8BE2\u767B\u5F55\u7ED3\u679C\u5931\u8D25 code=${json3?.code} ${json3?.msg ?? ""} (HTTP ${status})`);
  }
  __name(pollLoginToken, "pollLoginToken");
  async function fetchNickname(at) {
    try {
      const { json: json3 } = await wbFetch("/v2/accounts", {
        method: "GET",
        headers: { ...authHeader(at), "X-Domain": "copilot.tencent.com" }
      });
      const list = json3?.data?.accounts ?? json3?.data;
      const first = Array.isArray(list) ? list[0] : null;
      return String(first?.nickname ?? first?.nickName ?? "").trim();
    } catch {
      return "";
    }
  }
  __name(fetchNickname, "fetchNickname");
  async function persistAccount(env, { refreshToken, label, accessToken }) {
    const id = randomId(9);
    let name = String(label ?? "").trim().slice(0, 40);
    if (!name && accessToken) name = await fetchNickname(accessToken);
    if (!name) name = `\u8D26\u53F7-${id.slice(0, 4)}`;
    const acct = {
      id,
      label: name,
      refreshToken,
      createdAt: Date.now(),
      lastState: "new",
      lastMsg: "\u5C1A\u672A\u8FD0\u884C",
      verified: true,
      tokenRefreshedAt: Date.now()
    };
    await putAccount(env, acct);
    const list = await listAccounts(env);
    list.push({ id, label: acct.label, createdAt: acct.createdAt });
    await saveIndex(env, list);
    return acct;
  }
  __name(persistAccount, "persistAccount");
  const authHeader = /* @__PURE__ */ __name((at) => ({ Authorization: `Bearer ${at}` }), "authHeader");
  async function checkinStatus(at) {
    const { json: json3 } = await wbFetch("/v2/billing/meter/checkin-activity-status", {
      headers: authHeader(at)
    });
    if (json3?.code !== 0 || !json3?.data) {
      return { ok: false, code: json3?.code, msg: json3?.msg };
    }
    return { ok: true, data: json3.data };
  }
  __name(checkinStatus, "checkinStatus");
  async function doCheckin(at) {
    const { json: json3 } = await wbFetch("/v2/billing/meter/daily-checkin", {
      headers: authHeader(at)
    });
    if (json3?.code === 0) {
      return { state: "checked", credit: json3.data?.credit ?? 100, raw: json3.data };
    }
    if (json3?.code === 10001) {
      return { state: "already", credit: 0 };
    }
    return { state: "error", code: json3?.code, msg: json3?.msg };
  }
  __name(doCheckin, "doCheckin");
  async function signinOne(env, acct, { force = false } = {}) {
    const now = Date.now();
    const today = new Date(now + 8 * 3600 * 1e3).toISOString().slice(0, 10);
    if (!force && acct.lastOkDate === today && acct.lastState !== "error") {
      return { id: acct.id, label: acct.label, state: "skipped", msg: "\u4ECA\u65E5\u5DF2\u5B8C\u6210" };
    }
    let tokens;
    try {
      tokens = await refreshTokens(acct.refreshToken);
    } catch (e) {
      acct.lastState = e.fatal ? "token_dead" : "error";
      acct.lastMsg = e.message;
      acct.lastRun = now;
      await putAccount(env, acct);
      return { id: acct.id, label: acct.label, state: acct.lastState, msg: e.message };
    }
    acct.refreshToken = tokens.refreshToken;
    acct.tokenRefreshedAt = now;
    let result;
    try {
      result = await doCheckin(tokens.accessToken);
    } catch (e) {
      acct.lastState = "error";
      acct.lastMsg = `\u7B7E\u5230\u8BF7\u6C42\u5F02\u5E38: ${e.message}`;
      acct.lastRun = now;
      await putAccount(env, acct);
      return { id: acct.id, label: acct.label, state: "error", msg: acct.lastMsg };
    }
    let streak = null;
    let total = null;
    try {
      const st = await checkinStatus(tokens.accessToken);
      if (st.ok) {
        streak = st.data.streak_days ?? null;
        total = st.data.total_credits ?? null;
        if (st.data.checked_in_today === true && result.state === "error") {
          result = { state: "already", credit: 0 };
        }
      }
    } catch {
    }
    acct.lastRun = now;
    acct.streak = streak;
    acct.total = total;
    if (result.state === "error") {
      acct.lastState = "error";
      acct.lastMsg = `\u7B7E\u5230\u5931\u8D25 code=${result.code} ${result.msg ?? ""}`;
    } else {
      acct.lastState = result.state;
      acct.lastMsg = result.state === "checked" ? `+${result.credit} \u79EF\u5206` : "\u4ECA\u65E5\u5DF2\u7B7E";
      acct.lastOkDate = today;
      if (result.state === "checked") {
        acct.lastCredit = result.credit;
        acct.totalSigned = (acct.totalSigned ?? 0) + 1;
      }
    }
    await putAccount(env, acct);
    return {
      id: acct.id,
      label: acct.label,
      state: acct.lastState,
      msg: acct.lastMsg,
      streak,
      total
    };
  }
  __name(signinOne, "signinOne");
  function json2(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
  __name(json2, "json");
  function requireAdmin2(request, env) {
    const url = new URL(request.url);
    const given = request.headers.get("X-Admin-Token") || (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") || url.searchParams.get("token");
    if (!env.ADMIN_TOKEN) return { ok: false, res: json2({ error: "\u672A\u914D\u7F6E ADMIN_TOKEN" }, 500) };
    if (!timingSafeEqual(given, env.ADMIN_TOKEN)) {
      return { ok: false, res: json2({ error: "\u767B\u5F55\u5BC6\u7801\u4E0D\u6B63\u786E" }, 401) };
    }
    return { ok: true };
  }
  __name(requireAdmin2, "requireAdmin");
  function requireCron2(request, env) {
    const secret = env.CRON_SECRET || env.ADMIN_TOKEN;
    const url = new URL(request.url);
    const given = request.headers.get("X-Cron-Secret") || url.searchParams.get("key");
    if (!secret) return { ok: false, res: json2({ error: "\u672A\u914D\u7F6E CRON_SECRET / ADMIN_TOKEN" }, 500) };
    if (!timingSafeEqual(given, secret)) return { ok: false, res: json2({ error: "\u53E3\u4EE4\u4E0D\u5BF9" }, 401) };
    return { ok: true };
  }
  __name(requireCron2, "requireCron");
  async function readBody(request) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }
  __name(readBody, "readBody");
  async function handleLoginStart(request, env) {
    const { state, authUrl } = await requestLoginState();
    await env.WB_KV.put(`login:${state}`, String(Date.now()), { expirationTtl: 900 });
    return json2({ ok: true, state, authUrl });
  }
  __name(handleLoginStart, "handleLoginStart");
  async function handleLoginPoll(request, env) {
    const url = new URL(request.url);
    const state = String(url.searchParams.get("state") ?? "").trim();
    if (!state) return json2({ error: "\u7F3A\u5C11 state" }, 400);
    const known = await env.WB_KV.get(`login:${state}`);
    if (!known) return json2({ error: "\u767B\u5F55\u4F1A\u8BDD\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u83B7\u53D6\u4E8C\u7EF4\u7801" }, 400);
    const r = await pollLoginToken(state);
    if (r.pending) return json2({ status: "pending" });
    const rt = String(r.tokens.refreshToken ?? "").trim();
    if (!rt) return json2({ error: "\u767B\u5F55\u6210\u529F\u4F46\u670D\u52A1\u7AEF\u6CA1\u8FD4\u56DE refreshToken" }, 502);
    const acct = await persistAccount(env, { refreshToken: rt, accessToken: r.tokens.accessToken });
    await env.WB_KV.delete(`login:${state}`);
    return json2({ status: "ok", id: acct.id, label: acct.label });
  }
  __name(handleLoginPoll, "handleLoginPoll");
  async function handleList(request, env) {
    const list = await listAccounts(env);
    const out = [];
    for (const meta of list) {
      const a = await getAccount(env, meta.id);
      if (!a) continue;
      out.push({
        id: a.id,
        label: a.label,
        lastState: a.lastState,
        lastMsg: a.lastMsg,
        lastRun: a.lastRun ? new Date(a.lastRun + 8 * 36e5).toISOString().replace("Z", " +08:00") : null,
        lastOkDate: a.lastOkDate ?? null,
        streak: a.streak ?? null,
        total: a.total ?? null,
        totalSigned: a.totalSigned ?? 0
        // 永远不返回令牌，连指纹都不给
      });
    }
    return json2({ count: out.length, accounts: out });
  }
  __name(handleList, "handleList");
  async function handleRemove(request, env) {
    const body = await readBody(request);
    const id = String(body.id ?? "").trim();
    if (!id) return json2({ error: "\u7F3A\u5C11 id" }, 400);
    await env.WB_KV.delete(acctKey(id));
    const list = (await listAccounts(env)).filter((x) => x.id !== id);
    await saveIndex(env, list);
    return json2({ ok: true, removed: id });
  }
  __name(handleRemove, "handleRemove");
  async function handleRename(request, env) {
    const body = await readBody(request);
    const id = String(body.id ?? "").trim();
    const label = String(body.label ?? "").trim().slice(0, 40);
    if (!id) return json2({ error: "\u7F3A\u5C11 id" }, 400);
    if (!label) return json2({ error: "\u5907\u6CE8\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
    const acct = await getAccount(env, id);
    if (!acct) return json2({ error: "\u8D26\u53F7\u4E0D\u5B58\u5728" }, 404);
    acct.label = label;
    await putAccount(env, acct);
    const list = await listAccounts(env);
    await saveIndex(env, list.map((x) => x.id === id ? { ...x, label } : x));
    return json2({ ok: true, id, label });
  }
  __name(handleRename, "handleRename");
  async function handleRun(request, env, force) {
    const list = await listAccounts(env);
    const results = [];
    for (const meta of list) {
      const a = await getAccount(env, meta.id);
      if (!a) continue;
      try {
        results.push(await signinOne(env, a, { force }));
      } catch (e) {
        results.push({ id: a.id, label: a.label, state: "error", msg: e.message });
      }
    }
    const summary = {
      at: new Date(Date.now() + 8 * 36e5).toISOString().replace("Z", " +08:00"),
      accounts: results.length,
      checked: results.filter((r) => r.state === "checked").length,
      already: results.filter((r) => r.state === "already" || r.state === "skipped").length,
      failed: results.filter((r) => r.state === "error" || r.state === "token_dead").length,
      results
    };
    return json2(summary);
  }
  __name(handleRun, "handleRun");
  const PAGE2 = '<!DOCTYPE html><meta charset="utf-8"><title>\u63A7\u5236\u53F0</title><p>\u63A7\u5236\u53F0\u5728\u6839\u8DEF\u5F84 <a href="/">/</a>\u3002</p>';
  const __mod = {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const method = request.method.toUpperCase();
      try {
        if (path === "/" || path === "/index.html") {
          return new Response(PAGE2, {
            headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
          });
        }
        if (path === "/cron") {
          const c = requireCron2(request, env);
          if (!c.ok) return c.res;
          return handleRun(request, env, false);
        }
        if (!path.startsWith("/api/")) return json2({ error: "not found" }, 404);
        const a = requireAdmin2(request, env);
        if (!a.ok) return a.res;
        if (path === "/api/list" && method === "GET") return handleList(request, env);
        if (path === "/api/login/start" && method === "POST") return handleLoginStart(request, env);
        if (path === "/api/login/poll" && method === "GET") return handleLoginPoll(request, env);
        if (path === "/api/remove" && method === "POST") return handleRemove(request, env);
        if (path === "/api/rename" && method === "POST") return handleRename(request, env);
        if (path === "/api/run" && method === "POST") {
          const force = url.searchParams.get("force") === "1";
          return handleRun(request, env, force);
        }
        return json2({ error: "not found" }, 404);
      } catch (e) {
        return json2({ error: e.message || String(e) }, 500);
      }
    },
    /** Cloudflare Cron Trigger 到点自动跑 */
    async scheduled(event, env, ctx) {
      ctx.waitUntil(
        (async () => {
          const list = await listAccounts(env);
          for (const meta of list) {
            const acct = await getAccount(env, meta.id);
            if (!acct) continue;
            try {
              await signinOne(env, acct, { force: false });
            } catch {
            }
          }
        })()
      );
    }
  };
  return { fetch: __mod.fetch, scheduled: __mod.scheduled };
})();
var Qoder = (() => {
  const REGION = {
    key: "cn",
    name: "\u56FD\u5185\u7248",
    web: "https://qoder.com.cn",
    api: "https://openapi.qoder.com.cn",
    clientId: "",
    redirectUri: "",
    lang: "zh-CN"
  };
  const regionOf = /* @__PURE__ */ __name(() => REGION, "regionOf");
  const EP = {
    devicePage: "/device/selectAccounts",
    poll: "/api/v1/deviceToken/poll",
    refresh: "/api/v1/deviceToken/refresh",
    campaigns: "/sash/api/v1/me/campaigns"
  };
  const CLIENT_TYPE = "10";
  const UA = "Qoder";
  const LOGIN_TTL = 900;
  const COOLDOWN_MIN = 30;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  function b64encode(buf) {
    const b = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  __name(b64encode, "b64encode");
  function b64decode(str) {
    const bin = atob(String(str));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  __name(b64decode, "b64decode");
  function b64urlEncode(buf) {
    return b64encode(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  __name(b64urlEncode, "b64urlEncode");
  function b64urlDecode(str) {
    const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
    return b64decode(s + "=".repeat((4 - s.length % 4) % 4));
  }
  __name(b64urlDecode, "b64urlDecode");
  function randomId(bytes = 12) {
    return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
  }
  __name(randomId, "randomId");
  function randomHex(bytes = 16) {
    const b = crypto.getRandomValues(new Uint8Array(bytes));
    let s = "";
    for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
    return s;
  }
  __name(randomHex, "randomHex");
  function timingSafeEqual(a, b) {
    const x = enc.encode(String(a ?? ""));
    const y = enc.encode(String(b ?? ""));
    if (x.length !== y.length) return false;
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
  }
  __name(timingSafeEqual, "timingSafeEqual");
  function jwtClaims(tok) {
    const parts = String(tok || "").split(".");
    if (parts.length < 3) return {};
    try {
      return JSON.parse(dec.decode(b64urlDecode(parts[1]))) || {};
    } catch {
      return {};
    }
  }
  __name(jwtClaims, "jwtClaims");
  async function deriveKey(env, salt) {
    const raw = env.QODER_MASTER_KEY;
    if (!raw) throw new Error("\u7F3A\u5C11 MASTER_KEY");
    let master;
    try {
      master = b64decode(raw.trim());
    } catch {
      throw new Error("MASTER_KEY \u4E0D\u662F\u5408\u6CD5 base64");
    }
    if (master.length !== 32) throw new Error("MASTER_KEY \u5FC5\u987B\u662F 32 \u5B57\u8282\uFF08base64 \u540E 44 \u5B57\u7B26\uFF09");
    const base = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("qoder-signin/v1/account") },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
  __name(deriveKey, "deriveKey");
  async function sealRecord(env, obj) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(env, salt);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
    return JSON.stringify({ v: 1, s: b64encode(salt), i: b64encode(iv), d: b64encode(ct) });
  }
  __name(sealRecord, "sealRecord");
  async function openRecord(env, text) {
    const box = JSON.parse(text);
    if (box.v !== 1) throw new Error("\u4E0D\u8BA4\u8BC6\u7684\u8BB0\u5F55\u7248\u672C");
    const key = await deriveKey(env, b64decode(box.s));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(box.i) }, key, b64decode(box.d));
    return JSON.parse(dec.decode(pt));
  }
  __name(openRecord, "openRecord");
  const acctKey = /* @__PURE__ */ __name((id) => `acct:${id}`, "acctKey");
  const INDEX_KEY = "index:accounts";
  const loginKey = /* @__PURE__ */ __name((nonce) => `login:${nonce}`, "loginKey");
  async function listAccounts(env) {
    const raw = await env.QODER_KV.get(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  __name(listAccounts, "listAccounts");
  async function saveIndex(env, list) {
    await env.QODER_KV.put(INDEX_KEY, JSON.stringify(list));
  }
  __name(saveIndex, "saveIndex");
  async function getAccount(env, id) {
    const raw = await env.QODER_KV.get(acctKey(id));
    if (!raw) return null;
    return openRecord(env, raw);
  }
  __name(getAccount, "getAccount");
  async function putAccount(env, acct) {
    await env.QODER_KV.put(acctKey(acct.id), await sealRecord(env, acct));
  }
  __name(putAccount, "putAccount");
  const bjDay = /* @__PURE__ */ __name((ms = Date.now()) => new Date(ms + 8 * 36e5).toISOString().slice(0, 10), "bjDay");
  async function qoderFetch(region, path, { method = "GET", headers = {}, body, timeout = 2e4 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(region.api + path, {
        method,
        headers: {
          accept: "application/json",
          "accept-language": region.lang,
          "user-agent": UA,
          ...headers
        },
        body: body === void 0 ? void 0 : JSON.stringify(body),
        signal: ctrl.signal
      });
      const text = await res.text();
      let json3 = {};
      try {
        json3 = text ? JSON.parse(text) : {};
      } catch {
        json3 = {};
      }
      return { status: res.status, json: json3, text };
    } finally {
      clearTimeout(timer);
    }
  }
  __name(qoderFetch, "qoderFetch");
  function authHeaders(at, region, extra) {
    const h = {
      authorization: "Bearer " + at,
      "cosy-clienttype": CLIENT_TYPE,
      "user-agent": UA,
      accept: "application/json",
      "accept-language": region.lang
    };
    return extra ? Object.assign(h, extra) : h;
  }
  __name(authHeaders, "authHeaders");
  const CLIENT_VERSION = "0.4.8";
  const MACHINE_OS = "x86_64_win32";
  const MACHINE_HOSTNAME = "DESKTOP";
  async function riskHeaders(acct, env, overrides) {
    const h = {
      "cosy-version": overrides && overrides.version || CLIENT_VERSION,
      "cosy-machineos": MACHINE_OS,
      "cosy-machinehostname": MACHINE_HOSTNAME
    };
    const mid = String(acct?.machineId || "").trim();
    if (mid) h["cosy-machineid"] = mid;
    return h;
  }
  __name(riskHeaders, "riskHeaders");
  async function sha256b64url(str) {
    const d = await crypto.subtle.digest("SHA-256", enc.encode(str));
    return b64urlEncode(new Uint8Array(d));
  }
  __name(sha256b64url, "sha256b64url");
  async function handleLoginStart(request, env) {
    const body = await readBody(request);
    const region = REGION;
    const verifier = randomId(32);
    const challenge = await sha256b64url(verifier);
    const nonce = randomHex(16);
    const machineId = crypto.randomUUID();
    const pairs = [
      ["challenge", challenge],
      ["challenge_method", "S256"]
    ];
    if (region.clientId) pairs.push(["client_id", region.clientId]);
    pairs.push(["machine_id", machineId], ["nonce", nonce]);
    if (region.redirectUri) pairs.push(["redirect_uri", region.redirectUri]);
    const authUrl = region.web + EP.devicePage + "?" + pairs.map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    await env.QODER_KV.put(
      loginKey(nonce),
      await sealRecord(env, { verifier, machineId, region: region.key, at: Date.now() }),
      { expirationTtl: LOGIN_TTL }
    );
    return json2({ ok: true, nonce, region: region.key, regionName: region.name, authUrl });
  }
  __name(handleLoginStart, "handleLoginStart");
  async function handleLoginPoll(request, env) {
    const url = new URL(request.url);
    const nonce = String(url.searchParams.get("nonce") ?? "").trim();
    if (!nonce) return json2({ error: "\u7F3A\u5C11 nonce" }, 400);
    const raw = await env.QODER_KV.get(loginKey(nonce));
    if (!raw) return json2({ error: "\u6388\u6743\u4F1A\u8BDD\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u300C\u6DFB\u52A0\u8D26\u53F7\u300D" }, 400);
    let sess;
    try {
      sess = await openRecord(env, raw);
    } catch {
      return json2({ error: "\u6388\u6743\u4F1A\u8BDD\u635F\u574F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u300C\u6DFB\u52A0\u8D26\u53F7\u300D" }, 400);
    }
    const region = regionOf(sess.region);
    const q = "?nonce=" + encodeURIComponent(nonce) + "&verifier=" + encodeURIComponent(sess.verifier) + "&challenge_method=S256";
    const r = await qoderFetch(region, EP.poll + q, {
      headers: { "Cosy-Version": "1.0.1", "Cosy-ClientType": "5", "user-agent": "qoder-local-proxy" }
    });
    if (r.status === 202 || r.status === 404) return json2({ status: "pending" });
    if (r.status >= 400) {
      const msg = r.json.errorMessage || r.json.message || r.json.msg || "";
      return json2({ error: "\u6388\u6743\u8F6E\u8BE2\u5931\u8D25\uFF08HTTP " + r.status + "\uFF09" + msg }, 502);
    }
    const data = r.json && typeof r.json.data === "object" && r.json.data ? r.json.data : r.json;
    const token = String(data.token || data.access_token || data.device_token || "").trim();
    if (!token) {
      const code = r.json?.code;
      if (code != null && code !== 0 && code !== "0") {
        const msg = r.json.errorMessage || r.json.msg || r.json.message || "";
        return json2({ error: "\u6388\u6743\u5931\u8D25\uFF08code=" + code + "\uFF09" + msg }, 502);
      }
      return json2({ status: "pending" });
    }
    const acct = await persistAccount(env, {
      accessToken: token,
      refreshToken: String(data.refresh_token || data.refreshToken || "").trim(),
      userId: String(data.user_id || data.userId || "").trim(),
      email: String(data.email || data.user_email || "").trim(),
      machineId: sess.machineId,
      region: region.key
    });
    await env.QODER_KV.delete(loginKey(nonce));
    return json2({ status: "ok", id: acct.id, label: acct.label, region: region.key });
  }
  __name(handleLoginPoll, "handleLoginPoll");
  async function persistAccount(env, { accessToken, refreshToken, userId, email, machineId, via }) {
    const id = randomId(9);
    const reg = REGION;
    const claims = jwtClaims(accessToken);
    const fallback = (reg.key === "global" ? "Qoder-Intl-" : "Qoder-") + (userId ? userId.slice(-4) : id.slice(0, 4));
    const name = String(claims.nickname || claims.name || claims.email || email || "").trim().slice(0, 40) || fallback;
    const acct = {
      id,
      label: name,
      region: reg.key,
      accessToken: String(accessToken || ""),
      refreshToken: String(refreshToken || ""),
      userId: String(userId || ""),
      machineId: String(machineId || ""),
      createdAt: Date.now(),
      lastState: "new",
      lastMsg: "\u6388\u6743\u5B8C\u6210\uFF0C\u5C1A\u672A\u8FD0\u884C",
      totalCredit: 0,
      totalSigned: 0,
      cooldownUntil: 0,
      via: String(via || "")
    };
    await putAccount(env, acct);
    const list = await listAccounts(env);
    list.push({ id, label: acct.label, createdAt: acct.createdAt });
    await saveIndex(env, list);
    return acct;
  }
  __name(persistAccount, "persistAccount");
  async function refreshAccount(acct) {
    const rt = String(acct.refreshToken || "").trim();
    if (!rt) {
      const e = new Error("\u8D26\u53F7\u7F3A\u5C11 refreshToken\uFF0C\u65E0\u6CD5\u7EED\u671F\uFF0C\u8BF7\u5220\u6389\u540E\u91CD\u65B0\u6DFB\u52A0");
      e.fatal = true;
      throw e;
    }
    const region = regionOf(acct.region);
    const r = await qoderFetch(region, EP.refresh, {
      method: "POST",
      headers: { "user-agent": "qoder-local-proxy", "content-type": "application/json" },
      body: { refresh_token: rt }
    });
    if (r.status === 401 || r.status === 403) {
      const e = new Error("refreshToken \u5DF2\u5931\u6548\uFF0C\u8BF7\u5220\u6389\u540E\u91CD\u65B0\u6DFB\u52A0");
      e.fatal = true;
      throw e;
    }
    if (r.status >= 400) throw new Error("\u4EE4\u724C\u7EED\u671F\u5931\u8D25\uFF08HTTP " + r.status + "\uFF09");
    const d = r.json && typeof r.json.data === "object" && r.json.data ? r.json.data : r.json;
    const token = String(d.device_token || d.deviceToken || d.token || d.access_token || "").trim();
    if (!token) throw new Error("\u7EED\u671F\u54CD\u5E94\u91CC\u6CA1\u6709\u65B0\u7684 access token");
    acct.accessToken = token;
    const nr = String(d.refresh_token || d.refreshToken || "").trim();
    if (nr) acct.refreshToken = nr;
    acct.tokenRefreshedAt = Date.now();
    return token;
  }
  __name(refreshAccount, "refreshAccount");
  async function fetchCampaigns(at, acct, env, { risk = true, force = true, version } = {}) {
    const region = regionOf(acct.region);
    const url = EP.campaigns + (force ? "?forceRefresh=true" : "");
    const extra = risk ? await riskHeaders(acct, env, { version }) : null;
    return qoderFetch(region, url, { headers: authHeaders(at, region, extra) });
  }
  __name(fetchCampaigns, "fetchCampaigns");
  async function claimCampaign(at, campaignId, acct, env) {
    const region = regionOf(acct.region);
    const headers = Object.assign(
      { "content-type": "application/json", origin: region.api },
      await riskHeaders(acct, env)
    );
    return qoderFetch(region, EP.campaigns + "/" + encodeURIComponent(campaignId) + "/claim", {
      method: "POST",
      headers: authHeaders(at, region, headers),
      body: {}
    });
  }
  __name(claimCampaign, "claimCampaign");
  function campaignRows(payload) {
    const rows = payload?.campaigns ?? payload?.data?.campaigns;
    return Array.isArray(rows) ? rows : [];
  }
  __name(campaignRows, "campaignRows");
  const isClaimable = /* @__PURE__ */ __name((s) => /^(CLAIMABLE|UNCLAIMED|UN_CLAIMED|AVAILABLE|PENDING_CLAIM)$/i.test(String(s || "")), "isClaimable");
  const isClaimedStatus = /* @__PURE__ */ __name((s) => /^(CLAIMED|ALREADY_CLAIMED|RECEIVED|GRANTED|DONE)$/i.test(String(s || "")), "isClaimedStatus");
  const ACTION_PRIORITY = ["CLAIM_BENEFIT", "VIEW_DETAILS", "DAILY_CHECKIN", "SIGN_IN"];
  const actionRank = /* @__PURE__ */ __name((t) => {
    const i = ACTION_PRIORITY.indexOf(String(t || ""));
    return i < 0 ? ACTION_PRIORITY.length : i;
  }, "actionRank");
  function describeRow(row) {
    const type = String(row?.actionType ?? "\u7A7A");
    const st = String(row?.claimStatus ?? "\u7A7A");
    const title = String(row?.title || row?.name || row?.campaignName || row?.displayName || "").trim();
    const amt = Number(
      row?.benefit?.amount ?? row?.reward?.amount ?? row?.credits ?? row?.creditAmount ?? 0
    ) || 0;
    return type + " / " + st + (title ? "\u300C" + title.slice(0, 12) + "\u300D" : "") + (amt ? " +" + amt : "");
  }
  __name(describeRow, "describeRow");
  function digestCampaigns(payload) {
    const rows = campaignRows(payload);
    if (!rows.length) {
      const keys = payload && typeof payload === "object" ? Object.keys(payload).slice(0, 6).join("/") : "\u975E\u5BF9\u8C61";
      const dataKeys = payload?.data && typeof payload.data === "object" ? Object.keys(payload.data).slice(0, 6).join("/") : "";
      return "\u8FD4\u56DE 0 \u6761\u6D3B\u52A8\uFF0C\u9876\u5C42\u5B57\u6BB5 " + (keys || "\u7A7A") + (dataKeys ? "\uFF0Cdata \u5B57\u6BB5 " + dataKeys : "");
    }
    const parts = [];
    for (const row of rows) {
      const k = describeRow(row);
      if (!parts.includes(k)) parts.push(k);
    }
    const text = "\u8FD4\u56DE " + rows.length + " \u6761\uFF1A" + parts.slice(0, 4).join("\uFF0C");
    return text.length > 150 ? text.slice(0, 148) + "\u2026" : text;
  }
  __name(digestCampaigns, "digestCampaigns");
  const bjHour = /* @__PURE__ */ __name((ms = Date.now()) => new Date(ms + 8 * 36e5).getUTCHours(), "bjHour");
  async function signinOne(env, acct, { force = false } = {}) {
    const now = Date.now();
    const today = bjDay(now);
    if (!force && acct.lastOkDate === today && acct.lastState === "checked") {
      return { id: acct.id, label: acct.label, state: "skipped", msg: "\u4ECA\u65E5\u5DF2\u5B8C\u6210" };
    }
    if (!force && Number(acct.cooldownUntil || 0) > now) {
      return { id: acct.id, label: acct.label, state: "skipped", msg: "\u9650\u6D41\u51B7\u5374\u4E2D" };
    }
    let at = String(acct.accessToken || "");
    let list;
    try {
      if (!at) at = await refreshAccount(acct);
      list = await fetchCampaigns(at, acct, env);
      if ((list.status === 401 || list.status === 403) && acct.refreshToken) {
        at = await refreshAccount(acct);
        list = await fetchCampaigns(at, acct, env);
      }
    } catch (e) {
      acct.lastState = e.fatal ? "token_dead" : "error";
      acct.lastMsg = e.message;
      acct.lastRun = now;
      await putAccount(env, acct);
      return { id: acct.id, label: acct.label, state: acct.lastState, msg: e.message };
    }
    let failed = "";
    if (list.status === 429) {
      acct.cooldownUntil = now + COOLDOWN_MIN * 6e4;
      failed = "error";
      acct.lastMsg = "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF08HTTP 429\uFF09\uFF0C" + COOLDOWN_MIN + " \u5206\u949F\u540E\u91CD\u8BD5";
    } else if (list.status === 401 || list.status === 403) {
      failed = "token_dead";
      acct.lastMsg = "\u51ED\u8BC1\u5DF2\u5931\u6548\uFF0C\u8BF7\u5220\u6389\u8FD9\u4E2A\u8D26\u53F7\u91CD\u65B0\u6DFB\u52A0";
    } else if (list.status !== 200) {
      failed = "error";
      acct.lastMsg = "\u6D3B\u52A8\u5217\u8868\u8FD4\u56DE HTTP " + list.status;
    }
    if (failed) {
      acct.lastState = failed;
      acct.lastRun = now;
      await putAccount(env, acct);
      return { id: acct.id, label: acct.label, state: failed, msg: acct.lastMsg };
    }
    const rows = campaignRows(list.json);
    const claimed = rows.some((row) => row && isClaimedStatus(row.claimStatus));
    const target = rows.filter((row) => row && isClaimable(row.claimStatus)).sort((a, b) => actionRank(a.actionType) - actionRank(b.actionType))[0] || null;
    acct.lastRun = now;
    if (!target) {
      const digest = digestCampaigns(list.json);
      const hasBenefitRow = rows.some((row) => /CLAIM_BENEFIT/i.test(String(row?.actionType || "")));
      if (claimed) {
        if (hasBenefitRow) {
          acct.lastState = "already";
          acct.lastOkDate = today;
          acct.lastMsg = "\u4ECA\u65E5\u5DF2\u9886\u53D6\uFF08\u6D3B\u52A8\u72B6\u6001\u5DF2\u662F CLAIMED\uFF09";
        } else {
          acct.lastState = "wait";
          acct.lastMsg = "\u4ECA\u65E5\u6CA1\u6709\u7B7E\u5230\u6D3B\u52A8\uFF0C\u53EA\u6709\u8425\u9500\u6D3B\u52A8 \xB7 " + digest;
        }
      } else {
        acct.lastState = "wait";
        acct.lastMsg = "\u6CA1\u6709\u53EF\u9886\u53D6\u7684\u6D3B\u52A8 \xB7 " + digest;
      }
      await putAccount(env, acct);
      return { id: acct.id, label: acct.label, state: acct.lastState, msg: acct.lastMsg };
    }
    const campaignId = String(target.campaignId || target.campaignKey || target.key || target.id || "").trim();
    if (!campaignId) {
      acct.lastState = "error";
      acct.lastMsg = "\u6D3B\u52A8\u6570\u636E\u91CC\u6CA1\u6709 campaignId\uFF0C\u65E0\u6CD5\u9886\u53D6";
      await putAccount(env, acct);
      return { id: acct.id, label: acct.label, state: acct.lastState, msg: acct.lastMsg };
    }
    let claim;
    try {
      claim = await claimCampaign(at, campaignId, acct, env);
    } catch (e) {
      acct.lastState = "error";
      acct.lastMsg = "\u9886\u53D6\u8BF7\u6C42\u5F02\u5E38\uFF1A" + e.message;
      await putAccount(env, acct);
      return { id: acct.id, label: acct.label, state: acct.lastState, msg: acct.lastMsg };
    }
    const body = claim.json || {};
    const already = claim.status === 409 || body.result === "ALREADY_CLAIMED" || body.replayed === true;
    if (already) {
      acct.lastState = "already";
      acct.lastOkDate = today;
      acct.lastMsg = "\u4ECA\u65E5\u5DF2\u9886\u53D6";
    } else if (claim.status === 200 || claim.status === 201) {
      const pick = /* @__PURE__ */ __name((o) => o && typeof o === "object" ? o : {}, "pick");
      const b1 = pick(body.benefit).amount ?? pick(body.reward).amount ?? body.credits ?? body.creditAmount;
      const b2 = pick(target.benefit).amount ?? pick(target.reward).amount ?? target.credits ?? target.creditAmount;
      const amount = Number(b1 ?? b2 ?? 0) || 0;
      const typeTag = String(target.actionType || "") !== "CLAIM_BENEFIT" ? "\uFF08" + String(target.actionType || "\u672A\u77E5\u7C7B\u578B") + "\uFF09" : "";
      if (body.status && body.status !== "CLAIMED") {
        acct.lastState = "pending";
        acct.lastMsg = "\u63D0\u4EA4\u6210\u529F\u4F46\u4E0A\u6E38\u672A\u786E\u8BA4\uFF08\u72B6\u6001 " + body.status + "\uFF09";
      } else {
        acct.lastState = "checked";
        acct.lastOkDate = today;
        acct.lastCredit = amount;
        acct.totalCredit = Number(acct.totalCredit || 0) + amount;
        acct.totalSigned = Number(acct.totalSigned || 0) + 1;
        acct.lastMsg = "\u9886\u53D6\u6210\u529F +" + amount + " credits" + typeTag;
      }
    } else if (claim.status === 429) {
      acct.lastState = "error";
      acct.cooldownUntil = now + COOLDOWN_MIN * 6e4;
      acct.lastMsg = "\u9886\u53D6\u88AB\u9650\u6D41\uFF08HTTP 429\uFF09\uFF0C\u7A0D\u540E\u91CD\u8BD5";
    } else if (claim.status === 401 || claim.status === 403) {
      acct.lastState = "token_dead";
      acct.lastMsg = "\u9886\u53D6\u5931\u8D25\uFF0C\u51ED\u8BC1\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u6DFB\u52A0\u8D26\u53F7";
    } else {
      acct.lastState = "error";
      const why = [body.message, body.errorMessage, body.msg, body.result, body.code].find((x) => typeof x === "string" && x.trim()) || "";
      acct.lastMsg = "\u9886\u53D6\u5931\u8D25\uFF08HTTP " + claim.status + "\uFF09" + why;
    }
    await putAccount(env, acct);
    return { id: acct.id, label: acct.label, state: acct.lastState, msg: acct.lastMsg };
  }
  __name(signinOne, "signinOne");
  async function handleList(request, env) {
    const list = await listAccounts(env);
    const out = [];
    const now = Date.now();
    const today = bjDay(now);
    for (const meta of list) {
      const a = await getAccount(env, meta.id);
      if (!a) continue;
      out.push({
        id: a.id,
        label: a.label,
        region: regionOf(a.region).key,
        regionName: regionOf(a.region).name,
        lastState: a.lastState,
        lastMsg: a.lastMsg,
        lastRun: a.lastRun ? new Date(a.lastRun + 8 * 36e5).toISOString().replace("Z", " +08:00") : null,
        lastOkDate: a.lastOkDate ?? null,
        lastCredit: a.lastCredit ?? null,
        totalCredit: a.totalCredit ?? 0,
        totalSigned: a.totalSigned ?? 0,
        cooldownUntil: Number(a.cooldownUntil || 0) > now ? a.cooldownUntil : 0,
        today,
        signedToday: a.lastOkDate === today,
        ranToday: a.lastRun ? bjDay(a.lastRun) === today : false,
        via: a.via || ""
        // 令牌永不下发
      });
    }
    return json2({
      count: out.length,
      today,
      accounts: out
    });
  }
  __name(handleList, "handleList");
  async function handleRun(request, env, force) {
    const list = await listAccounts(env);
    const results = [];
    for (const meta of list) {
      const a = await getAccount(env, meta.id);
      if (!a) continue;
      try {
        results.push(await signinOne(env, a, { force }));
      } catch (e) {
        results.push({ id: a.id, label: a.label, state: "error", msg: e.message });
      }
    }
    return json2({
      at: new Date(Date.now() + 8 * 36e5).toISOString().replace("Z", " +08:00"),
      count: results.length,
      results
    });
  }
  __name(handleRun, "handleRun");
  async function handleRemove(request, env) {
    const body = await readBody(request);
    const id = String(body.id ?? "").trim();
    if (!id) return json2({ error: "\u7F3A\u5C11 id" }, 400);
    await env.QODER_KV.delete(acctKey(id));
    const list = (await listAccounts(env)).filter((x) => x.id !== id);
    await saveIndex(env, list);
    return json2({ ok: true, removed: id });
  }
  __name(handleRemove, "handleRemove");
  async function handleRename(request, env) {
    const body = await readBody(request);
    const id = String(body.id ?? "").trim();
    const label = String(body.label ?? "").trim().slice(0, 40);
    if (!id) return json2({ error: "\u7F3A\u5C11 id" }, 400);
    if (!label) return json2({ error: "\u5907\u6CE8\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
    const acct = await getAccount(env, id);
    if (!acct) return json2({ error: "\u8D26\u53F7\u4E0D\u5B58\u5728" }, 404);
    acct.label = label;
    await putAccount(env, acct);
    const list = await listAccounts(env);
    await saveIndex(env, list.map((x) => x.id === id ? { ...x, label } : x));
    return json2({ ok: true, id, label });
  }
  __name(handleRename, "handleRename");
  async function handleInspect(request, env) {
    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") ?? "").trim();
    let acct = id ? await getAccount(env, id) : null;
    if (!acct && !id) {
      const first = (await listAccounts(env))[0];
      acct = first ? await getAccount(env, first.id) : null;
    }
    if (!acct) return json2({ error: "\u6CA1\u6709\u53EF\u8BCA\u65AD\u7684\u8D26\u53F7" }, 404);
    const region = regionOf(acct.region);
    let at = String(acct.accessToken || "");
    let r;
    try {
      if (!at) at = await refreshAccount(acct);
      r = await fetchCampaigns(at, acct, env);
      if ((r.status === 401 || r.status === 403) && acct.refreshToken) {
        at = await refreshAccount(acct);
        await putAccount(env, acct);
        r = await fetchCampaigns(at, acct, env);
      }
    } catch (e) {
      return json2({ label: acct.label, region: region.key, error: e.message }, 502);
    }
    const rows = campaignRows(r.json);
    let versionProbe = null;
    const tryVer = String(url.searchParams.get("version") || "").trim();
    if (tryVer) {
      const x = await fetchCampaigns(at, acct, env, { risk: true, force: true, version: tryVer }).catch((e) => ({ status: 0, json: {}, text: String(e.message || e) }));
      versionProbe = {
        version: tryVer,
        httpStatus: x.status,
        count: campaignRows(x.json).length,
        digest: digestCampaigns(x.json)
      };
    }
    let variants = null;
    if (url.searchParams.get("probe") === "1") {
      const one = /* @__PURE__ */ __name(async (risk, force) => {
        const x = await fetchCampaigns(at, acct, env, { risk, force }).catch((e) => ({ status: 0, json: {}, text: String(e.message || e) }));
        return {
          risk,
          forceRefresh: force,
          httpStatus: x.status,
          count: campaignRows(x.json).length,
          digest: digestCampaigns(x.json)
        };
      }, "one");
      variants = [
        { risk: true, forceRefresh: true, httpStatus: r.status, count: rows.length, digest: digestCampaigns(r.json) },
        await one(false, true),
        await one(true, false)
      ];
    }
    const rh = await riskHeaders(acct, env);
    const sent = Object.keys(authHeaders(at, region, rh)).filter((k) => k !== "authorization");
    return json2({
      label: acct.label,
      region: region.key,
      api: region.api,
      httpStatus: r.status,
      count: rows.length,
      claimable: rows.filter((x) => x && isClaimable(x.claimStatus)).length,
      digest: digestCampaigns(r.json),
      sentHeaders: sent,
      clientVersion: CLIENT_VERSION,
      versionProbe,
      variants,
      /*** 工具会挑哪一条去领，以及凭哪个字段当 id */
      willClaim: (() => {
        const t = rows.filter((x) => x && isClaimable(x.claimStatus)).sort((a, b) => actionRank(a.actionType) - actionRank(b.actionType))[0];
        if (!t) return null;
        return {
          actionType: t.actionType ?? null,
          id: String(t.campaignId || t.campaignKey || t.key || t.id || "") || null,
          row: t
        };
      })(),
      campaigns: rows,
      raw: r.json
    });
  }
  __name(handleInspect, "handleInspect");
  function json2(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
  __name(json2, "json");
  function requireAdmin2(request, env) {
    const url = new URL(request.url);
    const given = request.headers.get("X-Admin-Token") || (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") || url.searchParams.get("token");
    if (!env.ADMIN_TOKEN) return { ok: false, res: json2({ error: "\u672A\u914D\u7F6E ADMIN_TOKEN" }, 500) };
    if (!timingSafeEqual(given, env.ADMIN_TOKEN)) return { ok: false, res: json2({ error: "\u767B\u5F55\u5BC6\u7801\u4E0D\u6B63\u786E" }, 401) };
    return { ok: true };
  }
  __name(requireAdmin2, "requireAdmin");
  function requireCron2(request, env) {
    const secret = env.CRON_SECRET || env.ADMIN_TOKEN;
    const url = new URL(request.url);
    const given = request.headers.get("X-Cron-Secret") || url.searchParams.get("key");
    if (!secret) return { ok: false, res: json2({ error: "\u672A\u914D\u7F6E CRON_SECRET / ADMIN_TOKEN" }, 500) };
    if (!timingSafeEqual(given, secret)) return { ok: false, res: json2({ error: "\u53E3\u4EE4\u4E0D\u5BF9" }, 401) };
    return { ok: true };
  }
  __name(requireCron2, "requireCron");
  async function readBody(request) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }
  __name(readBody, "readBody");
  const __mod = {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const method = request.method.toUpperCase();
      try {
        if (path === "/cron") {
          const c = requireCron2(request, env);
          if (!c.ok) return c.res;
          return handleRun(request, env, false);
        }
        if (!path.startsWith("/api/")) return json2({ error: "not found" }, 404);
        const a = requireAdmin2(request, env);
        if (!a.ok) return a.res;
        if (path === "/api/list" && method === "GET") return handleList(request, env);
        if (path === "/api/login/start" && method === "POST") return handleLoginStart(request, env);
        if (path === "/api/login/poll" && method === "GET") return handleLoginPoll(request, env);
        if (path === "/api/remove" && method === "POST") return handleRemove(request, env);
        if (path === "/api/rename" && method === "POST") return handleRename(request, env);
        if (path === "/api/inspect" && method === "GET") return handleInspect(request, env);
        if (path === "/api/run" && method === "POST") {
          const force = url.searchParams.get("force") === "1";
          return handleRun(request, env, force);
        }
        return json2({ error: "not found" }, 404);
      } catch (e) {
        return json2({ error: e.message || String(e) }, 500);
      }
    },
    /** Cloudflare Cron Trigger 到点自动跑 */
    async scheduled(event, env, ctx) {
      ctx.waitUntil(
        (async () => {
          const list = await listAccounts(env);
          for (const meta of list) {
            const acct = await getAccount(env, meta.id);
            if (!acct) continue;
            try {
              await signinOne(env, acct, { force: false });
            } catch {
            }
          }
        })()
      );
    }
  };
  return { fetch: __mod.fetch, scheduled: __mod.scheduled };
})();
function kvScope(kv, prefix) {
  const strip = /* @__PURE__ */ __name((keys) => (keys || []).map((x) => ({ ...x, name: String(x.name).slice(prefix.length) })), "strip");
  return {
    async get(k, o) {
      return kv.get(prefix + k, o);
    },
    async put(k, v, o) {
      return kv.put(prefix + k, v, o);
    },
    async delete(k) {
      return kv.delete(prefix + k);
    },
    async list(o = {}) {
      const r = await kv.list({ ...o, prefix: prefix + (o.prefix || "") });
      return { ...r, keys: strip(r.keys) };
    }
  };
}
__name(kvScope, "kvScope");
function missingKV(hint) {
  const boom = /* @__PURE__ */ __name(() => {
    throw new Error(hint);
  }, "boom");
  return { get: boom, put: boom, delete: boom, list: boom };
}
__name(missingKV, "missingKV");
function kvFor(env, prefix) {
  if (env.KV) return kvScope(env.KV, prefix);
  return missingKV("\u672A\u7ED1\u5B9A KV\uFF1A\u8BF7\u7ED9 Worker \u6DFB\u52A0\u4E00\u4E2A KV \u547D\u540D\u7A7A\u95F4\uFF0C\u53D8\u91CF\u540D\u586B KV");
}
__name(kvFor, "kvFor");
function traeEnv(env) {
  return {
    TRAE_KV: kvFor(env, "trae:"),
    TRAE_MASTER_KEY: env.MASTER_KEY,
    ADMIN_TOKEN: env.ADMIN_TOKEN,
    CRON_SECRET: env.CRON_SECRET
  };
}
__name(traeEnv, "traeEnv");
function wbEnv(env) {
  return {
    WB_KV: kvFor(env, "wb:"),
    WB_MASTER_KEY: env.MASTER_KEY,
    ADMIN_TOKEN: env.ADMIN_TOKEN,
    CRON_SECRET: env.CRON_SECRET
  };
}
__name(wbEnv, "wbEnv");
function qoderEnv(env) {
  return {
    QODER_KV: kvFor(env, "qoder:"),
    QODER_MASTER_KEY: env.MASTER_KEY,
    ADMIN_TOKEN: env.ADMIN_TOKEN,
    CRON_SECRET: env.CRON_SECRET,
    // UMID 三件套（可选）：让请求看起来来自一台真实客户端。
    // 由本机 Qoder 客户端 / qodercli 的 runtime-info 组件生成，Worker 造不出来。
    QODER_MACHINE_TOKEN: env.QODER_MACHINE_TOKEN,
    QODER_MACHINE_CODE: env.QODER_MACHINE_CODE,
    QODER_MACHINE_TYPE: env.QODER_MACHINE_TYPE
  };
}
__name(qoderEnv, "qoderEnv");
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
__name(json, "json");
function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
  });
}
__name(htmlResponse, "htmlResponse");
function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a ?? ""));
  const y = new TextEncoder().encode(String(b ?? ""));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
__name(safeEqual, "safeEqual");
function requireAdmin(request, env) {
  const url = new URL(request.url);
  const given = request.headers.get("X-Admin-Token") || (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") || url.searchParams.get("token");
  if (!env.ADMIN_TOKEN) return { ok: false, res: json({ error: "\u672A\u914D\u7F6E ADMIN_TOKEN" }, 500) };
  if (!safeEqual(given, env.ADMIN_TOKEN)) return { ok: false, res: json({ error: "\u767B\u5F55\u5BC6\u7801\u4E0D\u6B63\u786E" }, 401) };
  return { ok: true };
}
__name(requireAdmin, "requireAdmin");
function requireCron(request, env) {
  const secret = env.CRON_SECRET || env.ADMIN_TOKEN;
  const url = new URL(request.url);
  const given = request.headers.get("X-Cron-Secret") || url.searchParams.get("key");
  if (!secret) return { ok: false, res: json({ error: "\u672A\u914D\u7F6E CRON_SECRET / ADMIN_TOKEN" }, 500) };
  if (!safeEqual(given, secret)) return { ok: false, res: json({ error: "\u53E3\u4EE4\u4E0D\u5BF9" }, 401) };
  return { ok: true };
}
__name(requireCron, "requireCron");
function repath(request, path) {
  const u = new URL(request.url);
  u.pathname = path || "/";
  return new Request(u.toString(), request);
}
__name(repath, "repath");
async function runPlatform(mod, env, origin, force) {
  const target = new URL("/api/run" + (force ? "?force=1" : ""), origin);
  const req = new Request(target.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": String(env.ADMIN_TOKEN || "") },
    body: "{}"
  });
  const res = await mod.fetch(req, env, { waitUntil() {
  } });
  const data = await res.json().catch(() => ({ error: "HTTP " + res.status }));
  return data;
}
__name(runPlatform, "runPlatform");
async function runAll(env, origin, force) {
  const out = {};
  for (const [key, mod, e] of [
    ["trae", Trae, traeEnv(env)],
    ["wb", WorkBuddy, wbEnv(env)],
    ["qoder", Qoder, qoderEnv(env)]
  ]) {
    try {
      out[key] = await runPlatform(mod, e, origin, force);
    } catch (err) {
      out[key] = { error: err.message || String(err) };
    }
  }
  const result = {
    at: new Date(Date.now() + 8 * 36e5).toISOString().replace("Z", " +08:00"),
    ...out
  };
  try {
    const n = await notifyRun(env, result);
    if (n && n.errors) result.notifyError = n.errors;
  } catch (err) {
    result.notifyError = [String(err.message || err)];
  }
  return result;
}
__name(runAll, "runAll");
var NOTIFY_TIMEOUT = 12e3;
var QQ_OPENID_HELPER = `#!/usr/bin/env node
/**
 * \u53D6 QQ \u673A\u5668\u4EBA\u7ED9\u4F60\u7684 user_openid
 *
 * \u7528\u6CD5\uFF1A node openid-helper.mjs <AppID> <AppSecret>
 *
 * \u539F\u7406\uFF1AWebSocket \u662F\u5BA2\u6237\u7AEF\u4E3B\u52A8\u5F80\u5916\u8FDE\uFF0C\u4E0D\u9700\u8981\u57DF\u540D\u3001\u4E0D\u9700\u8981\u5907\u6848\u3002
 * \u8FDE\u4E0A\u540E\u7528 intents(1<<25) \u8BA2\u9605\u300C\u79C1\u804A / \u7FA4\u91CC @\u300D\u4E8B\u4EF6\uFF0C\u4F60\u7ED9\u673A\u5668\u4EBA\u53D1\u4E00\u6761\u6D88\u606F\uFF0C
 * \u811A\u672C\u4ECE\u4E8B\u4EF6\u91CC\u53D6\u51FA author.user_openid \u6253\u5370\u51FA\u6765\uFF0C\u7136\u540E\u81EA\u5DF1\u9000\u51FA\u3002
 *
 * \u53EA\u4F9D\u8D56 Node 18+\uFF08\u5185\u7F6E fetch \u548C WebSocket\uFF09\u3002
 */
const [appId, secret] = process.argv.slice(2);

if (!appId || !secret) {
  console.error('\u7528\u6CD5: node openid-helper.mjs <AppID> <AppSecret>');
  process.exit(1);
}

const TOKEN_URL = 'https://bots.qq.com/app/getAppAccessToken';
const API = 'https://api.sgroup.qq.com';
const INTENTS_GROUP_AND_C2C = 1 << 25;

async function main() {
  console.log('1/3 \u6362\u53D6 access_token\u2026');
  const tr = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ appId, clientSecret: secret }),
  });
  const tj = await tr.json().catch(() => ({}));
  if (!tj.access_token) {
    console.error('\u2717 \u6362\u53D6 token \u5931\u8D25\uFF1A' + JSON.stringify(tj));
    console.error('  \u68C0\u67E5 AppID / AppSecret \u662F\u5426\u6B63\u786E\u3002');
    process.exit(1);
  }

  console.log('2/3 \u83B7\u53D6 WebSocket \u7F51\u5173\u2026');
  const gr = await fetch(API + '/gateway', {
    headers: { authorization: 'QQBot ' + tj.access_token },
  });
  const gj = await gr.json().catch(() => ({}));
  if (!gj.url) {
    console.error('\u2717 \u83B7\u53D6\u7F51\u5173\u5931\u8D25\uFF1A' + JSON.stringify(gj));
    process.exit(1);
  }

  console.log('3/3 \u5DF2\u8FDE\u63A5\uFF0C\u8BF7\u73B0\u5728\u7528\u624B\u673A QQ \u7ED9\u673A\u5668\u4EBA\u53D1\u4E00\u6761\u79C1\u804A\u6D88\u606F\u2026');
  console.log('    \uFF0860 \u79D2\u5185\u6709\u6548\uFF0C\u6536\u5230\u540E\u811A\u672C\u4F1A\u81EA\u5DF1\u9000\u51FA\uFF09');
  console.log('');

  const ws = new WebSocket(gj.url);
  let seq = null;
  let heartbeat = null;
  const timer = setTimeout(() => {
    console.error('\u2717 \u8D85\u65F6\uFF1A60 \u79D2\u5185\u6CA1\u6536\u5230\u6D88\u606F\u3002');
    console.error('  \u786E\u8BA4\u673A\u5668\u4EBA\u5DF2\u5F00\u901A\u300C\u79C1\u804A\u6D88\u606F\u300D\u6743\u9650\uFF0C\u5E76\u4E14\u662F\u76F4\u63A5\u79C1\u804A\u5B83\u3002');
    cleanup(1);
  }, 60000);

  function cleanup(code) {
    clearTimeout(timer);
    if (heartbeat) clearInterval(heartbeat);
    try { ws.close(); } catch (e) {}
    setTimeout(() => process.exit(code), 80);
  }

  ws.onopen = () => console.log('   \u8FDE\u63A5\u5DF2\u5EFA\u7ACB\uFF0C\u7B49\u5F85\u9274\u6743\u2026');

  ws.onmessage = (ev) => {
    let p2;
    try { p2 = JSON.parse(ev.data); } catch (e) { return; }
    if (p2.s) seq = p2.s;

    if (p2.op === 10) {
      ws.send(JSON.stringify({
        op: 2,
        d: {
          token: 'QQBot ' + tj.access_token,
          intents: INTENTS_GROUP_AND_C2C,
          shard: [0, 1],
          properties: { $os: 'linux', $browser: 'node', $device: 'node' },
        },
      }));
      heartbeat = setInterval(() => {
        try { ws.send(JSON.stringify({ op: 1, d: seq })); } catch (e) {}
      }, 40000);
      return;
    }

    if (p2.op === 9) {
      console.error('\u2717 \u9274\u6743\u5931\u8D25\uFF1Aintents \u6CA1\u6743\u9650\u3002\u53BB q.qq.com \u786E\u8BA4\u673A\u5668\u4EBA\u5F00\u901A\u4E86\u300C\u79C1\u804A\u6D88\u606F\u300D\u4E8B\u4EF6\u3002');
      cleanup(1);
      return;
    }

    if (p2.op !== 0 || !p2.t) return;

    if (p2.t === 'READY') {
      console.log('   \u9274\u6743\u901A\u8FC7\uFF0C\u6B63\u5728\u7B49\u4F60\u53D1\u6D88\u606F\u2026');
      return;
    }

    const d = p2.d || {};
    const author = d.author || {};
    const oid = author.user_openid || author.member_openid || d.user_openid || '';
    if (oid) {
      console.log('');
      console.log('==============================================');
      console.log('\u2705 \u62FF\u5230\u4E86 OpenID\uFF1A');
      console.log('');
      console.log('   ' + oid);
      console.log('');
      console.log('\u4E8B\u4EF6\u7C7B\u578B: ' + p2.t);
      console.log('==============================================');
      console.log('');
      console.log('\u628A\u4E0A\u9762\u8FD9\u4E32\u586B\u8FDB\u7B7E\u5230\u63A7\u5236\u53F0 \u2192 \u901A\u77E5 \u2192 QQ \u673A\u5668\u4EBA\u7684\u300COpenID\u300D\uFF0C\u4FDD\u5B58\u5373\u53EF\u3002');
      cleanup(0);
      return;
    }

    console.log('   \u6536\u5230\u4E8B\u4EF6 ' + p2.t + '\uFF0C\u4E0D\u662F\u6D88\u606F\u4E8B\u4EF6\uFF0C\u7EE7\u7EED\u7B49\u2026');
  };

  ws.onerror = () => console.error('   \u8FDE\u63A5\u5F02\u5E38\uFF0C\u7EE7\u7EED\u7B49\u5F85\u2026');
}

main().catch((e) => {
  console.error('\u2717 ' + (e && e.message ? e.message : e));
  process.exit(1);
});
`;
var NOTIFY_KEY = "config";
function envNotifyDefaults(env) {
  const s = /* @__PURE__ */ __name((k) => String(env?.[k] || "").trim(), "s");
  const cfg = {};
  if (s("TG_BOT_TOKEN") || s("TG_CHAT_ID")) {
    cfg.telegram = { enabled: true, token: s("TG_BOT_TOKEN"), chatId: s("TG_CHAT_ID") };
  }
  if (s("QQ_APP_ID") || s("QQ_OPENID")) {
    cfg.qq = {
      enabled: true,
      appId: s("QQ_APP_ID"),
      secret: s("QQ_APP_SECRET"),
      openid: s("QQ_OPENID"),
      sandbox: /^(1|true|yes)$/i.test(s("QQ_SANDBOX"))
    };
  }
  return cfg;
}
__name(envNotifyDefaults, "envNotifyDefaults");
function nvB64(buf) {
  const b = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < b.length; i++) out += String.fromCharCode(b[i]);
  return btoa(out);
}
__name(nvB64, "nvB64");
function nvUnb64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
__name(nvUnb64, "nvUnb64");
async function nvKey(env, salt) {
  const raw = String(env.MASTER_KEY || "").trim();
  if (!raw) throw new Error("\u7F3A\u5C11 MASTER_KEY");
  const master = nvUnb64(raw);
  if (master.length !== 32) throw new Error("MASTER_KEY \u5FC5\u987B\u662F 32 \u5B57\u8282");
  const base = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: new TextEncoder().encode("notify/v1/config") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
__name(nvKey, "nvKey");
async function nvSeal(env, obj) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await nvKey(env, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return JSON.stringify({ v: 1, s: nvB64(salt), i: nvB64(iv), d: nvB64(ct) });
}
__name(nvSeal, "nvSeal");
async function nvOpen(env, text) {
  const box = JSON.parse(text);
  const key = await nvKey(env, nvUnb64(box.s));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nvUnb64(box.i) }, key, nvUnb64(box.d));
  return JSON.parse(new TextDecoder().decode(pt));
}
__name(nvOpen, "nvOpen");
async function loadNotifyConfig(env) {
  try {
    const raw = await kvFor(env, "notify:").get(NOTIFY_KEY);
    if (raw) return await nvOpen(env, raw);
  } catch {
  }
  return envNotifyDefaults(env);
}
__name(loadNotifyConfig, "loadNotifyConfig");
async function saveNotifyConfig(env, cfg) {
  await kvFor(env, "notify:").put(NOTIFY_KEY, await nvSeal(env, cfg));
}
__name(saveNotifyConfig, "saveNotifyConfig");
async function notifyChannels(env) {
  const cfg = await loadNotifyConfig(env);
  const ch = {};
  const str = /* @__PURE__ */ __name((v) => String(v || "").trim(), "str");
  const t = cfg.telegram || {};
  if (t.enabled !== false && str(t.token) && str(t.chatId)) {
    ch.telegram = { token: str(t.token), chatId: str(t.chatId) };
  }
  const q = cfg.qq || {};
  if (q.enabled !== false && str(q.appId) && str(q.secret) && str(q.openid)) {
    ch.qq = {
      appId: str(q.appId),
      secret: str(q.secret),
      openid: str(q.openid),
      sandbox: !!q.sandbox
    };
  }
  return ch;
}
__name(notifyChannels, "notifyChannels");
async function notifyConfigForUi(env) {
  const cfg = await loadNotifyConfig(env);
  const mask = /* @__PURE__ */ __name((v) => v ? "\u5DF2\u914D\u7F6E \xB7" + String(v).slice(-4) : "", "mask");
  const t = cfg.telegram || {};
  const q = cfg.qq || {};
  return {
    // 明文字段：这个接口要 admin token 才能调，方便用户下次打开核对/修改
    telegram: { enabled: t.enabled !== false, token: t.token || "", chatId: t.chatId || "", tokenSet: !!t.token },
    qq: {
      enabled: q.enabled !== false,
      appId: q.appId || "",
      secret: q.secret || "",
      secretSet: !!q.secret,
      openid: q.openid || "",
      sandbox: !!q.sandbox
    },
    fromEnv: !await kvFor(env, "notify:").get(NOTIFY_KEY)
  };
}
__name(notifyConfigForUi, "notifyConfigForUi");
async function notifyFetch(url, { method = "POST", headers = {}, body, timeout = NOTIFY_TIMEOUT } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      method,
      headers: { accept: "application/json", ...headers },
      body: body === void 0 ? void 0 : JSON.stringify(body),
      signal: ctrl.signal
    });
    const text = await r.text();
    let json2 = {};
    try {
      json2 = text ? JSON.parse(text) : {};
    } catch {
      json2 = {};
    }
    return { status: r.status, json: json2, text };
  } finally {
    clearTimeout(timer);
  }
}
__name(notifyFetch, "notifyFetch");
async function sendTelegram(cfg, text) {
  const r = await notifyFetch("https://api.telegram.org/bot" + cfg.token + "/sendMessage", {
    headers: { "content-type": "application/json" },
    body: { chat_id: cfg.chatId, text, disable_web_page_preview: true }
  });
  if (r.status >= 400 || r.json.ok === false) {
    throw new Error("Telegram HTTP " + r.status + "\uFF1A" + (r.json.description || r.text.slice(0, 120)));
  }
}
__name(sendTelegram, "sendTelegram");
var qqToken = null;
async function qqAccessToken(cfg) {
  if (qqToken && qqToken.appId === cfg.appId && qqToken.exp > Date.now()) return qqToken.token;
  const r = await notifyFetch("https://bots.qq.com/app/getAppAccessToken", {
    headers: { "content-type": "application/json" },
    body: { appId: cfg.appId, clientSecret: cfg.secret }
  });
  const token = r.json.access_token || r.json.accessToken;
  if (r.status >= 400 || !token) {
    throw new Error("QQ \u6362 access_token \u5931\u8D25 HTTP " + r.status + "\uFF1A" + r.text.slice(0, 140));
  }
  const ttl = Number(r.json.expires_in || r.json.expiresIn || 7200);
  qqToken = { appId: cfg.appId, token, exp: Date.now() + Math.max(60, ttl - 120) * 1e3 };
  return token;
}
__name(qqAccessToken, "qqAccessToken");
async function sendQQ(cfg, text) {
  const token = await qqAccessToken(cfg);
  const base = cfg.sandbox ? "https://sandbox.api.sgroup.qq.com" : "https://api.sgroup.qq.com";
  const r = await notifyFetch(base + "/v2/users/" + encodeURIComponent(cfg.openid) + "/messages", {
    headers: { "content-type": "application/json", authorization: "QQBot " + token },
    body: { content: text, msg_type: 0 }
  });
  if (r.status >= 400) {
    throw new Error("QQ \u53D1\u9001\u5931\u8D25 HTTP " + r.status + "\uFF1A" + (r.json.message || r.text.slice(0, 140)));
  }
}
__name(sendQQ, "sendQQ");
var PLATFORM_LABEL = { trae: "Trae", wb: "WorkBuddy", qoder: "Qoder" };
function tally(d) {
  const rs = Array.isArray(d?.results) ? d.results : [];
  let ok = 0, skip = 0, bad = 0;
  for (const r of rs) {
    if (r.state === "checked") ok++;
    else if (r.state === "skipped" || r.state === "already") skip++;
    else bad++;
  }
  return { ok, skip, bad, total: rs.length };
}
__name(tally, "tally");
function formatReport(result) {
  const lines = [];
  const at = String(result.at || "").replace(" +08:00", "");
  lines.push("\u{1F4CB} \u7B7E\u5230\u5B8C\u6210 \xB7 " + (at ? at.slice(5, 16) : ""));
  let anyBad = false;
  for (const key of ["trae", "wb", "qoder"]) {
    const d = result[key];
    const name = PLATFORM_LABEL[key];
    if (!d) continue;
    if (d.error) {
      lines.push(`${name}  \u274C ${String(d.error).slice(0, 90)}`);
      anyBad = true;
      continue;
    }
    const t = tally(d);
    if (!t.total) {
      lines.push(`${name}  \u2014 \u6CA1\u6709\u8D26\u53F7`);
      continue;
    }
    const mark = t.bad ? "\u26A0\uFE0F" : "\u2705";
    if (t.bad) anyBad = true;
    const done = t.ok + t.skip;
    const extra = [];
    if (t.ok) extra.push(`\u65B0\u7B7E ${t.ok}`);
    if (t.skip) extra.push(`\u5DF2\u7B7E ${t.skip}`);
    if (t.bad) extra.push(`\u5931\u8D25 ${t.bad}`);
    const suffix = extra.length > 1 || t.skip || t.bad ? " \xB7 " + extra.join(" \xB7 ") : "";
    lines.push(`${name}  ${mark} ${done}/${t.total}${suffix}`);
    for (const r of (d.results || []).slice(0, 6)) {
      if (r.state === "checked" && r.msg) lines.push("   \xB7 " + r.label + " " + String(r.msg).slice(0, 60));
      else if (r.state !== "checked" && r.state !== "skipped" && r.msg) {
        lines.push("   \xB7 " + r.label + " " + String(r.msg).slice(0, 60));
      }
    }
    if ((d.results || []).length > 6) lines.push("   \xB7 \u2026\u8FD8\u6709 " + (d.results.length - 6) + " \u4E2A");
  }
  if (anyBad) lines.push("", "\u9700\u8981\u5904\u7406\u7684\u90E8\u5206\u53EF\u4EE5\u6253\u5F00\u63A7\u5236\u53F0\u770B\u4E00\u773C\u3002");
  return lines.join("\n");
}
__name(formatReport, "formatReport");
async function notifyRun(env, result) {
  const ch = await notifyChannels(env);
  if (!ch.telegram && !ch.qq) return { skipped: true };
  const text = formatReport(result);
  const jobs = [];
  if (ch.telegram) jobs.push(sendTelegram(ch.telegram, text).then(() => null, (e) => "Telegram\uFF1A" + (e.message || e)));
  if (ch.qq) jobs.push(sendQQ(ch.qq, text).then(() => null, (e) => "QQ\uFF1A" + (e.message || e)));
  const errors = (await Promise.all(jobs)).filter(Boolean);
  return errors.length ? { errors } : { ok: true, channels: Object.keys(ch) };
}
__name(notifyRun, "notifyRun");
var BUILD = "2026-11-02";
var PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>\u7B7E\u5230\u63A7\u5236\u53F0 \xB7 Trae + WorkBuddy + Qoder</title>
<style>
  :root{
    --bg:#eef1f5;--glow-a:rgba(16,160,110,.11);--glow-b:rgba(56,110,220,.09);--grid:rgba(15,23,42,.035);
    --surface:#fff;--surface-2:#f6f8fa;--line:rgba(15,23,42,.09);--line-2:rgba(15,23,42,.16);
    --txt:#0c141d;--dim:#5e6a78;--pri:#0d8a61;--pri-ink:#fff;--ring:rgba(13,138,97,.16);
    --ok:#0d8a61;--ok-bg:rgba(13,138,97,.10);--warn:#9a6407;--warn-bg:rgba(190,124,15,.13);
    --bad:#bf3529;--bad-bg:rgba(191,53,41,.10);--idle:#5e6a78;--idle-bg:rgba(15,23,42,.055);
    --bar:rgba(238,241,245,.78);--sh-1:0 1px 2px rgba(15,23,42,.04),0 10px 26px -16px rgba(15,23,42,.22);
    --sh-2:0 18px 44px -22px rgba(15,23,42,.35);--r:16px;
    --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
  }
  @media (prefers-color-scheme:dark){
    :root{
      --bg:#070a0e;--glow-a:rgba(45,208,126,.16);--glow-b:rgba(70,110,255,.13);--grid:rgba(255,255,255,.035);
      --surface:#101822;--surface-2:#0c131b;--line:rgba(255,255,255,.075);--line-2:rgba(255,255,255,.14);
      --txt:#e8eef5;--dim:#8b98a7;--pri:#2fd07e;--pri-ink:#04150d;--ring:rgba(47,208,126,.20);
      --ok:#3ddc97;--ok-bg:rgba(61,220,151,.13);--warn:#e6ae4a;--warn-bg:rgba(230,174,74,.13);
      --bad:#ff7d6e;--bad-bg:rgba(255,125,110,.13);--idle:#8b98a7;--idle-bg:rgba(255,255,255,.06);
      --bar:rgba(7,10,14,.72);--sh-1:0 1px 0 rgba(255,255,255,.03),0 14px 34px -22px rgba(0,0,0,.95);
      --sh-2:0 26px 60px -30px rgba(0,0,0,1);
    }
  }
  *{box-sizing:border-box}
  [hidden]{display:none!important}
  body{margin:0;background:var(--bg);color:var(--txt);-webkit-font-smoothing:antialiased;
       font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
  body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
    background:radial-gradient(58% 46% at 8% -6%,var(--glow-a),transparent 62%),
               radial-gradient(46% 42% at 96% 2%,var(--glow-b),transparent 62%)}
  body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;background-image:
      linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
    background-size:46px 46px;
    -webkit-mask-image:radial-gradient(72% 58% at 50% 0%,#000,transparent 78%);
            mask-image:radial-gradient(72% 58% at 50% 0%,#000,transparent 78%)}
  .wrap{position:relative;z-index:1;max-width:1920px;margin:0 auto;
        padding:clamp(16px,2.6vw,36px) clamp(16px,3vw,44px) 68px}

  .brand{display:flex;align-items:center;gap:13px}
  .mark{width:44px;height:44px;flex:0 0 auto;border-radius:14px;display:grid;place-items:center;
        background:linear-gradient(155deg,var(--pri),#0a6a4a);
        box-shadow:var(--sh-2),inset 0 1px 0 rgba(255,255,255,.3)}
  .mark svg{width:21px;height:21px;fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
  .eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
  .eyebrow .ver{display:inline-block;margin-left:6px;padding:1px 5px;border-radius:4px;
    background:var(--idle-bg);color:var(--dim);letter-spacing:0;font-size:9.5px;text-transform:none}
  h1{font-size:clamp(19px,2.6vw,23px);margin:1px 0 0;font-weight:700;letter-spacing:-.02em;line-height:1.25}

  #loginView{min-height:min(74dvh,640px);display:grid;place-content:center;gap:26px}
  .login-card{width:min(470px,92vw);padding:26px;background:var(--surface);border:1px solid var(--line);
              border-radius:var(--r);box-shadow:var(--sh-1)}
  .lbl{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;
       text-transform:uppercase;color:var(--dim);margin-bottom:9px}
  .field{display:flex;gap:10px}
  .field input{flex:1;min-width:0}

  input{font:inherit;padding:12px 14px;border:1px solid var(--line-2);border-radius:12px;
        background:var(--surface);color:var(--txt);outline:none;transition:border-color .18s,box-shadow .18s;width:100%}
  input::placeholder{color:var(--dim)}
  input:focus{border-color:var(--pri);box-shadow:0 0 0 4px var(--ring)}
  button{font:inherit;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:8px;
         padding:11px 18px;border-radius:12px;border:1px solid var(--line-2);background:var(--surface);color:var(--txt);
         cursor:pointer;transition:transform .12s ease,box-shadow .18s ease,border-color .18s ease,filter .18s ease}
  button:hover{border-color:var(--txt);transform:translateY(-1px);box-shadow:var(--sh-1)}
  button:active{transform:none}
  button:focus-visible{outline:2px solid var(--pri);outline-offset:2px}
  button.pri{background:var(--pri);border-color:transparent;color:var(--pri-ink);
             box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 12px 26px -14px var(--pri)}
  button.pri:hover{border-color:transparent;filter:brightness(1.06)}
  button:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}

  .topbar{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;
          gap:14px;flex-wrap:wrap;padding:12px 0 14px;margin-bottom:14px;background:var(--bar);
          backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
  .chip{display:inline-flex;align-items:center;gap:8px;padding:7px 13px;border-radius:999px;border:1px solid var(--line);
        background:var(--surface);font-size:12.5px;color:var(--dim);white-space:nowrap;box-shadow:var(--sh-1)}
  .chip b{color:var(--txt);font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:12px}
  .chip .dot{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px var(--ok-bg)}

  /* GitHub \u4ED3\u5E93\u5165\u53E3 */
  .gh{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 15px;border-radius:12px;
      border:1px solid var(--line-2);background:var(--surface);color:var(--txt);font-size:13px;font-weight:600;
      text-decoration:none;white-space:nowrap;
      transition:transform .12s ease,box-shadow .18s ease,border-color .18s ease,color .18s ease}
  .gh svg{width:16px;height:16px;flex:0 0 auto;fill:currentColor}
  .gh:hover{border-color:var(--txt);transform:translateY(-1px);box-shadow:var(--sh-1)}
  .gh:active{transform:none}
  .gh:focus-visible{outline:2px solid var(--pri);outline-offset:2px}

  .tabs{display:flex;gap:4px;margin-bottom:18px;padding:4px;border:1px solid var(--line);border-radius:14px;
        background:var(--surface-2);width:fit-content;max-width:100%;overflow:auto}
  .tab{display:inline-flex;align-items:center;gap:9px;padding:10px 20px;border:0;border-radius:10px;background:transparent;
       color:var(--dim);font-size:14px;font-weight:600;white-space:nowrap;box-shadow:none}
  .tab:hover{color:var(--txt);background:var(--ok-bg);transform:none;box-shadow:none}
  .tab.on{background:var(--pri);color:var(--pri-ink);font-weight:700;box-shadow:0 6px 16px var(--ring)}
  .tab.on:hover{background:var(--pri);color:var(--pri-ink)}
  .tab b{font-family:var(--mono);font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;
         background:var(--idle-bg);color:var(--dim);font-variant-numeric:tabular-nums;transition:background .18s,color .18s}
  .tab.on b{background:rgba(0,0,0,.16);color:var(--pri-ink)}

  .grid{display:grid;gap:18px;grid-template-columns:minmax(0,1fr) clamp(400px,32vw,560px);align-items:start}
  .col{display:grid;gap:18px;min-width:0}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:20px;box-shadow:var(--sh-1)}
  .card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap}
  .card-head h2{margin:0;font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;
                text-transform:uppercase;color:var(--dim);font-weight:600}
  .card-head .meta{font-family:var(--mono);font-size:11.5px;color:var(--dim);font-variant-numeric:tabular-nums}
  .actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
  .actions .err{flex:1 1 100%;margin-top:2px}

  .list table{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px}
  .list td.time{white-space:nowrap;font-variant-numeric:tabular-nums;font-size:12.5px;color:var(--dim)}
  .list th{text-align:left;padding:0 10px 9px;border-bottom:1px solid var(--line);color:var(--dim);
           font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
           font-weight:600;white-space:nowrap}
  .list td{padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
  .list tbody tr{transition:background .16s ease}
  .list tbody tr:hover{background:var(--surface-2)}
  .list tbody tr:last-child td{border-bottom:0}
  .list td:first-child{font-weight:600}
  /* \u5907\u6CE8\uFF1A\u540D\u5B57 + \u4E00\u652F\u5E38\u9A7B\u7684\u94C5\u7B14\uFF0C\u70B9\u54EA\u4E2A\u90FD\u80FD\u5C31\u5730\u6539\u540D */
  .list .lab-wrap{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%}
  /* \u5907\u6CE8\u683C\u91CC\u7684\u7248\u672C\u5C0F\u6807\u4E0D\u8BB8\u6362\u884C\uFF0C\u540D\u5B57\u592A\u957F\u5C31\u7701\u7565\uFF0C\u907F\u514D\u540C\u4E00\u5217\u6709\u7684\u6298\u884C\u6709\u7684\u4E0D\u6298 */
  .list td.labcell{white-space:nowrap}
  .list .lab{cursor:pointer;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
             border-bottom:1px dashed transparent;transition:border-color .15s}
  .list .lab:hover{border-bottom-color:var(--dim)}
  .list .pen{width:26px;height:26px;padding:0;flex:0 0 auto;display:inline-grid;place-items:center;
             border:1px solid var(--line-2);border-radius:9px;background:var(--surface-2);
             color:var(--dim);cursor:pointer;box-shadow:none;
             transition:color .15s,border-color .15s,background .15s}
  .list .pen svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;
                 stroke-linecap:round;stroke-linejoin:round}
  .list .pen:hover,.list .pen:focus-visible{color:var(--pri);border-color:var(--pri);background:var(--surface)}
  .list .lab-edit{font:inherit;font-weight:600;font-size:13.5px;padding:5px 9px;width:auto;min-width:130px;
                  max-width:210px;border:1px solid var(--pri);border-radius:9px;background:var(--surface);
                  color:var(--txt);box-shadow:0 0 0 3px var(--ring);outline:none}
  .list .thint{color:var(--dim);font-size:11.5px;margin:9px 2px 0;opacity:.85}
  .list .num{font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:13px}
  .list .time{font-family:var(--mono);font-size:11.5px;color:var(--dim);white-space:nowrap}
  .list table button{padding:6px 12px;border-radius:10px;font-size:12.5px;box-shadow:none;white-space:nowrap}
  .list td.ops{white-space:nowrap}
  .list td.ops button{padding:5px 9px}
  .list td.ops button + button{margin-left:5px}
  .list table button:hover{color:var(--bad);border-color:var(--bad);background:var(--bad-bg)}

  /* \u7248\u672C\u5C0F\u6807 */
  .list .rgn{display:inline-block;margin-left:7px;padding:1px 7px;border-radius:7px;
       font-size:10.5px;font-weight:600;letter-spacing:.02em;vertical-align:2px;
       background:var(--idle-bg);color:var(--dim)}

  .tag{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;
       font-size:12px;font-weight:600;white-space:nowrap}
  .tag::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex:0 0 auto}
  .t-ok{background:var(--ok-bg);color:var(--ok)}
  .t-warn{background:var(--warn-bg);color:var(--warn)}
  .t-bad{background:var(--bad-bg);color:var(--bad)}
  .t-idle{background:var(--idle-bg);color:var(--idle)}
  .hint{color:var(--dim);font-size:12.5px;margin-top:9px}
  code{font-family:var(--mono);font-size:11.5px;background:var(--idle-bg);color:var(--txt);padding:2px 6px;border-radius:6px}
  .empty{color:var(--dim);text-align:center;padding:26px 16px;font-size:13px}
  .err{color:var(--bad);font-size:13px;margin-top:10px;white-space:pre-wrap}

  /* \u8BBE\u5907\u901A\u884C\u8BC1 */
  .pass-input{width:100%;box-sizing:border-box;margin-top:4px;padding:9px 11px;border:1px solid var(--line-2);
    border-radius:9px;background:var(--surface-2);color:var(--txt);font-family:var(--mono);font-size:11.5px;
    line-height:1.55;resize:vertical;outline:none;transition:border-color .15s,box-shadow .15s}
  .pass-input:focus{border-color:var(--pri);box-shadow:0 0 0 3px var(--ring)}
  .pass-ok{display:flex;align-items:center;gap:8px;margin-top:4px;padding:9px 11px;border-radius:9px;
    background:var(--ok-bg);color:var(--ok);font-size:12.5px;font-family:var(--mono);word-break:break-all}
  .pass-bad{background:var(--warn-bg);color:var(--warn)}
  .pass-help{margin-top:10px;padding:11px 12px;border-radius:9px;background:var(--surface-2);border:1px solid var(--line)}
  .pass-help pre{margin:6px 0 0;font-family:var(--mono);font-size:11px;line-height:1.6;color:var(--txt);
    white-space:pre-wrap;word-break:break-all}
  .pass-steps{margin:10px 0 0;padding-left:18px;font-size:12.5px;color:var(--dim);line-height:1.7}
  .pass-steps li{margin:2px 0}

  @keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  .card,.login-card,.topbar,.tabs{animation:rise .55s cubic-bezier(.22,.9,.28,1) both}
  .col>.card:nth-child(2){animation-delay:.06s}
  .col:nth-child(2)>.card{animation-delay:.12s}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

  @media (max-width:1080px){
    .grid{grid-template-columns:minmax(0,1fr)}
    .topbar{position:static}
  }
  @media (max-width:640px){
    #loginView{min-height:auto;padding:36px 0}
    .topbar .gh{padding:11px 12px}
    .topbar .gh .gh-t{display:none}
    .list table,.list tbody,.list tr,.list td{display:block}
    .list thead{display:none}
    .list tbody{display:grid;gap:10px}
    .list tr{padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--surface-2)}
    .list td{display:flex;align-items:center;justify-content:space-between;gap:14px;
             padding:5px 0;border:0;text-align:right}
    .list td::before{content:attr(data-label);flex:0 0 auto;text-align:left;font-family:var(--mono);
             font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
    .list td:first-child{font-size:15px;padding-bottom:9px;margin-bottom:5px;border-bottom:1px solid var(--line)}
    .list td:first-child::before{display:none}
    .list td.st{flex-wrap:wrap;justify-content:flex-end}
    .list td.st>div{flex:1 1 100%;text-align:right;margin-top:4px}
    .list td:last-child{padding-top:9px}
    .tab{padding:8px 13px;font-size:13px}
  }
  /* ---------- \u901A\u77E5\u8BBE\u7F6E\u5F39\u7A97 ---------- */
  .nv-mask{position:fixed;inset:0;z-index:60;background:rgba(8,15,24,.42);
    display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(3px)}
  .nv-card{width:min(560px,100%);max-height:min(88vh,820px);display:flex;flex-direction:column;
    background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--sh-2);overflow:hidden}
  .nv-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line)}
  .nv-head h3{margin:0;font-size:15px}
  .nv-x{border:0;background:none;font-size:20px;line-height:1;color:var(--dim);padding:4px 8px;box-shadow:none}
  .nv-x:hover{color:var(--txt);transform:none}
  .nv-body{padding:6px 18px 14px;overflow:auto}
  .nv-sec{padding:12px 0;border-bottom:1px dashed var(--line)}
  .nv-sec:last-child{border-bottom:0}
  .nv-h{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;margin-bottom:10px;cursor:pointer}
  .nv-h input{width:15px;height:15px;accent-color:var(--pri);cursor:pointer}
  .nv-row{display:flex;align-items:center;gap:10px;margin-bottom:7px}
  .nv-row>span{width:56px;flex:none;font-size:12.5px;color:var(--dim)}
  .nv-row input,.nv-row select{flex:1;min-width:0;font-size:13px;padding:8px 10px;border-radius:9px;
    border:1px solid var(--line-2);background:var(--surface-2);color:var(--txt);font-family:inherit}
  .nv-row input:focus,.nv-row select:focus{outline:2px solid var(--ring);border-color:var(--pri)}
  .nv-tip{margin:8px 0 0;font-size:11.5px;line-height:1.7;color:var(--dim)}
  .nv-tip code{font-family:var(--mono);font-size:11px;padding:1px 5px;border-radius:5px;background:var(--surface-2)}
  .nv-warn{color:var(--warn)}
  .nv-tip a{color:var(--pri);text-decoration:none}
  .nv-tip a:hover{text-decoration:underline}
  .nv-copy{flex:none;padding:6px 11px;font-size:12px;border-radius:8px;box-shadow:none;white-space:nowrap}
  .nv-cmd{display:flex;align-items:center;gap:8px;margin-top:8px;padding:7px 10px;border-radius:9px;
    background:var(--surface-2);border:1px solid var(--line)}
  .nv-cmd code{flex:1;min-width:0;font-family:var(--mono);font-size:11.5px;color:var(--txt);overflow-x:auto;white-space:nowrap}
  .nv-os{display:inline-flex;gap:2px;margin-top:8px;padding:2px;background:var(--surface-2);
    border:1px solid var(--line);border-radius:8px}
  .nv-os button{padding:4px 12px;border:0;background:none;border-radius:6px;font-size:11.5px;
    color:var(--dim);box-shadow:none}
  .nv-os button:hover{color:var(--pri);transform:none}
  .nv-os button.on{background:var(--surface);color:var(--txt);box-shadow:0 1px 2px rgba(15,23,42,.08)}
  .nv-foot{display:flex;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid var(--line);background:var(--surface-2)}
  .nv-foot button{padding:8px 16px;font-size:13px}
  .nv-msg{flex:1;font-size:12px;color:var(--dim);min-height:16px}

</style>
</head>
<body>
<div class="wrap">

  <div id="loginView">
    <div class="brand">
      <span class="mark"><svg viewBox="0 0 24 24"><path d="M4.5 12.6l4.6 4.6L19.5 6.8"/></svg></span>
      <div>
        <div class="eyebrow">Daily Check-in</div>
        <h1>\u7B7E\u5230\u63A7\u5236\u53F0</h1>
      </div>
    </div>

    <div class="login-card">
      <label class="lbl" for="pwd">\u767B\u5F55\u5BC6\u7801</label>
      <div class="field">
        <input id="pwd" type="password" placeholder="\u8F93\u5165\u767B\u5F55\u5BC6\u7801" autocomplete="current-password">
        <button id="loginbtn" class="pri">\u767B\u5F55</button>
      </div>
      <div class="hint">\u5BC6\u7801\u5373\u540E\u53F0\u7684 <code>ADMIN_TOKEN</code>\u3002\u767B\u5F55\u72B6\u6001\u5B58\u5728\u672C\u673A\u6D4F\u89C8\u5668\uFF0C\u516C\u5171\u7535\u8111\u7528\u5B8C\u8BF7\u70B9\u300C\u9000\u51FA\u767B\u5F55\u300D\u3002</div>
      <div class="err" id="loginErr"></div>
    </div>
  </div>

  <div id="mainView" hidden>
    <header class="topbar">
      <div class="brand">
        <span class="mark"><svg viewBox="0 0 24 24"><path d="M4.5 12.6l4.6 4.6L19.5 6.8"/></svg></span>
        <div>
          <div class="eyebrow">Daily Check-in <span class="ver">${BUILD}</span></div>
          <h1>\u7B7E\u5230\u63A7\u5236\u53F0</h1>
        </div>
      </div>
      <div class="row">
        <span class="chip"><i class="dot"></i>\u4ECA\u65E5\u5DF2\u7B7E <b id="statAll">\u2014</b></span>
        <a class="gh" href="https://github.com/ggzhzc/workbuddy-trae-checkin" target="_blank" rel="noopener noreferrer" title="GitHub \u4ED3\u5E93 \xB7 ggzhzc/workbuddy-trae-checkin" aria-label="GitHub \u4ED3\u5E93">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5C5.73.5.9 5.34.9 11.6c0 4.91 3.17 9.07 7.57 10.53.55.1.75-.24.75-.53 0-.26-.01-1.13-.02-2.05-3.08.67-3.73-1.31-3.73-1.31-.5-1.28-1.23-1.62-1.23-1.62-1-.69.08-.67.08-.67 1.11.08 1.7 1.14 1.7 1.14.98 1.69 2.58 1.2 3.21.92.1-.72.39-1.21.7-1.48-2.46-.28-5.05-1.23-5.05-5.48 0-1.21.43-2.2 1.14-2.98-.12-.28-.5-1.41.11-2.94 0 0 .93-.3 3.05 1.14a10.5 10.5 0 0 1 5.56 0c2.11-1.44 3.04-1.14 3.04-1.14.61 1.53.23 2.66.11 2.94.71.78 1.14 1.77 1.14 2.98 0 4.26-2.6 5.19-5.07 5.47.4.34.75 1.01.75 2.04 0 1.48-.01 2.68-.01 3.04 0 .29.19.64.76.53 4.4-1.46 7.56-5.62 7.56-10.53C23.1 5.34 18.27.5 12 .5z"/></svg>
          <span class="gh-t">GitHub</span>
        </a>
        <button id="runAll" class="pri">\u5168\u90E8\u7B7E\u5230</button>
        <button id="notifyOpen" title="\u914D\u7F6E\u7B7E\u5230\u7ED3\u679C\u901A\u77E5">\u901A\u77E5</button>
        <button id="logout">\u9000\u51FA\u767B\u5F55</button>
      </div>
    </header>

    <nav class="tabs">
      <button class="tab on" data-tab="trae">Trae <b id="cntTrae">0</b></button>
      <button class="tab" data-tab="wb">WorkBuddy <b id="cntWb">0</b></button>
      <button class="tab" data-tab="qoder">Qoder <b id="cntQoder">0</b></button>
    </nav>

    <section class="panel" id="panel-trae">
      <div class="grid">
        <div class="col">
          <div class="card actions">
            <button class="pri" data-run="trae">\u7ACB\u5373\u7B7E\u5230</button>
            <button data-refresh="trae">\u5237\u65B0</button>
            <div class="err" id="err-trae"></div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Trae \u8D26\u53F7</h2><span class="meta" id="lastRun-trae">\u2014</span></div>
            <div class="list" id="list-trae"><div class="empty">\u52A0\u8F7D\u4E2D\u2026</div></div>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <div class="card-head"><h2>\u626B\u7801\u767B\u5F55 \xB7 Trae</h2></div>
            <div class="row">
              <button class="pri" id="traeQr">\u6DFB\u52A0\u8D26\u53F7</button>
            </div>
            <div class="hint" id="traeQrStatus">\u70B9\u6309\u94AE\u6253\u5F00\u5B98\u65B9\u767B\u5F55\u9875\uFF0C\u7528\u6296\u97F3\u626B\u7801\u3002\u767B\u5F55\u5B8C\u6210\u540E\u6D4F\u89C8\u5668\u4F1A\u505C\u5728\u4E00\u4E2A\u6253\u4E0D\u5F00\u7684\u672C\u5730\u9875\u9762\uFF0C\u628A\u5730\u5740\u680F\u91CC\u7684\u6574\u6BB5\u94FE\u63A5\u590D\u5236\u8FC7\u6765\u5373\u53EF\u3002</div>
            <div id="traeQrFallback" style="margin-top:10px">
              <input id="traeQrUrl" placeholder="\u7C98\u8D34\u767B\u5F55\u540E\u5730\u5740\u680F\u7684\u6574\u6BB5\u94FE\u63A5\uFF08127.0.0.1:17388/\u2026\uFF09">
              <div class="row" style="margin-top:8px">
                <button id="traeQrClaim">\u7ED1\u5B9A\u8D26\u53F7</button>
              </div>
              <div class="err" id="traeQrErr"></div>
            </div>
            <div class="hint">\u626B\u7801\u8D70\u5B98\u7F51\u6296\u97F3\u6388\u6743\uFF0C\u8BBE\u5907\u5BC6\u94A5\u7531\u672C\u670D\u52A1\u73B0\u573A\u751F\u6210\u5E76\u52A0\u5BC6\u4FDD\u5B58\u3002\u5168\u7A0B\u65E0\u9700\u5728\u672C\u673A\u5B89\u88C5\u6216\u8FD0\u884C\u4EFB\u4F55\u4E1C\u897F\u3002</div>
          </div>
        </div>
      </div>
    </section>

    <section class="panel" id="panel-wb" hidden>
      <div class="grid">
        <div class="col">
          <div class="card actions">
            <button class="pri" data-run="wb">\u7ACB\u5373\u7B7E\u5230</button>
            <button data-refresh="wb">\u5237\u65B0</button>
            <div class="err" id="err-wb"></div>
          </div>
          <div class="card">
            <div class="card-head"><h2>WorkBuddy \u8D26\u53F7</h2><span class="meta" id="lastRun-wb">\u2014</span></div>
            <div class="list" id="list-wb"><div class="empty">\u52A0\u8F7D\u4E2D\u2026</div></div>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <div class="card-head"><h2>\u626B\u7801\u767B\u5F55 \xB7 WorkBuddy</h2></div>
            <div class="row">
              <button class="pri" id="wbQr">\u6DFB\u52A0\u8D26\u53F7</button>
            </div>
            <div class="hint" id="wbQrStatus">\u70B9\u6309\u94AE\u5728\u65B0\u7A97\u53E3\u6253\u5F00\u5B98\u65B9\u767B\u5F55\u9875\uFF0C\u7528\u5FAE\u4FE1\u626B\u7801\u5E76\u786E\u8BA4\uFF0C\u8D26\u53F7\u4F1A\u81EA\u52A8\u4FDD\u5B58\u3002</div>
            <div class="hint">\u4E8C\u7EF4\u7801\u7531\u5B98\u65B9\u767B\u5F55\u9875\u6E32\u67D3\uFF0C\u672C\u670D\u52A1\u4E0D\u63A5\u89E6\u4F60\u7684\u5FAE\u4FE1\u4FE1\u606F\u3002</div>
          </div>
        </div>
      </div>
    </section>

    <section class="panel" id="panel-qoder" hidden>
      <div class="grid">
        <div class="col">
          <div class="card actions">
            <button class="pri" data-run="qoder">\u7ACB\u5373\u7B7E\u5230</button>
            <button data-refresh="qoder">\u5237\u65B0</button>
            <div class="err" id="err-qoder"></div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Qoder \u8D26\u53F7</h2><span class="meta" id="lastRun-qoder">\u2014</span></div>
            <div class="list" id="list-qoder"><div class="empty">\u52A0\u8F7D\u4E2D\u2026</div></div>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <div class="card-head"><h2>\u6DFB\u52A0\u8D26\u53F7 \xB7 Qoder</h2></div>
            <div class="row">
              <button class="pri" id="qoderAddCn">\u6DFB\u52A0\u8D26\u53F7\uFF08\u56FD\u5185\u7248\uFF09</button>
            </div>
            <div class="hint" id="qoderQrStatus">\u70B9\u6309\u94AE\u5728\u65B0\u7A97\u53E3\u6253\u5F00\u5B98\u65B9\u6388\u6743\u9875\uFF0C\u7528\u8981\u7B7E\u5230\u7684\u8D26\u53F7\u786E\u8BA4\u4E00\u6B21\uFF0C\u8D26\u53F7\u4F1A\u81EA\u52A8\u4FDD\u5B58\u3002</div>

          </div>

        </div>
      </div>
    </section>
  </div>

</div>
<script>
var $ = function(s){ return document.querySelector(s); };
var PWD_KEY = 'signin-admin-pwd';
var state = { tok:'', tab:'trae', data:{ trae:null, wb:null, qoder:null } };

function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
}); }
function fmt(n){ return n==null||n==='' ? '\u2014' : String(n); }

/* \u72B6\u6001\u7531\u670D\u52A1\u7AEF\u6309\u5F53\u5929\u5224\u5B9A\uFF08signedToday / ranToday\uFF09\uFF0C\u524D\u7AEF\u4E0D\u81EA\u884C\u63A8\u6D4B */
function bjToday(){
  return new Date(Date.now() + 8*3600e3).toISOString().slice(0,10);
}
function bjHour(){
  return new Date(Date.now() + 8*3600e3).getUTCHours();
}

function tagTrae(a, now){
  if(a.signedToday) return '<span class="tag t-ok">\u5DF2\u7B7E</span>';
  if(a.cooldownUntil && a.cooldownUntil > now){
    return '<span class="tag t-warn">\u9650\u6D41 ' + Math.ceil((a.cooldownUntil-now)/60000) + ' \u5206\u949F</span>';
  }
  if(a.lastState==='token_dead') return '<span class="tag t-bad">\u4EE4\u724C\u5931\u6548</span>';
  if(a.lastState==='pending' && a.ranToday) return '<span class="tag t-warn">\u5F85\u786E\u8BA4</span>';
  if(a.lastState==='error' && a.ranToday) return '<span class="tag t-bad">\u7B7E\u5230\u5931\u8D25</span>';
  if(!a.hasKeys) return '<span class="tag t-warn">\u7F3A\u8BBE\u5907\u5BC6\u94A5</span>';
  return '<span class="tag t-idle">\u4ECA\u65E5\u672A\u7B7E</span>';
}
function msgTrae(a){
  if(a.signedToday) return a.lastState==='checked' ? (a.lastMsg||'') : '';
  if(a.lastState==='token_dead') return a.lastMsg || '';
  if(a.lastState==='pending' && a.ranToday) return a.lastMsg || '';
  if(a.lastState==='error' && a.ranToday) return a.lastMsg || '';
  return '';
}

function tagWb(a){
  if(a.signedToday) return '<span class="tag t-ok">\u5DF2\u7B7E</span>';
  if(a.lastState==='token_dead') return '<span class="tag t-bad">\u4EE4\u724C\u5931\u6548</span>';
  if(a.lastState==='error' && a.ranToday) return '<span class="tag t-bad">\u7B7E\u5230\u5931\u8D25</span>';
  return '<span class="tag t-idle">\u4ECA\u65E5\u672A\u7B7E</span>';
}
function msgWb(a){
  if(a.signedToday) return a.lastState==='checked' ? (a.lastMsg||'') : '';
  if(a.lastState==='token_dead') return a.lastMsg || '';
  if(a.lastState==='error' && a.ranToday) return a.lastMsg || '';
  return '';
}

function tagQoder(a, now){
  if(a.signedToday) return '<span class="tag t-ok">\u5DF2\u7B7E</span>';
  if(a.cooldownUntil && a.cooldownUntil > now){
    return '<span class="tag t-warn">\u9650\u6D41 ' + Math.ceil((a.cooldownUntil-now)/60000) + ' \u5206\u949F</span>';
  }
  if(a.lastState==='token_dead') return '<span class="tag t-bad">\u4EE4\u724C\u5931\u6548</span>';
  if(a.lastState==='pending' && a.ranToday) return '<span class="tag t-warn">\u5F85\u786E\u8BA4</span>';
  if(a.lastState==='error' && a.ranToday) return '<span class="tag t-bad">\u7B7E\u5230\u5931\u8D25</span>';
  if(a.lastState==='wait' && a.ranToday){
    return '<span class="tag t-idle">\u65E0\u53EF\u9886</span>';
  }
  return '<span class="tag t-idle">\u4ECA\u65E5\u672A\u7B7E</span>';
}
function msgQoder(a){
  if(a.signedToday) return a.lastMsg || '';
  if(a.lastState==='token_dead' || a.lastState==='error' || a.lastState==='pending' || a.lastState==='wait'){
    return a.lastMsg || '';
  }
  return '';
}

function api(path, opts){
  opts = opts || {};
  return fetch(path, {
    method: opts.method || 'GET',
    body: opts.body,
    headers: { 'Content-Type':'application/json', 'X-Admin-Token': state.tok }
  }).then(function(res){
    return res.json().catch(function(){ return { error:'\u54CD\u5E94\u65E0\u6CD5\u89E3\u6790' }; }).then(function(data){
      if(res.status === 401){
        var msg = data.error || '\u767B\u5F55\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55';
        logout(msg);
        throw new Error(msg);
      }
      if(!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      return data;
    });
  });
}

function setLoginErr(m){ $('#loginErr').textContent = m ? String(m) : ''; }
function showErr(p, e){ $('#err-' + p).textContent = e ? String(e.message || e) : ''; }

/* ---------------- \u767B\u5F55 / \u767B\u51FA ---------------- */

function login(password){
  var v = String(password==null?'':password).trim();
  if(!v){ setLoginErr('\u8BF7\u8F93\u5165\u767B\u5F55\u5BC6\u7801'); return; }
  var btn = $('#loginbtn');
  btn.disabled = true; btn.textContent = '\u767B\u5F55\u4E2D\u2026';
  return fetch('/api/ping', { headers: { 'X-Admin-Token': v } })
    .then(function(res){
      return res.json().catch(function(){ return { error:'\u54CD\u5E94\u65E0\u6CD5\u89E3\u6790' }; }).then(function(d){
        if(!res.ok) throw new Error(d.error || ('HTTP ' + res.status));
        state.tok = v;
        localStorage.setItem(PWD_KEY, v);
        setLoginErr('');
        $('#loginView').hidden = true;
        $('#mainView').hidden = false;
        loadAll();
      });
    })
    .catch(function(e){ setLoginErr(e.message || e); })
    .then(function(){ btn.disabled = false; btn.textContent = '\u767B\u5F55'; });
}

function logout(msg){
  stopWbQr(); stopQoderQr();
  state.tok = '';
  state.data = { trae:null, wb:null, qoder:null };
  localStorage.removeItem(PWD_KEY);
  $('#pwd').value = '';
  $('#list-trae').innerHTML = '<div class="empty">\u52A0\u8F7D\u4E2D\u2026</div>';
  $('#list-wb').innerHTML = '<div class="empty">\u52A0\u8F7D\u4E2D\u2026</div>';
  $('#list-qoder').innerHTML = '<div class="empty">\u52A0\u8F7D\u4E2D\u2026</div>';
  $('#statAll').textContent = '\u2014';
  showErr('trae',''); showErr('wb',''); showErr('qoder','');
  setLoginErr(msg || '');
  $('#mainView').hidden = true;
  $('#loginView').hidden = false;
}

/* ---------------- \u5217\u8868\u6E32\u67D3 ---------------- */

function lastRunOf(list){
  var times = list.map(function(a){ return a.lastRun; }).filter(Boolean).sort();
  return times.length ? times[times.length-1].replace('T',' ').slice(0,16) : (list.length ? '\u6682\u65E0\u8BB0\u5F55' : '\u6682\u65E0\u8D26\u53F7');
}

function renderTrae(d){
  var box = $('#list-trae'), now = Date.now();
  state.data.trae = d;
  $('#lastRun-trae').textContent = lastRunOf(d.accounts);
  $('#cntTrae').textContent = d.accounts.filter(function(a){ return a.signedToday; }).length + '/' + d.accounts.length;
  if(!d.accounts.length){ box.innerHTML = '<div class="empty">\u8FD8\u6CA1\u6709\u8D26\u53F7\uFF0C\u53F3\u4FA7\u626B\u7801\u6DFB\u52A0</div>'; return; }
  box.innerHTML = '<table><thead><tr><th>\u5907\u6CE8</th><th>\u72B6\u6001</th><th>\u672C\u6B21</th><th>\u4F59\u989D</th><th>\u4E0A\u6B21\u8FD0\u884C</th><th></th></tr></thead><tbody>'
    + d.accounts.map(function(a){
        var m = msgTrae(a);
        var gain = (a.lastState==='checked' && a.lastCredit!=null) ? '+' + a.lastCredit : '\u2014';
        return '<tr>'
          + '<td class="labcell" data-label="\u5907\u6CE8">' + labCellHtml('trae', a.id, a.label) + '</td>'
          + '<td class="st" data-label="\u72B6\u6001">' + tagTrae(a, now)
            + (m ? '<div class="hint" style="margin:2px 0 0">' + esc(m) + '</div>' : '') + '</td>'
          + '<td class="num" data-label="\u672C\u6B21">' + gain + '</td>'
          + '<td class="num" data-label="\u4F59\u989D">' + fmt(a.credits) + '</td>'
          + '<td class="time" data-label="\u4E0A\u6B21\u8FD0\u884C">' + (a.lastRun ? esc(a.lastRun.replace('T',' ').slice(5,16)) : '\u2014') + '</td>'
          + '<td data-label="\u64CD\u4F5C"><button data-del="trae|' + esc(a.id) + '">\u5220\u9664</button></td>'
          + '</tr>';
      }).join('') + '</tbody></table>'
    + '<div class="thint">\u70B9\u8D26\u53F7\u540D\u6216\u53F3\u8FB9\u7684\u94C5\u7B14\uFF0C\u53EF\u4EE5\u6539\u5907\u6CE8</div>';
  bindDel();
}

function renderWb(d){
  var box = $('#list-wb');
  var today = bjToday();
  // WorkBuddy \u7684\u5217\u8868\u63A5\u53E3\u53EA\u8FD4\u56DE lastOkDate / lastRun\uFF0C\u8FD9\u91CC\u6309\u5F53\u5929\u73B0\u7B97\u4ECA\u65E5\u72B6\u6001
  d.accounts.forEach(function(a){
    a.signedToday = a.lastOkDate === today;
    a.ranToday = !!a.lastRun && a.lastRun.slice(0,10) === today;
  });
  state.data.wb = d;
  $('#lastRun-wb').textContent = lastRunOf(d.accounts);
  $('#cntWb').textContent = d.accounts.filter(function(a){ return a.signedToday; }).length + '/' + d.accounts.length;
  if(!d.accounts.length){ box.innerHTML = '<div class="empty">\u8FD8\u6CA1\u6709\u8D26\u53F7\uFF0C\u53F3\u4FA7\u626B\u7801\u6DFB\u52A0</div>'; return; }
  box.innerHTML = '<table><thead><tr><th>\u5907\u6CE8</th><th>\u72B6\u6001</th><th>\u8FDE\u7B7E</th><th>\u672C\u671F</th><th>\u4E0A\u6B21\u8FD0\u884C</th><th></th></tr></thead><tbody>'
    + d.accounts.map(function(a){
        var m = msgWb(a);
        return '<tr>'
          + '<td class="labcell" data-label="\u5907\u6CE8">' + labCellHtml('wb', a.id, a.label) + '</td>'
          + '<td class="st" data-label="\u72B6\u6001">' + tagWb(a)
            + (m ? '<div class="hint" style="margin:2px 0 0">' + esc(m) + '</div>' : '') + '</td>'
          + '<td class="num" data-label="\u8FDE\u7B7E">' + (a.streak==null ? '\u2014' : a.streak + ' \u5929') + '</td>'
          + '<td class="num" data-label="\u672C\u671F">' + fmt(a.total) + '</td>'
          + '<td class="time" data-label="\u4E0A\u6B21\u8FD0\u884C">' + (a.lastRun ? esc(a.lastRun.replace('T',' ').slice(5,16)) : '\u2014') + '</td>'
          + '<td data-label="\u64CD\u4F5C"><button data-del="wb|' + esc(a.id) + '">\u5220\u9664</button></td>'
          + '</tr>';
      }).join('') + '</tbody></table>'
    + '<div class="thint">\u70B9\u8D26\u53F7\u540D\u6216\u53F3\u8FB9\u7684\u94C5\u7B14\uFF0C\u53EF\u4EE5\u6539\u5907\u6CE8</div>';
  bindDel();
}

function renderQoder(d){
  var box = $('#list-qoder'), now = Date.now();
  state.data.qoder = d;
  $('#lastRun-qoder').textContent = lastRunOf(d.accounts);
  $('#cntQoder').textContent = d.accounts.filter(function(a){ return a.signedToday; }).length + '/' + d.accounts.length;
  if(!d.accounts.length){ box.innerHTML = '<div class="empty">\u8FD8\u6CA1\u6709\u8D26\u53F7\uFF0C\u70B9\u53F3\u4FA7\u300C\u6DFB\u52A0\u8D26\u53F7\uFF08\u56FD\u5185\u7248\uFF09\u300D</div>'; return; }
  var warn = '';
  box.innerHTML = warn
    + '<table><thead><tr><th>\u5907\u6CE8</th><th>\u72B6\u6001</th><th>\u672C\u6B21</th><th>\u7D2F\u8BA1</th><th>\u4E0A\u6B21\u8FD0\u884C</th><th></th></tr></thead><tbody>'
    + d.accounts.map(function(a){
        var m = msgQoder(a);
        var gain = (a.lastState==='checked' && a.lastCredit!=null) ? '+' + a.lastCredit : '\u2014';
        var rgn = '<span class="rgn" title="\u56FD\u5185\u7248 qoder.com.cn">\u56FD\u5185\u7248</span>';
        return '<tr>'
          + '<td class="labcell" data-label="\u5907\u6CE8">' + labCellHtml('qoder', a.id, a.label, rgn) + '</td>'
          + '<td class="st" data-label="\u72B6\u6001">' + tagQoder(a, now)
            + (m ? '<div class="hint" style="margin:2px 0 0">' + esc(m) + '</div>' : '') + '</td>'
          + '<td class="num" data-label="\u672C\u6B21">' + gain + '</td>'
          + '<td class="num" data-label="\u7D2F\u8BA1">' + fmt(a.totalCredit) + '</td>'
          + '<td class="time" data-label="\u4E0A\u6B21\u8FD0\u884C">' + (a.lastRun ? esc(a.lastRun.replace('T',' ').slice(5,16)) : '\u2014') + '</td>'
          + '<td data-label="\u64CD\u4F5C" class="ops">'
            + '<button data-del="qoder|' + esc(a.id) + '">\u5220\u9664</button></td>'
          + '</tr>';
      }).join('') + '</tbody></table>'
    + '<div class="thint">\u70B9\u8D26\u53F7\u540D\u6216\u53F3\u8FB9\u7684\u94C5\u7B14\uFF0C\u53EF\u4EE5\u6539\u5907\u6CE8</div>';
  bindDel();
}



/* \u5907\u6CE8\u5355\u5143\u683C\uFF1A\u540D\u5B57 + \u5E38\u9A7B\u94C5\u7B14\uFF0C\u70B9\u54EA\u4E2A\u90FD\u80FD\u5C31\u5730\u6539\u540D\uFF1Bextra \u7528\u6765\u63D2\u7248\u672C\u5C0F\u6807 */
function labCellHtml(p, id, label, extra){
  var k = 'data-rename="' + p + '|' + esc(id) + '" data-name="' + esc(label) + '"';
  return '<span class="lab-wrap">'
    + '<span class="lab" ' + k + ' title="\u70B9\u51FB\u4FEE\u6539\u5907\u6CE8">' + esc(label) + '</span>'
    + (extra || '')
    + '<button class="pen" type="button" ' + k + ' title="\u4FEE\u6539\u5907\u6CE8" aria-label="\u4FEE\u6539\u5907\u6CE8">'
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h3.6L19 8.6a2.2 2.2 0 0 0-3.1-3.1L4.5 16.9V20z"/></svg>'
    + '</button></span>';
}

/* \u5C31\u5730\u6539\u540D\uFF1A\u628A\u5355\u5143\u683C\u6362\u6210\u8F93\u5165\u6846\uFF0C\u56DE\u8F66/\u5931\u7126\u4FDD\u5B58\uFF0CEsc \u653E\u5F03 */
function startRename(el){
  var td = el.closest('td');
  if(!td || td.querySelector('.lab-edit')) return;
  var parts = el.dataset.rename.split('|');
  var p = parts[0], id = parts[1], old = el.dataset.name || '';
  var chip = td.querySelector('.rgn');            // \u53D6\u6D88\u7F16\u8F91\u65F6\u8981\u628A\u7248\u672C\u5C0F\u6807\u8FD8\u539F\u56DE\u53BB
  var extra = chip ? chip.outerHTML : '';
  td.innerHTML = '<input class="lab-edit" maxlength="40" aria-label="\u5907\u6CE8" ' +
                 'title="\u56DE\u8F66\u4FDD\u5B58\uFF0CEsc \u53D6\u6D88" value="' + esc(old) + '">';
  var input = td.querySelector('.lab-edit');
  input.focus();
  input.select();

  var done = false;
  function restore(){ td.innerHTML = labCellHtml(p, id, old, extra); bindDel(); }
  function finish(save){
    if(done) return;
    done = true;
    var v = input.value.trim();
    if(!save || !v || v === old){ restore(); return; }
    input.disabled = true;
    var url = API_URL.rename[p];
    api(url, { method:'POST', body: JSON.stringify({ id:id, label:v }) })
      .then(function(){ return load(p); })
      .catch(function(e){ showErr(p, e); restore(); });
  }
  input.addEventListener('keydown', function(ev){
    if(ev.key === 'Enter'){ ev.preventDefault(); finish(true); }
    else if(ev.key === 'Escape'){ ev.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', function(){ finish(true); });
}

function bindDel(){
  document.querySelectorAll('[data-del]').forEach(function(b){
    b.onclick = function(){
      var parts = b.dataset.del.split('|');
      var p = parts[0], id = parts[1];
      if(!confirm('\u5220\u9664\u8FD9\u4E2A\u8D26\u53F7\uFF1F')) return;
      var url = API_URL.remove[p];
      api(url, { method:'POST', body: JSON.stringify({ id:id }) })
        .then(function(){ return load(p); })
        .catch(function(e){ showErr(p, e); });
    };
  });

  document.querySelectorAll('[data-rename]').forEach(function(el){
    el.onclick = function(ev){ ev.stopPropagation(); startRename(el); };
  });
}

function renderStat(){
  var loaded = ['trae','wb','qoder'].filter(function(k){ return state.data[k]; });
  if(!loaded.length){ $('#statAll').textContent = '\u2014'; return; }
  var all = [];
  loaded.forEach(function(k){ all = all.concat(state.data[k].accounts || []); });
  var signed = all.filter(function(a){ return a.signedToday; }).length;
  $('#statAll').textContent = signed + ' / ' + all.length;
}

/* ---------------- \u52A0\u8F7D\u4E0E\u7B7E\u5230 ---------------- */

var API_URL = {
  list:  { trae:'/trae/api/list', wb:'/wb/api/list', qoder:'/qoder/api/list' },
  run:   { trae:'/trae/api/run?force=1', wb:'/wb/api/run?force=1', qoder:'/qoder/api/run?force=1' },
  rename:{ trae:'/trae/api/rename', wb:'/wb/api/rename', qoder:'/qoder/api/rename' },
  remove:{ trae:'/trae/api/accounts/remove', wb:'/wb/api/remove', qoder:'/qoder/api/remove' },
  name:  { trae:'Trae', wb:'WorkBuddy', qoder:'Qoder' }
};

function load(p){
  return api(API_URL.list[p])
    .then(function(d){
      if(p === 'trae') renderTrae(d);
      else if(p === 'wb') renderWb(d);
      else renderQoder(d);
      renderStat();
    })
    .catch(function(e){ showErr(p, e); renderStat(); });
}

function loadAll(){
  return Promise.all([load('trae'), load('wb'), load('qoder')]);
}

function runOne(p){
  var btns = document.querySelectorAll('[data-run="' + p + '"]');
  btns.forEach(function(b){ b.disabled = true; b.textContent = '\u7B7E\u5230\u4E2D\u2026'; });
  showErr(p, '');
  return api(API_URL.run[p], { method:'POST', body:'{}' })
    .then(function(d){
      var bad = (d.results || []).filter(function(r){ return r.state==='error' || r.state==='token_dead'; });
      if(bad.length) showErr(p, bad.map(function(r){ return r.label + ': ' + r.msg; }).join('\\n'));
      return load(p);
    })
    .catch(function(e){ showErr(p, e); })
    .then(function(){
      btns.forEach(function(b){ b.disabled = false; b.textContent = '\u7ACB\u5373\u7B7E\u5230'; });
    });
}

function runAll(){
  var btn = $('#runAll');
  btn.disabled = true; btn.textContent = '\u7B7E\u5230\u4E2D\u2026';
  showErr('trae',''); showErr('wb','');
  api('/api/run-all?force=1', { method:'POST', body:'{}' })
    .then(function(d){
      var lines = [];
      ['trae','wb','qoder'].forEach(function(k){
        var r = d[k] || {};
        if(r.error){ lines.push(API_URL.name[k] + ': ' + r.error); return; }
        (r.results || []).forEach(function(x){
          if(x.state==='error' || x.state==='token_dead') lines.push(x.label + ': ' + x.msg);
        });
      });
      if(lines.length){
        showErr('trae', lines.join('\\n'));
      }
      return loadAll();
    })
    .catch(function(e){ showErr('trae', e); })
    .then(function(){ btn.disabled = false; btn.textContent = '\u5168\u90E8\u7B7E\u5230'; });
}

/* ---------------- \u6807\u7B7E\u9875 ---------------- */

document.querySelectorAll('.tab').forEach(function(t){
  t.onclick = function(){
    var p = t.dataset.tab;
    state.tab = p;
    document.querySelectorAll('.tab').forEach(function(x){ x.classList.toggle('on', x === t); });
    ['trae','wb','qoder'].forEach(function(k){ $('#panel-' + k).hidden = p !== k; });
  };
});

/* ---------------- Trae \u626B\u7801\u767B\u5F55 ---------------- */

function startTraeQr(){
  var btn = $('#traeQr');
  var old = btn.textContent;
  btn.disabled = true; btn.textContent = '\u51C6\u5907\u4E2D\u2026';
  $('#traeQrErr').textContent = '';
  return api('/trae/api/login/start', { method:'POST', body: '{}' })
    .then(function(d){
      var w = window.open(d.authUrl, 'trae-login', 'width=520,height=820');
      if(!w){
        $('#traeQrStatus').innerHTML = '\u65B0\u7A97\u53E3\u88AB\u62E6\u622A\u4E86\uFF1A<a href="' + esc(d.authUrl) + '" target="_blank" rel="noopener">\u70B9\u8FD9\u91CC\u6253\u5F00\u767B\u5F55\u9875</a>';
      }else{
        $('#traeQrStatus').textContent = '\u5DF2\u6253\u5F00\u767B\u5F55\u9875\uFF1A\u626B\u7801\u767B\u5F55\uFF0C\u9875\u9762\u8DF3\u5230\u4E00\u4E2A\u6253\u4E0D\u5F00\u7684 127.0.0.1 \u5730\u5740\u540E\uFF0C\u590D\u5236\u5730\u5740\u680F\u7684\u6574\u6BB5\u94FE\u63A5\u7C98\u5230\u4E0B\u9762\u3002';
        /* \u767B\u5F55\u5B8C\u6210\u540E\u5F39\u7A97\u5C31\u4F1A\u88AB\u5173\u6389\uFF0C\u8FD9\u65F6\u628A\u5149\u6807\u9001\u5230\u8F93\u5165\u6846 */
        var watch = setInterval(function(){
          if(!w || w.closed){ clearInterval(watch); $('#traeQrUrl').focus(); }
        }, 1200);
      }
    })
    .catch(function(e){ $('#traeQrStatus').textContent = String(e.message || e); })
    .then(function(){ btn.disabled = false; btn.textContent = old; });
}

/** \u628A\u7C98\u8D34\u8FDB\u6765\u7684\u6388\u6743\u94FE\u63A5\u4EA4\u7ED9\u540E\u7AEF\u6362\u53D6\u4EE4\u724C\u5E76\u7ED1\u5B9A\u8D26\u53F7 */
function claimTrae(){
  var btn = $('#traeQrClaim');
  var url = $('#traeQrUrl').value.trim();
  if(!url || btn.disabled) return;
  $('#traeQrErr').textContent = '';
  btn.disabled = true; btn.textContent = '\u7ED1\u5B9A\u4E2D\u2026';
  api('/trae/api/login/claim', { method:'POST', body: JSON.stringify({ url: url }) })
    .then(function(d){
      $('#traeQrStatus').textContent = '\u767B\u5F55\u6210\u529F\uFF0C\u5DF2\u4FDD\u5B58\u4E3A\u300C' + d.label + '\u300D';
      $('#traeQrUrl').value = '';
      return load('trae');
    })
    .catch(function(e){ $('#traeQrErr').textContent = String(e.message || e); })
    .then(function(){ btn.disabled = false; btn.textContent = '\u7ED1\u5B9A\u8D26\u53F7'; });
}

$('#traeQr').onclick = startTraeQr;

$('#traeQrClaim').onclick = claimTrae;

/* \u7C98\u4E0A\u5C31\u76F4\u63A5\u7ED1\u5B9A\uFF0C\u7701\u6389\u518D\u70B9\u4E00\u6B21\u6309\u94AE */
$('#traeQrUrl').addEventListener('paste', function(){
  setTimeout(function(){ if($('#traeQrUrl').value.trim()) claimTrae(); }, 0);
});

/* \u56DE\u8C03\u9875\u82E5\u4E0E\u672C\u63A7\u5236\u53F0\u540C\u6E90\uFF0C\u5B50\u7A97\u53E3\u4F1A\u76F4\u63A5\u901A\u77E5\u8FD9\u91CC */
window.addEventListener('message', function(e){
  if(e.origin !== location.origin) return;
  var d = e.data || {};
  if(d.type !== 'trae-login') return;
  if(d.ok){
    $('#traeQrStatus').textContent = '\u767B\u5F55\u6210\u529F\uFF0C\u5DF2\u4FDD\u5B58\u4E3A\u300C' + (d.label || '') + '\u300D';
    load('trae');
  }else{
    $('#traeQrStatus').textContent = '\u767B\u5F55\u672A\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5';
  }
});

/* ---------------- WorkBuddy \u626B\u7801\u767B\u5F55 ---------------- */

var wbState = '', wbTimer = null;
function stopWbQr(){ if(wbTimer){ clearInterval(wbTimer); wbTimer = null; } }

$('#wbQr').onclick = function(){
  stopWbQr();
  var btn = $('#wbQr');
  btn.disabled = true; btn.textContent = '\u83B7\u53D6\u4E2D\u2026';
  showErr('wb', '');

  /* \u5148\u540C\u6B65\u5F00\u4E00\u4E2A\u7A7A\u7A97\u53E3\uFF1A\u5B98\u65B9\u767B\u5F55\u9875\u7981\u6B62\u88AB\u5185\u5D4C\uFF0C\u53EA\u80FD\u6574\u9875\u6253\u5F00\uFF1B
     \u53C8\u56E0\u4E3A\u540E\u9762\u8981\u7B49\u63A5\u53E3\u8FD4\u56DE\uFF0C\u5F02\u6B65\u91CC\u518D\u5F00\u7A97\u4F1A\u88AB\u5F39\u7A97\u62E6\u622A */
  var win = window.open('about:blank', 'wb-login', 'width=640,height=880');

  api('/wb/api/login/start', { method:'POST', body:'{}' })
    .then(function(d){
      wbState = d.state;
      var opened = false;
      if(win && !win.closed){
        try { win.location.href = d.authUrl; opened = true; } catch(e) { opened = false; }
      }
      if(opened){
        $('#wbQrStatus').textContent = '\u5DF2\u5728\u65B0\u7A97\u53E3\u6253\u5F00\u767B\u5F55\u9875\uFF0C\u7528\u5FAE\u4FE1\u626B\u7801\u5E76\u786E\u8BA4\uFF0C\u672C\u9875\u4F1A\u81EA\u52A8\u4FDD\u5B58\u8D26\u53F7\u3002';
      }else{
        $('#wbQrStatus').innerHTML = '\u65B0\u7A97\u53E3\u88AB\u62E6\u622A\u4E86\uFF1A'
          + '<a href="' + esc(d.authUrl) + '" target="_blank" rel="noopener">\u70B9\u8FD9\u91CC\u6253\u5F00\u767B\u5F55\u9875</a>';
      }
      btn.textContent = '\u6DFB\u52A0\u8D26\u53F7';
      btn.disabled = false;

      var n = 0;
      wbTimer = setInterval(function(){
        if(n++ > 150){
          stopWbQr();
          $('#wbQrStatus').textContent = '\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u70B9\u300C\u6DFB\u52A0\u8D26\u53F7\u300D\u91CD\u8BD5';
          return;
        }
        api('/wb/api/login/poll?state=' + encodeURIComponent(wbState)).then(function(r){
          if(r.status === 'ok'){
            stopWbQr();
            if(win && !win.closed){ try { win.close(); } catch(e){} }
            $('#wbQrStatus').textContent = '\u767B\u5F55\u6210\u529F\uFF0C\u5DF2\u4FDD\u5B58\u4E3A\u300C' + r.label + '\u300D';
            load('wb');
          }
        }).catch(function(e){
          stopWbQr();
          $('#wbQrStatus').textContent = String(e.message || e);
        });
      }, 2500);
    })
    .catch(function(e){
      if(win && !win.closed){ try { win.close(); } catch(err){} }
      showErr('wb', e);
      btn.textContent = '\u6DFB\u52A0\u8D26\u53F7';
      btn.disabled = false;
    });
};

/* ---------------- Qoder \u8BBE\u5907\u6388\u6743\u767B\u5F55\uFF08\u56FD\u5185\u7248\uFF09 ---------------- */

var qoderNonce = '', qoderTimer = null;
function stopQoderQr(){ if(qoderTimer){ clearInterval(qoderTimer); qoderTimer = null; } }

function bindQoderAdd(sel, region, regionName){
  var btn = $(sel);
  btn.onclick = function(){
    stopQoderQr();
    btn.disabled = true;
    var old = btn.textContent;
    btn.textContent = '\u83B7\u53D6\u4E2D\u2026';
    showErr('qoder', '');
    $('#qoderQrStatus').textContent = '\u6B63\u5728\u5411' + regionName + '\u7533\u8BF7\u8BBE\u5907\u6388\u6743\u2026';

    /* \u540C\u6B65\u5148\u5F00\u7A7A\u7A97\u53E3\uFF0C\u907F\u514D\u63A5\u53E3\u8FD4\u56DE\u540E\u518D\u5F00\u88AB\u62E6\u622A */
    var win = window.open('about:blank', 'qoder-login', 'width=640,height=880');

    api('/qoder/api/login/start', { method:'POST', body: JSON.stringify({ region: region }) })
      .then(function(d){
        qoderNonce = d.nonce;
        var opened = false;
        if(win && !win.closed){
          try { win.location.href = d.authUrl; opened = true; } catch(e) { opened = false; }
        }
        if(opened){
          $('#qoderQrStatus').textContent = '\u5DF2\u5728\u65B0\u7A97\u53E3\u6253\u5F00' + regionName + '\u6388\u6743\u9875\uFF0C\u767B\u5F55\u5E76\u786E\u8BA4\u540E\u672C\u9875\u4F1A\u81EA\u52A8\u4FDD\u5B58\u8D26\u53F7\u3002';
        }else{
          $('#qoderQrStatus').innerHTML = '\u65B0\u7A97\u53E3\u88AB\u62E6\u622A\u4E86\uFF1A'
            + '<a href="' + esc(d.authUrl) + '" target="_blank" rel="noopener">\u70B9\u8FD9\u91CC\u6253\u5F00' + regionName + '\u6388\u6743\u9875</a>';
        }
        btn.textContent = old;
        btn.disabled = false;

        var n = 0;
        qoderTimer = setInterval(function(){
          if(n++ > 150){
            stopQoderQr();
            $('#qoderQrStatus').textContent = '\u6388\u6743\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u70B9\u300C\u6DFB\u52A0\u8D26\u53F7\uFF08' + regionName + '\uFF09\u300D';
            return;
          }
          api('/qoder/api/login/poll?nonce=' + encodeURIComponent(qoderNonce)).then(function(r){
            if(r.status === 'ok'){
              stopQoderQr();
              if(win && !win.closed){ try { win.close(); } catch(e){} }
              $('#qoderQrStatus').textContent = regionName + '\u767B\u5F55\u6210\u529F\uFF0C\u5DF2\u4FDD\u5B58\u4E3A\u300C' + r.label + '\u300D';
              load('qoder');
            }
          }).catch(function(e){
            stopQoderQr();
            $('#qoderQrStatus').textContent = String(e.message || e);
          });
        }, 2500);
      })
      .catch(function(e){
        if(win && !win.closed){ try { win.close(); } catch(err){} }
        showErr('qoder', e);
        btn.textContent = old;
        btn.disabled = false;
      });
  };
}

bindQoderAdd('#qoderAddCn', 'cn', '\u56FD\u5185\u7248');

/* ---------------- \u4E8B\u4EF6\u7ED1\u5B9A ---------------- */

$('#loginbtn').onclick = function(){ login($('#pwd').value); };
$('#pwd').onkeydown = function(e){ if(e.key === 'Enter') login($('#pwd').value); };
$('#logout').onclick = function(){ if(confirm('\u9000\u51FA\u767B\u5F55\uFF1F')) logout(''); };
/* ---------------- \u901A\u77E5\u8BBE\u7F6E ---------------- */
function nvOpen(){
  $('#nvModal').hidden = false;
  $('#nvMsg').textContent = '';
  api('/api/notify').then(function(c){
    var tg = c.telegram || {}, qq = c.qq || {};
    $('#tgOn').checked = tg.enabled !== false;
    $('#tgChat').value = tg.chatId || '';
    $('#tgToken').value = tg.token || '';
    $('#tgToken').placeholder = '123456:ABC-DEF...';

    $('#qqOn').checked = qq.enabled !== false;
    $('#qqAppId').value = qq.appId || '';
    $('#qqOpenid').value = qq.openid || '';
    if(window.renderHelperCmds) window.renderHelperCmds();
    $('#qqSecret').value = qq.secret || '';
    $('#qqSecret').placeholder = 'AppSecret';

    if(c.fromEnv){ $('#nvMsg').textContent = '\u5F53\u524D\u8BFB\u7684\u662F\u73AF\u5883\u53D8\u91CF\uFF0C\u4FDD\u5B58\u540E\u4F1A\u6539\u5B58\u5230 KV\u3002'; }
  }).catch(function(e){
    $('#nvMsg').textContent = String(e.message || e);
  });
}

function nvPayload(){
  return {
    telegram: {
      enabled: $('#tgOn').checked,
      token: $('#tgToken').value.trim(),
      chatId: $('#tgChat').value.trim(),
    },
    qq: {
      enabled: $('#qqOn').checked,
      appId: $('#qqAppId').value.trim(),
      secret: $('#qqSecret').value.trim(),
      openid: $('#qqOpenid').value.trim(),
    },
  };
}

function nvSave(){
  return api('/api/notify', { method:'POST', body: JSON.stringify(nvPayload()) });
}

$('#runAll').onclick = runAll;

document.querySelectorAll('[data-run]').forEach(function(b){
  b.onclick = function(){ runOne(b.dataset.run); };
});
document.querySelectorAll('[data-refresh]').forEach(function(b){
  b.onclick = function(){ load(b.dataset.refresh); };
});

/* \u9875\u9762\u6302\u7740\u8FC7\u591C\u4E5F\u80FD\u81EA\u52A8\u7FFB\u7BC7\uFF1A\u53EA\u5728\u65E5\u671F\u771F\u7684\u53D8\u4E86\u624D\u91CD\u65B0\u62C9\u5217\u8868 */
var dayMark = bjToday();
setInterval(function(){
  var d = bjToday();
  if(d !== dayMark){ dayMark = d; if(state.tok) loadAll(); }
}, 60000);

var saved = localStorage.getItem(PWD_KEY);
if(saved) login(saved);
<\/script>

  <!-- \u901A\u77E5\u8BBE\u7F6E -->
  <div class="nv-mask" id="nvModal" hidden>
    <div class="nv-card">
      <div class="nv-head">
        <h3>\u7B7E\u5230\u7ED3\u679C\u901A\u77E5</h3>
        <button type="button" class="nv-x" id="nvClose">\xD7</button>
      </div>
      <div class="nv-body">
        <section class="nv-sec">
          <label class="nv-h"><input type="checkbox" id="tgOn"> Telegram</label>
          <div class="nv-row"><span>Bot Token</span><input id="tgToken" placeholder="123456:ABC-DEF..." autocomplete="off"></div>
          <div class="nv-row"><span>Chat ID</span><input id="tgChat" placeholder="123456789" autocomplete="off"></div>
          <p class="nv-tip">\u627E <b>@BotFather</b> \u53D1 <code>/newbot</code> \u62FF Token\uFF1B\u5148\u7ED9 bot \u53D1\u6761\u6D88\u606F\uFF0C\u518D\u8BBF\u95EE <code>api.telegram.org/bot&lt;token&gt;/getUpdates</code> \u53D6 chat id\u3002</p>
        </section>

        <section class="nv-sec">
          <label class="nv-h"><input type="checkbox" id="qqOn"> QQ \u673A\u5668\u4EBA</label>
          <div class="nv-row"><span>AppID</span><input id="qqAppId" placeholder="q.qq.com \u521B\u5EFA\u673A\u5668\u4EBA\u540E\u83B7\u5F97" autocomplete="off"></div>
          <div class="nv-row"><span>AppSecret</span><input id="qqSecret" type="text" placeholder="\u540C\u4E00\u9875\u9762\u7684 AppSecret" autocomplete="off"></div>
          <div class="nv-row"><span>OpenID</span><input id="qqOpenid" placeholder="user_openid\uFF0C\u4E0D\u662F QQ \u53F7" autocomplete="off"></div>
          <p class="nv-tip"><b>\u600E\u4E48\u62FF</b>\uFF1A\u672C\u673A\u7EC8\u7AEF\u8DD1\u4E0B\u9762\u8FD9\u6761\uFF0C\u7136\u540E\u7ED9\u673A\u5668\u4EBA\u53D1\u6761\u79C1\u804A\u6D88\u606F\uFF0C\u5B83\u4F1A\u76F4\u63A5\u6253\u5370 OpenID\u3002</p>
          <div class="nv-os" id="qqHelperOs">
            <button type="button" data-os="win" class="on">Windows</button>
            <button type="button" data-os="mac">macOS / Linux</button>
          </div>
          <div class="nv-cmd">
            <code id="qqHelperCmd">curl.exe -O {origin}/qq/openid-helper.mjs</code>
            <button type="button" class="nv-copy" data-copy="qqHelperCmd">\u590D\u5236</button>
          </div>
          <div class="nv-cmd">
            <code id="qqHelperRun">node openid-helper.mjs AppID AppSecret</code>
            <button type="button" class="nv-copy" data-copy="qqHelperRun">\u590D\u5236</button>
          </div>
          <p class="nv-tip" id="qqHelperNote">\u4E24\u6761<b>\u5206\u5F00\u6267\u884C</b>\uFF08PowerShell 5 \u4E0D\u8BA4 &amp;&amp;\uFF09\u3002\u7B2C\u4E8C\u6761\u91CC\u7684 AppID / AppSecret \u6362\u6210\u4E0A\u9762\u586B\u7684\u503C\uFF1B\u8DD1\u8D77\u6765\u540E 60 \u79D2\u5185\u7ED9\u673A\u5668\u4EBA\u53D1\u6761\u79C1\u804A\uFF0C\u7EC8\u7AEF\u4F1A\u6253\u5370 <code>user_openid</code>\u3002</p>

          <p class="nv-tip nv-warn">\u5B98\u65B9\u5BF9\u300C\u4E3B\u52A8\u6D88\u606F\u300D\u6709\u9891\u6B21\u9650\u5236\uFF0C\u8D85\u4E86\u4F1A\u8FD4\u56DE\u9519\u8BEF\u7801\u3002QQ \u7528\u6237\u9700\u8981\u5728 QQ \u5BA2\u6237\u7AEF\u673A\u5668\u4EBA\u8BBE\u7F6E\u91CC\u6253\u5F00\u300C\u5141\u8BB8\u4E3B\u52A8\u53D1\u9001\u6D88\u606F\u300D\u3002</p>
        </section>

      </div>
      <div class="nv-foot">
        <span class="nv-msg" id="nvMsg"></span>
        <button type="button" id="nvTest">\u53D1\u6D4B\u8BD5</button>
        <button type="button" class="pri" id="nvSave">\u4FDD\u5B58</button>
      </div>
    </div>
  </div>
<script>
/* \u901A\u77E5\u5F39\u7A97\u7684\u7ED1\u5B9A\u653E\u8FD9\u91CC\uFF1A\u5B83\u5FC5\u987B\u7B49\u4E0A\u9762\u7684\u5F39\u7A97 DOM \u89E3\u6790\u5B8C */
(function(){
  var helperOs = (function(){
    var p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    return /mac|linux/i.test(p) ? 'mac' : 'win';
  })();

  window.renderHelperCmds = function(){
    var el = document.getElementById('qqHelperCmd');
    var run = document.getElementById('qqHelperRun');
    if(el) el.textContent = (helperOs === 'mac' ? 'curl' : 'curl.exe') + ' -O ' + location.origin + '/qq/openid-helper.mjs';
    if(run) run.textContent = 'node openid-helper.mjs AppID AppSecret';
    var box = document.getElementById('qqHelperOs');
    if(box) box.querySelectorAll('button').forEach(function(b){
      b.classList.toggle('on', b.dataset.os === helperOs);
    });
    var note = document.getElementById('qqHelperNote');
    if(note){
      note.innerHTML = helperOs === 'mac'
        ? '\u4E24\u6761<b>\u4F9D\u6B21\u6267\u884C</b>\u5373\u53EF\uFF08macOS / Linux \u4E0A\u4E5F\u53EF\u4EE5\u76F4\u63A5\u7528 <code>&amp;&amp;</code> \u8FDE\u8D77\u6765\uFF09\u3002\u7B2C\u4E8C\u6761\u91CC\u7684 AppID / AppSecret \u6362\u6210\u4E0A\u9762\u586B\u7684\u503C\uFF0C\u8DD1\u8D77\u6765\u540E 60 \u79D2\u5185\u7ED9\u673A\u5668\u4EBA\u53D1\u6761\u79C1\u804A\u3002'
        : '\u4E24\u6761<b>\u5206\u5F00\u6267\u884C</b>\uFF08PowerShell 5 \u4E0D\u8BA4 <code>&amp;&amp;</code>\uFF09\u3002\u7B2C\u4E8C\u6761\u91CC\u7684 AppID / AppSecret \u6362\u6210\u4E0A\u9762\u586B\u7684\u503C\uFF0C\u8DD1\u8D77\u6765\u540E 60 \u79D2\u5185\u7ED9\u673A\u5668\u4EBA\u53D1\u6761\u79C1\u804A\u3002';
    }
  };

  var osBox = document.getElementById('qqHelperOs');
  if(osBox) osBox.querySelectorAll('button').forEach(function(b){
    b.onclick = function(){ helperOs = b.dataset.os; window.renderHelperCmds(); };
  });

  var open = document.getElementById('notifyOpen');
  if(open) open.onclick = nvOpen;

  var close = document.getElementById('nvClose');
  if(close) close.onclick = function(){ document.getElementById('nvModal').hidden = true; };

  var mask = document.getElementById('nvModal');
  if(mask) mask.addEventListener('click', function(ev){ if(ev.target === this) this.hidden = true; });

  document.querySelectorAll('.nv-copy[data-copy]').forEach(function(b){
    b.onclick = function(){
      var el = document.getElementById(b.dataset.copy);
      if(!el) return;
      var txt = el.value || el.textContent || '';
      var done = function(){ b.textContent = '\u5DF2\u590D\u5236'; setTimeout(function(){ b.textContent = '\u590D\u5236'; }, 1400); };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(done, function(){ b.textContent = '\u590D\u5236\u5931\u8D25'; });
      } else {
        if(el.select) el.select();
        try { document.execCommand('copy'); done(); } catch(e){ b.textContent = '\u590D\u5236\u5931\u8D25'; }
      }
    };
  });

  var saveBtn = document.getElementById('nvSave');
  if(saveBtn) saveBtn.onclick = function(){
    saveBtn.disabled = true;
    document.getElementById('nvMsg').textContent = '\u4FDD\u5B58\u4E2D\u2026';
    nvSave().then(function(d){
      document.getElementById('nvMsg').textContent = d.channels && d.channels.length
        ? '\u5DF2\u4FDD\u5B58\uFF0C\u542F\u7528\uFF1A' + d.channels.join(' / ')
        : '\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u8FD8\u6CA1\u6709\u586B\u5B8C\u6574\u542F\u7528\u7684\u6E20\u9053';
    }).catch(function(e){
      document.getElementById('nvMsg').textContent = '\u4FDD\u5B58\u5931\u8D25\uFF1A' + String(e.message || e);
    }).then(function(){ saveBtn.disabled = false; });
  };

  var testBtn = document.getElementById('nvTest');
  if(testBtn) testBtn.onclick = function(){
    testBtn.disabled = true;
    document.getElementById('nvMsg').textContent = '\u53D1\u9001\u4E2D\u2026';
    nvSave()
      .then(function(){ return api('/api/notify/test', { method:'POST', body:'{}' }); })
      .then(function(d){
        document.getElementById('nvMsg').textContent = d.errors && d.errors.length
          ? '\u90E8\u5206\u5931\u8D25\uFF1A' + d.errors.join('\uFF1B')
          : '\u5DF2\u53D1\u9001\u5230 ' + (d.channels || []).join(' / ');
      })
      .catch(function(e){
        document.getElementById('nvMsg').textContent = '\u53D1\u9001\u5931\u8D25\uFF1A' + String(e.message || e);
      })
      .then(function(){ testBtn.disabled = false; });
  };
})();
<\/script>

</body>
</html>`;
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method.toUpperCase();
    try {
      if (path === "/" || path === "/index.html") return htmlResponse(PAGE);
      if (path === "/cron") {
        const c = requireCron(request, env);
        if (!c.ok) return c.res;
        return json(await runAll(env, url.origin, false));
      }
      if (path === "/oauth/callback" && method === "GET") return await Trae.fetch(request, traeEnv(env), ctx);
      if (path === "/oauth/probe") {
        return new Response("ok", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
      }
      if (path === "/api/ping" && method === "GET") {
        const a = requireAdmin(request, env);
        return a.ok ? json({ ok: true }) : a.res;
      }
      if (path === "/api/run-all" && method === "POST") {
        const a = requireAdmin(request, env);
        if (!a.ok) return a.res;
        const force = url.searchParams.get("force") === "1";
        return json(await runAll(env, url.origin, force));
      }
      if (path === "/qq/openid-helper.mjs" && method === "GET") {
        return new Response(QQ_OPENID_HELPER, {
          headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" }
        });
      }
      if (path === "/api/notify" && method === "GET") {
        const a = requireAdmin(request, env);
        if (!a.ok) return a.res;
        return json(await notifyConfigForUi(env));
      }
      if (path === "/api/notify" && method === "POST") {
        const a = requireAdmin(request, env);
        if (!a.ok) return a.res;
        const body = await request.json().catch(() => ({}));
        const prev = await loadNotifyConfig(env);
        const pick = /* @__PURE__ */ __name((next, key, fallback) => {
          const v = String(next?.[key] ?? "").trim();
          return v || String(fallback?.[key] ?? "");
        }, "pick");
        const tIn = body.telegram || {};
        const qIn = body.qq || {};
        const cfg = {
          telegram: {
            enabled: tIn.enabled !== false,
            token: pick(tIn, "token", prev.telegram),
            chatId: String(tIn.chatId ?? "").trim()
          },
          qq: {
            enabled: qIn.enabled !== false,
            appId: String(qIn.appId ?? "").trim(),
            secret: pick(qIn, "secret", prev.qq),
            openid: String(qIn.openid ?? "").trim(),
            sandbox: !!qIn.sandbox
          }
        };
        await saveNotifyConfig(env, cfg);
        const ch = await notifyChannels(env);
        return json({ ok: true, channels: Object.keys(ch) });
      }
      if (path === "/api/notify/test" && method === "POST") {
        const a = requireAdmin(request, env);
        if (!a.ok) return a.res;
        const ch = await notifyChannels(env);
        if (!Object.keys(ch).length) {
          return json({ error: "\u8FD8\u6CA1\u6709\u914D\u7F6E\u901A\u77E5\u6E20\u9053\uFF1A\u5148\u5728\u9875\u9762\u91CC\u628A Telegram \u6216 QQ \u673A\u5668\u4EBA\u586B\u597D" }, 400);
        }
        const demo = {
          at: new Date(Date.now() + 8 * 36e5).toISOString().replace("Z", " +08:00"),
          trae: { results: [{ label: "\u793A\u4F8B\u8D26\u53F7", state: "checked", msg: "+50 \u79EF\u5206" }] },
          wb: { results: [{ label: "\u793A\u4F8B\u4E3B\u53F7", state: "skipped", msg: "\u4ECA\u65E5\u5DF2\u5B8C\u6210" }] },
          qoder: { results: [{ label: "\u793A\u4F8B\u53F7", state: "checked", msg: "\u9886\u53D6\u6210\u529F +100 credits" }] }
        };
        const r = await notifyRun(env, demo);
        return json({ ...r, channels: Object.keys(ch) });
      }
      if (path === "/trae" || path === "/wb" || path === "/qoder") return Response.redirect(url.origin + "/", 302);
      if (path.startsWith("/trae/")) {
        return await Trae.fetch(repath(request, path.slice(5) || "/"), traeEnv(env), ctx);
      }
      if (path.startsWith("/wb/")) {
        return await WorkBuddy.fetch(repath(request, path.slice(3) || "/"), wbEnv(env), ctx);
      }
      if (path.startsWith("/qoder/")) {
        return await Qoder.fetch(repath(request, path.slice(6) || "/"), qoderEnv(env), ctx);
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: e.message || String(e) }, 500);
    }
  },
  /** Cloudflare Cron Trigger：三个平台依次签到，互不影响 */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const pending = [];
        const sink = { waitUntil: /* @__PURE__ */ __name((p) => pending.push(p), "waitUntil") };
        for (const [mod, e] of [
          [Trae, traeEnv(env)],
          [WorkBuddy, wbEnv(env)],
          [Qoder, qoderEnv(env)]
        ]) {
          try {
            await mod.scheduled({}, e, sink);
          } catch {
          }
        }
        await Promise.allSettled(pending);
      })()
    );
  }
};

// src/index.js
async function dispatchGithub(env) {
  const repo = env.GH_REPO;
  const workflow = env.GH_WORKFLOW;
  if (!repo || !workflow || !env.GH_PAT) return "github-config-missing";
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GH_PAT}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "workbuddy-checkin-worker"
      },
      body: JSON.stringify({ ref: env.GH_REF || "main" })
    }
  );
  if (res.status === 204) return "github-dispatched";
  const body = await res.text();
  return `github-failed ${res.status}: ${body.slice(0, 160)}`;
}
__name(dispatchGithub, "dispatchGithub");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/trigger-github") {
      const token = request.headers.get("x-admin-token") || url.searchParams.get("key") || "";
      if (token !== env.ADMIN_TOKEN) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      const result = await dispatchGithub(env);
      return new Response(JSON.stringify({ at: (/* @__PURE__ */ new Date()).toISOString(), result }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return worker_default.fetch(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    if (typeof worker_default.scheduled === "function") {
      await worker_default.scheduled(event, env, ctx);
    }
    ctx.waitUntil(dispatchGithub(env).then((r) => console.log("github:", r)));
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map