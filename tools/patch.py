import io, re, sys

SRC = "worker_deployed.js"
OUT = "worker_patched.js"

def esc(s):
    out = []
    for ch in s:
        o = ord(ch)
        if o < 128:
            out.append(ch)
        elif o <= 0xFFFF:
            out.append("\\u%04X" % o)
        else:
            out.append(ch)
    return "".join(out)

BACKEND = r'''
var HIST_LOG_PREFIX = "hist:log:";
var HIST_KEEP_DAYS = 120;
function numOr(v) {
  if (v === null || v === void 0 || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
__name(numOr, "numOr");
function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}
__name(round2, "round2");
function bjDateKey(ts) {
  return new Date((ts || Date.now()) + 8 * 36e5).toISOString().slice(0, 10);
}
__name(bjDateKey, "bjDateKey");
async function platformAccounts(mod, e) {
  const req = new Request("https://hist.internal/api/list", {
    method: "GET",
    headers: { "X-Admin-Token": String(e.ADMIN_TOKEN || "") }
  });
  const res = await mod.fetch(req, e, { waitUntil: /* @__PURE__ */ __name(() => {
  }, "waitUntil") });
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.accounts) ? data.accounts : [];
}
__name(platformAccounts, "platformAccounts");
async function snapshotHistory(env, nowTs) {
  const day = bjDateKey(nowTs);
  const out = { day, platforms: {} };
  if (!env.KV) return out;
  const pairs = [
    ["trae", Trae, traeEnv(env)],
    ["wb", WorkBuddy, wbEnv(env)],
    ["qoder", Qoder, qoderEnv(env)]
  ];
  for (const [key, mod, e] of pairs) {
    try {
      const accounts = await platformAccounts(mod, e);
      let gain = 0, bal = null, signed = 0, failures = 0, streak = 0;
      for (const a of accounts) {
        const g = numOr(a.lastCredit);
        if (g !== null) gain += g;
        const b = key === "trae" ? numOr(a.credits) : a.total !== void 0 ? numOr(a.total) : numOr(a.totalCredit);
        if (b !== null) bal = (bal === null ? 0 : bal) + b;
        if (a.signedToday === true || a.lastOkDate === day) signed++;
        const st = numOr(a.streak);
        if (st !== null && st > streak) streak = st;
        if (a.lastState === "error" || a.lastState === "token_dead") failures++;
      }
      const entry = {
        d: day,
        gain: round2(gain),
        bal: bal === null ? null : round2(bal),
        n: accounts.length,
        s: signed,
        f: failures,
        k: streak
      };
      const logKey = HIST_LOG_PREFIX + key;
      let log = [];
      const raw = await env.KV.get(logKey);
      if (raw) {
        try {
          log = JSON.parse(raw) || [];
        } catch {
          log = [];
        }
      }
      if (!Array.isArray(log)) log = [];
      const at = log.findIndex((x) => x && x.d === day);
      if (at >= 0) {
        const prev = log[at] || {};
        entry.gain = round2(Math.max(numOr(prev.gain) || 0, entry.gain));
        entry.s = Math.max(numOr(prev.s) || 0, entry.s);
        entry.k = Math.max(numOr(prev.k) || 0, entry.k);
        if (entry.bal === null && prev.bal !== null && prev.bal !== void 0) entry.bal = prev.bal;
        log[at] = entry;
      } else {
        log.push(entry);
      }
      log.sort((a, b) => String(a && a.d).localeCompare(String(b && b.d)));
      if (log.length > HIST_KEEP_DAYS) log = log.slice(log.length - HIST_KEEP_DAYS);
      await env.KV.put(logKey, JSON.stringify(log));
      out.platforms[key] = entry;
    } catch (err) {
      out.platforms[key] = { error: String(err && err.message || err) };
    }
  }
  return out;
}
__name(snapshotHistory, "snapshotHistory");
async function recordNotifyStatus(env, result) {
  if (!env.KV) return;
  const status = {
    at: result && result.at ? result.at : bjDateKey(Date.now()),
    ts: Date.now(),
    ok: !(result && result.notifyError),
    errors: result && result.notifyError ? result.notifyError : null
  };
  try {
    await env.KV.put("notify:last", JSON.stringify(status));
  } catch {
  }
}
__name(recordNotifyStatus, "recordNotifyStatus");
'''

ROUTES = r'''      if (path === "/api/history" && method === "GET") {
        const auth = requireAdmin(request, env);
        if (!auth.ok) return auth.res;
        const want = Math.max(1, Math.min(HIST_KEEP_DAYS, Number(url.searchParams.get("days")) || 30));
        const series = {};
        for (const key of ["trae", "wb", "qoder"]) {
          let log = [];
          const raw = env.KV ? await env.KV.get(HIST_LOG_PREFIX + key) : null;
          if (raw) {
            try {
              log = JSON.parse(raw) || [];
            } catch {
              log = [];
            }
          }
          if (!Array.isArray(log)) log = [];
          series[key] = log.slice(-want);
        }
        let notifyLast = null;
        const nRaw = env.KV ? await env.KV.get("notify:last") : null;
        if (nRaw) {
          try {
            notifyLast = JSON.parse(nRaw);
          } catch {
            notifyLast = null;
          }
        }
        return json({ today: bjDateKey(Date.now()), days: want, series, notify: notifyLast });
      }
      if (path === "/api/snapshot" && method === "POST") {
        const auth = requireAdmin(request, env);
        if (!auth.ok) return auth.res;
        return json(await snapshotHistory(env));
      }
'''

CSS = r'''  /* TREND */
  .trend{margin-bottom:18px}
  .bal{margin-bottom:18px}
  .bal-top{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
  .bal-chip{flex:1 1 120px;border:1px solid var(--line);border-radius:10px;padding:8px 11px;background:var(--surface-2)}
  .bal-chip .bk{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
  .bal-chip .bv{font-family:var(--mono);font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:1px;letter-spacing:-.02em}
  .bal-chip .bs{font-size:9.5px;color:var(--dim);font-family:var(--mono)}
  .bal-scroll{max-height:248px;overflow-y:auto;border-top:1px solid var(--line);margin-top:2px;
              scrollbar-width:thin;overscroll-behavior:contain}
  .bal-scroll::-webkit-scrollbar{width:8px}
  .bal-scroll::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:99px}
  .bal-scroll::-webkit-scrollbar-track{background:transparent}
  .bal-item{border-bottom:1px solid var(--line)}
  .bal-item:last-child{border-bottom:0}
  .bal-row{display:grid;grid-template-columns:78px minmax(0,1fr) 118px 70px;gap:9px;align-items:center;
           padding:10px 4px;font-size:13px;cursor:pointer;border-radius:8px}
  .bal-row:hover{background:var(--surface-2)}
  .bal-pf{font-family:var(--mono);font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bal-nm{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .bal-rt{font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:700;text-align:right;white-space:nowrap;font-size:15px}
  .bal-rt small{font-size:9.5px;color:var(--dim);font-weight:600;margin-left:3px;letter-spacing:0}
  .bal-ex{font-family:var(--mono);font-size:10.5px;color:var(--dim);text-align:right;white-space:nowrap}
  .bal-ex.warn{color:var(--warn)}
  .bal-ex.bad{color:var(--bad)}
  .bal-det{padding:0 4px 10px 4px;display:grid;gap:3px}
  .bal-det[hidden]{display:none}
  .bal-pack{display:grid;grid-template-columns:minmax(0,1fr) 64px 76px;gap:8px;
            font-family:var(--mono);font-size:11px;color:var(--dim)}
  .bal-pack b{color:var(--txt);font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
  .bal-pack span:last-child{text-align:right}
  @media (max-width:600px){
    .bal-row{grid-template-columns:58px minmax(0,1fr) 96px 58px;gap:6px;font-size:12.5px}
    .bal-rt{font-size:13.5px}
  }
  .trend-grid{display:grid;gap:14px;grid-template-columns:repeat(3,minmax(0,1fr))}
  @media (max-width:840px){.trend-grid{grid-template-columns:1fr}}
  .tcell{border:1px solid var(--line);border-radius:14px;padding:14px 15px;background:var(--surface-2);min-width:0}
  .tcell .th{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px}
  .tcell .tn{font-weight:700;font-size:13px;letter-spacing:-.01em;color:var(--txt)}
  .tcell .tv{font-family:var(--mono);font-size:22px;font-weight:700;line-height:1.15;color:var(--txt);
             font-variant-numeric:tabular-nums;letter-spacing:-.03em;margin-top:4px}
  .tcell .tv .u{font-size:10.5px;color:var(--dim);font-weight:600;margin-left:4px;letter-spacing:0}
  .tcell .tsub{font-family:var(--mono);font-size:10.5px;color:var(--dim);margin-top:4px;
               font-variant-numeric:tabular-nums;line-height:1.5}
  .tcell svg.spark{display:block;width:100%;height:50px;margin-top:10px}
  .tcell .taxis{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;
                color:var(--dim);margin-top:5px;font-variant-numeric:tabular-nums}
  .tpill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-family:var(--mono);
         font-size:10px;background:var(--ok-bg);color:var(--ok);white-space:nowrap}
  .tpill.idle{background:var(--idle-bg);color:var(--dim)}
  .tempty{padding:18px;text-align:center;color:var(--dim);font-size:12.5px}
'''

HTMLCARD = r'''
    <section class="card bal">
      <div class="card-head">
        <h2>各账号剩余积分</h2>
        <span class="meta" id="balMeta" style="cursor:pointer" onclick="loadBal(1)" title="点击强制刷新（绕过 2 分钟缓存）">—</span>
      </div>
      <div class="bal-top" id="balTop"><div class="tempty">加载中…</div></div>
      <div class="bal-scroll" id="balList"></div>
    </section>

    <section class="card trend">
      <div class="card-head">
        <h2>收益趋势</h2>
        <span class="meta" id="trendMeta">—</span>
      </div>
      <div class="trend-grid" id="trendGrid"><div class="tempty">加载中…</div></div>
    </section>
'''

FRONTJS = r'''/* ---------------- 收益趋势 ---------------- */

var TREND_LABEL = { trae:'Trae', wb:'WorkBuddy', qoder:'Qoder' };
var TREND_COLOR = { trae:'#2fd07e', wb:'#5b9cff', qoder:'#c58bff' };
var trendTimer = null;

function trendStreak(log){
  var n = 0;
  for(var i = log.length - 1; i >= 0; i--){
    if((Number(log[i].gain) || 0) > 0) n++; else break;
  }
  return n;
}

function trendSpark(log){
  if(!log.length) return '';
  var W = 260, H = 50, PAD = 4;
  var max = 1;
  log.forEach(function(e){ var g = Number(e.gain) || 0; if(g > max) max = g; });
  var pts = log.map(function(e, i){
    var x = log.length === 1 ? W / 2 : (i / (log.length - 1)) * W;
    var y = H - PAD - ((Number(e.gain) || 0) / max) * (H - PAD * 2);
    return [x.toFixed(1), y.toFixed(1)];
  });
  var line = pts.map(function(p){ return p[0] + ',' + p[1]; }).join(' ');
  var area = 'M' + pts[0][0] + ',' + (H - PAD) + ' L' + line + ' L' + pts[pts.length - 1][0] + ',' + (H - PAD) + ' Z';
  var last = pts[pts.length - 1];
  return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">'
    + '<path d="' + area + '" fill="currentColor" fill-opacity="0.10" stroke="none"></path>'
    + '<polyline points="' + line + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"'
    + ' stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>'
    + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.6" fill="currentColor"></circle>'
    + '</svg>';
}

function renderTrend(d){
  var grid = $('#trendGrid');
  if(!grid) return;
  var series = (d && d.series) || {};
  var today = (d && d.today) || '';
  var hasAny = ['trae','wb','qoder'].some(function(k){ return ((series[k]) || []).length > 0; });
  var hasBal = !!(state.bal && ['trae','wb','qoder'].some(function(k){ return state.bal[k] !== null && state.bal[k] !== undefined; }));
  if(!hasAny && !hasBal){
    grid.innerHTML = '<div class="tempty">暂无历史数据：下一轮签到跑完后会自动生成</div>';
    if($('#trendMeta')) $('#trendMeta').textContent = '—';
    return;
  }
  var html = '';
  ['trae','wb','qoder'].forEach(function(k){
    var log = series[k] || [];
    var now = null;
    for(var i = log.length - 1; i >= 0; i--){ if(log[i].d === today){ now = log[i]; break; } }
    var sum = 0, balHist = null;
    log.forEach(function(e){
      sum += Number(e.gain) || 0;
      if(e.bal !== null && e.bal !== undefined && isFinite(Number(e.bal))) balHist = Number(e.bal);
    });
    var live = (state.bal && state.bal[k] !== null && state.bal[k] !== undefined) ? state.bal[k] : null;
    var balVal = live !== null ? live : balHist;
    var balLabel = k === 'trae' ? '剩余积分' : '累计积分';
    var g = now ? (Number(now.gain) || 0) : null;
    var pill = now
      ? (g > 0 ? '<span class="tpill">今日 +' + g + '</span>' : '<span class="tpill idle">今日 0</span>')
      : '<span class="tpill idle">今日未跑</span>';
    var fails = now ? (Number(now.f) || 0) : 0;
    var streak = Math.max(Number(now && now.k) || 0, trendStreak(log));
    html += '<div class="tcell" style="color:' + (TREND_COLOR[k] || 'var(--pri)') + '">'
      + '<div class="th"><span class="tn">' + (TREND_LABEL[k] || k) + '</span>' + pill + '</div>'
      + '<div class="tv">' + (balVal == null ? '—' : balVal) + '<span class="u">' + balLabel + '</span></div>'
      + '<div class="tsub">近 ' + log.length + ' 天到账 +' + (Math.round(sum * 100) / 100)
      + ' · 连签 ' + streak + ' 天'
      + (fails ? ' · 异常 ' + fails : '') + '</div>'
      + trendSpark(log)
      + (log.length > 1 ? '<div class="taxis"><span>' + String(log[0].d).slice(5) + '</span><span>' + String(log[log.length - 1].d).slice(5) + '</span></div>' : '')
      + '</div>';
  });
  grid.innerHTML = html;
  if($('#trendMeta')){
    var n = Math.max.apply(null, ['trae','wb','qoder'].map(function(k){ return (series[k] || []).length; }));
    var nt = (d && d.notify) || null;
    var tail = '';
    if(nt && nt.ts){
      var hh = new Date(nt.ts).toTimeString().slice(0,5);
      tail = ' · 通知 ' + hh + (nt.ok ? ' 已发' : ' 失败');
    }
    $('#trendMeta').textContent = '近 ' + n + ' 天 · ' + (today ? today.slice(5) : '') + tail;
  }
}

var BAL_NAME = { trae:'Trae', wb:'WorkBuddy', qoder:'Qoder' };

function balNum(v){
  if(typeof v !== 'number') return v;
  return Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : Math.round(v * 10) / 10;
}

function balDate(r){
  if(!r.expireAt) return '';
  if(typeof r.expireAt === 'number'){
    var d = new Date(r.expireAt);
    var p2 = function(n){ return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  return String(r.expireAt).slice(0, 10);
}

function balExpText(r){
  if(typeof r.days === 'number'){
    if(r.days < 0) return ['已过期', ' bad'];
    if(r.days > 365) return ['长期', ''];
    return ['剩 ' + r.days + ' 天', r.days <= 7 ? ' warn' : ''];
  }
  if(r.expireAt) return [String(r.expireAt).slice(5,10) + ' 到期', ''];
  return ['—', ''];
}

function balToggle(el){
  var det = el && el.nextElementSibling;
  if(det && det.className === 'bal-det') det.hidden = !det.hidden;
}

function renderBal(d){
  var top = $('#balTop'), list = $('#balList');
  if(!top || !list) return;
  var pf = (d && d.platforms) || {};
  var topHtml = '', rows = [];
  ['trae','wb','qoder'].forEach(function(k){
    var p = pf[k] || {};
    var tot = (p.rows && p.rows.length && typeof p.total === 'number') ? p.total : null;
    var sub = p.error ? '接口报错' : (k === 'qoder' ? '合计累计' : '合计剩余');
    topHtml += '<div class="bal-chip"><div class="bk">' + BAL_NAME[k] + '</div>'
      + '<div class="bv">' + (tot === null ? '—' : tot) + '</div>'
      + '<div class="bs">' + sub + '</div></div>';
    (p.rows || []).forEach(function(r){ rows.push({ pf:k, r:r }); });
  });
  top.innerHTML = topHtml;
  if(!rows.length){ list.innerHTML = '<div class="tempty">没有账号</div>'; return; }
  var html = '';
  rows.forEach(function(x){
    var r = x.r || {};
    var isRemain = (typeof r.remain === 'number' && r.remain !== null);
    var val = isRemain ? r.remain : (typeof r.total === 'number' ? r.total : null);
    var ex = balExpText(r);
    var packHtml = '';
    (r.packs || []).forEach(function(p){
      var pd = (p.days === null || p.days === undefined) ? '' : (p.days < 0 ? '已过期' : (p.days > 365 ? '长期' : p.days + ' 天'));
      packHtml += '<div class="bal-pack"><span>' + esc(p.name || '积分包') + '</span><b>' + balNum(p.left) + '</b><span>' + pd + '</span></div>';
    });
    var det = packHtml ? '<div class="bal-det" hidden>' + packHtml + '</div>' : '';
    html += '<div class="bal-item">'
      + '<div class="bal-row" onclick="balToggle(this)">'
      + '<span class="bal-pf">' + BAL_NAME[x.pf] + '</span>'
      + '<span class="bal-nm" title="' + esc(r.label || '') + '">' + esc(r.label || '') + '</span>'
      + '<span class="bal-rt">' + (val === null ? '—' : balNum(val))
      + (val === null ? '' : '<small>' + (isRemain ? '剩余' : '累计') + '</small>') + '</span>'
      + '<span class="bal-ex' + ex[1] + '" title="' + esc((r.note ? r.note + ' · ' : '') + (balDate(r) ? balDate(r) + ' 到期' : '无到期信息')) + '">' + ex[0] + '</span>'
      + '</div>' + det + '</div>';
  });
  list.innerHTML = html;
  if($('#balMeta')) $('#balMeta').textContent = (d && d.at) ? ('更新 ' + new Date(d.at).toTimeString().slice(0,5)) : '—';
}

function loadBal(force){
  if(!state.tok) return;
  return api('/api/balance' + (force ? '?force=1' : ''))
    .then(function(d){ renderBal(d); })
    .catch(function(){});
}

function loadTrend(){
  if(!state.tok) return;
  return api('/api/history?days=30')
    .then(function(d){ renderTrend(d); })
    .catch(function(){});
}

function scheduleTrend(){
  if(trendTimer) clearTimeout(trendTimer);
  trendTimer = setTimeout(function(){ trendTimer = null; loadTrend(); loadBal(); }, 350);
}

'''

def must_one(hay, needle, label):
    n = hay.count(needle)
    if n != 1:
        print("ANCHOR FAIL [%s]: count=%d" % (label, n))
        sys.exit(1)
    return n

s = io.open(SRC, encoding="utf-8").read()

# 1) backend helpers after runAll
a1 = '__name(runAll, "runAll");\n'
must_one(s, a1, "runAll")
s = s.replace(a1, a1 + esc(BACKEND), 1)

# 2) cron hook
a2 = '        return json(await runAll(env, url.origin, false));'
must_one(s, a2, "cron")
s = s.replace(a2, '''        const cronRun = await runAll(env, url.origin, false);
        ctx.waitUntil(snapshotHistory(env).catch(() => null));
        return json(cronRun);''', 1)

# 3) run-all hook
a3 = '        return json(await runAll(env, url.origin, force));'
must_one(s, a3, "run-all")
s = s.replace(a3, '''        const allRun = await runAll(env, url.origin, force);
        ctx.waitUntil(snapshotHistory(env).catch(() => null));
        return json(allRun);''', 1)

# 4) history routes
a4 = '      if (path === "/qq/openid-helper.mjs" && method === "GET") {'
must_one(s, a4, "routes")
s = s.replace(a4, esc(ROUTES) + a4, 1)

# 5) per-platform run hooks
for pre, sl, mod in [("trae", 5, "Trae"), ("wb", 3, "WorkBuddy"), ("qoder", 6, "Qoder")]:
    a = '      if (path.startsWith("/%s/")) {\n        return await %s.fetch(repath(request, path.slice(%d) || "/"), %sEnv(env), ctx);\n      }' % (pre, mod, sl, pre)
    must_one(s, a, "prefix-" + pre)
    new = ('      if (path.startsWith("/%s/")) {\n'
           '        const r_%s = await %s.fetch(repath(request, path.slice(%d) || "/"), %sEnv(env), ctx);\n'
           '        if (path.endsWith("/api/run") && method === "POST") ctx.waitUntil(snapshotHistory(env).catch(() => null));\n'
           '        return r_%s;\n'
           '      }') % (pre, pre, mod, sl, pre, pre)
    s = s.replace(a, new, 1)

# 6) scheduled: 走同一条带通知的流程（原来只调平台 scheduled，从不发通知）
a6 = '''        const pending = [];
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
        await Promise.allSettled(pending);'''
must_one(s, a6, "scheduled")
s = s.replace(a6, '''        try {
          const cronResult = await runAll(env, "https://cron.internal", false);
          await snapshotHistory(env);
          console.log("cron done:", JSON.stringify({ at: cronResult && cronResult.at, notifyError: cronResult && cronResult.notifyError || null }));
        } catch (err) {
          console.log("cron failed:", String(err && err.message || err));
        }''', 1)

# 6b) runAll 记录通知状态
a6b = '''    result.notifyError = [String(err.message || err)];
  }
  return result;'''
must_one(s, a6b, "runAll-notify")
s = s.replace(a6b, '''    result.notifyError = [String(err.message || err)];
  }
  await recordNotifyStatus(env, result);
  return result;''', 1)

# 7) css
a7 = '  .nv-msg{flex:1;font-size:12px;color:var(--dim);min-height:16px}\n\n</style>'
must_one(s, a7, "style")
s = s.replace(a7, '  .nv-msg{flex:1;font-size:12px;color:var(--dim);min-height:16px}\n\n' + esc(CSS) + '\n</style>', 1)

# 8) html card
a8 = '    </header>\n\n    <nav class="tabs">'
must_one(s, a8, "header")
s = s.replace(a8, '    </header>\n' + esc(HTMLCARD) + '\n    <nav class="tabs">', 1)

# 9) frontend js block
a9 = r'/* ---------------- \u6807\u7B7E\u9875 ---------------- */'
must_one(s, a9, "tabjs")
s = s.replace(a9, esc(FRONTJS) + a9, 1)

# 10) hook renderStat -> scheduleTrend
# 10) renderStat：统计实时积分余额 + 修正“已签”判定（wb 无 signedToday 字段）
a10_old = r'''function renderStat(){
  var loaded = ['trae','wb','qoder'].filter(function(k){ return state.data[k]; });
  if(!loaded.length){ $('#statAll').textContent = '\u2014'; return; }
  var all = [];
  loaded.forEach(function(k){ all = all.concat(state.data[k].accounts || []); });
  var signed = all.filter(function(a){ return a.signedToday; }).length;
  $('#statAll').textContent = signed + ' / ' + all.length;
}'''
must_one(s, a10_old, "renderStat")
s = s.replace(a10_old, r'''function renderStat(){
  var loaded = ['trae','wb','qoder'].filter(function(k){ return state.data[k]; });
  if(!loaded.length){ $('#statAll').textContent = '\u2014'; scheduleTrend(); return; }
  var all = [];
  var bal = { trae:null, wb:null, qoder:null };
  loaded.forEach(function(k){
    (state.data[k].accounts || []).forEach(function(a){
      all.push(a);
      var v = null;
      if(typeof a.credits === 'number') v = a.credits;
      else if(typeof a.total === 'number') v = a.total;
      else if(typeof a.totalCredit === 'number' && a.totalCredit > 0) v = a.totalCredit;
      if(v !== null) bal[k] = (bal[k] || 0) + v;
    });
  });
  state.bal = bal;
  var signed = all.filter(function(a){
    return a.signedToday === true || (state.today && a.lastOkDate === state.today);
  }).length;
  $('#statAll').textContent = signed + ' / ' + all.length;
  scheduleTrend();
}''', 1)

# 11) load()：记住服务端给的 today，供已签判定
a11 = r'''    .then(function(d){
      if(p === 'trae') renderTrae(d);'''
must_one(s, a11, "load")
s = s.replace(a11, r'''    .then(function(d){
      if(d && d.today) state.today = d.today;
      if(p === 'trae') renderTrae(d);''', 1)

# 12) 探针：把各平台上游原始返回打出来（临时用，admin 鉴权）
PROBES = {
    "trae": (r'''  async function handleProbe(request, env) {
    const out = [];
    for (const meta of await listAccounts(env)) {
      const acct = await getAccount(env, meta.id);
      if (!acct) continue;
      const row = { id: acct.id, label: acct.label, accessExp: acct.accessExp || null };
      try {
        let token = String(acct.accessToken || "");
        if (!token || !acct.accessExp || acct.accessExp * 1000 < Date.now() + 6e4) {
          const t = await refreshTokens(acct);
          token = t.accessToken;
          acct.refreshToken = t.refreshToken;
          acct.accessToken = token;
          acct.accessExp = jwtExp(token);
          await putAccount(env, acct);
        }
        const st = await traeFetch(EP.status, { headers: ugHeaders(token, acct), body: REQ_BODY });
        const en = await traeFetch(EP.entitle, { headers: ugHeaders(token, acct), body: '{"require_usage": true}' });
        row.status = st.json;
        row.entitle = en.json;
      } catch (e) {
        row.error = String(e && e.message || e);
      }
      out.push(row);
    }
    return json2({ accounts: out }, 200);
  }
  __name(handleProbe, "handleProbe");
''', "var Trae = (() => {", "  __name(handleList, \"handleList\");"),
    "wb": (r'''  async function handleProbe(request, env) {
    const out = [];
    for (const meta of await listAccounts(env)) {
      const acct = await getAccount(env, meta.id);
      if (!acct) continue;
      const row = { id: acct.id, label: acct.label, tokenRefreshedAt: acct.tokenRefreshedAt || null };
      try {
        const t = await refreshTokens(acct.refreshToken);
        const at = t.accessToken;
        try {
          const p = String(at).split(".");
          if (p.length === 3) {
            const j = JSON.parse(atob(p[1].replace(/-/g, "+").replace(/_/g, "/")));
            row.accessExp = j.exp || null;
          }
        } catch {
        }
        const pk = { PageNumber: 1, PageSize: 50, Status: [0, 3], OnlyValidPeriod: true, IsDisplayTotalInfo: true, OrderBy: "endTime", SortBy: "asc" };
        const calls = [
          ["/v2/billing/meter/checkin-activity-status", "{}"],
          ["/billing/meter/get-user-resource-summary", "{}"]
        ];
        row.calls = {};
        for (const [p, body] of calls) {
          try {
            const r = await wbFetch(p, { headers: authHeader(at), body });
            row.calls[p] = r.json;
          } catch (e) {
            row.calls[p] = "ERR " + String(e && e.message || e).slice(0, 140);
          }
        }
        try {
          const sum = row.calls["/billing/meter/get-user-resource-summary"] || {};
          const codes = ((sum.data && sum.data.Packages) || []).map((x) => x.PackageCode).filter(Boolean);
          for (const p of ["/billing/meter/get-user-resource-paid-packages", "/billing/meter/get-user-resource-free-packages"]) {
            try {
              const r = await wbFetch(p, { headers: authHeader(at), body: JSON.stringify(Object.assign({}, pk, { PackageCodes: codes })) });
              row.calls[p] = r.json;
            } catch (e) {
              row.calls[p] = "ERR " + String(e && e.message || e).slice(0, 140);
            }
          }
        } catch {
        }
      } catch (e) {
        row.error = String(e && e.message || e);
      }
      out.push(row);
    }
    return json2({ accounts: out }, 200);
  }
  __name(handleProbe, "handleProbe");
''', "var WorkBuddy = (() => {", "  __name(handleList, \"handleList\");"),
    "qoder": (r'''  async function handleProbe(request, env) {
    const out = [];
    for (const meta of await listAccounts(env)) {
      const acct = await getAccount(env, meta.id);
      if (!acct) continue;
      const row = { id: acct.id, label: acct.label };
      try {
        const at = await refreshAccount(acct);
        await putAccount(env, acct);
        const r = await fetchCampaigns(at, acct, env);
        row.httpStatus = r.status;
        row.payload = r.json;
      } catch (e) {
        row.error = String(e && e.message || e);
      }
      out.push(row);
    }
    return json2({ accounts: out }, 200);
  }
  __name(handleProbe, "handleProbe");
''', "var Qoder = (() => {", "  __name(handleList, \"handleList\");"),
}
ROUTE_LIST_LINE = 'if (path === "/api/list" && method === "GET") return handleList(request, env);'
PROBE_ROUTE = 'if (path === "/api/probe" && method === "GET") return handleProbe(request, env);'

for key, (fn_text, start_marker, end_marker) in PROBES.items():
    i = s.index(start_marker)
    j = s.index(end_marker, i)
    k = s.index(ROUTE_LIST_LINE, i)
    if not (i < k):
        print("ANCHOR FAIL [probe-route-%s]" % key)
        sys.exit(1)
    line_start = s.rindex("\n", 0, k) + 1
    indent = s[line_start:k]
    line_end = s.index("\n", k) + 1
    added = indent + PROBE_ROUTE + "\n"
    s = s[:line_end] + added + s[line_end:]
    if j > line_end:
        j += len(added)
    s = s[:j] + esc(fn_text) + s[j:]

# 13) 实时余额聚合（探针只负责取原始数据，聚合在默认 worker 做）
BALANCE = r'''
async function probePlatform(mod, e) {
  const req = new Request("https://bal.internal/api/probe", {
    headers: { "X-Admin-Token": String(e.ADMIN_TOKEN || "") }
  });
  const res = await mod.fetch(req, e, { waitUntil: /* @__PURE__ */ __name(() => {
  }, "waitUntil") });
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.accounts) ? data.accounts : [];
}
__name(probePlatform, "probePlatform");
function daysFromSec(sec) {
  const n = numOr(sec);
  if (!n) return null;
  const ms = n > 1e12 ? n : n * 1e3;
  return Math.ceil((ms - Date.now()) / 864e5);
}
__name(daysFromSec, "daysFromSec");
function daysFromStr(s) {
  const t = String(s || "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  const ms = m ? Date.parse(m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + (m[6] || "00") + "+08:00") : Date.parse(t);
  if (!ms || Number.isNaN(ms)) return null;
  return Math.ceil((ms - Date.now()) / 864e5);
}
__name(daysFromStr, "daysFromStr");
function groupPacks(packs) {
  const map = {};
  for (const p of packs) {
    const k = String(p.name || "");
    if (!map[k]) map[k] = { name: k, left: 0, exp: null, days: null, n: 0 };
    map[k].left = Math.round((map[k].left + (Number(p.left) || 0)) * 100) / 100;
    map[k].n++;
    if (p.exp && (!map[k].exp || p.exp < map[k].exp)) {
      map[k].exp = p.exp;
      map[k].days = p.days;
    }
  }
  return Object.keys(map).map((k) => map[k]).sort((a, b) => (a.exp || 0) - (b.exp || 0));
}
__name(groupPacks, "groupPacks");
async function balancesOf(env) {
  const out = { at: Date.now(), platforms: {} };
  try {
    let total = 0;
    const rows = [];
    for (const a of await probePlatform(Trae, traeEnv(env))) {
      const en = a.entitle || {};
      const us = en.usage_summary || {};
      let remain = numOr(en.total_balance);
      if (remain === null) {
        const t = numOr(us.total_amount), u = numOr(us.consumed_amount);
        if (t !== null) remain = Math.max(t - (u || 0), 0);
      }
      let nearest = null;
      const packs = [];
      for (const p of en.user_entitlement_pack_list || []) {
        const q = p && p.entitlement_base_info && p.entitlement_base_info.quota;
        const limit = numOr(q && q.credits_limit) || 0;
        const used = numOr(p && p.usage && p.usage.credits_amount) || 0;
        const exp = numOr(p && p.expire_time) || numOr(p && p.entitlement_base_info && p.entitlement_base_info.end_time) || 0;
        if (limit <= 0) continue;
        packs.push({
          name: String(p.display_desc || (p.entitlement_base_info && p.entitlement_base_info.product_extra && "") || ""),
          left: Math.max(limit - used, 0),
          limit: limit,
          exp: exp,
          days: exp ? daysFromSec(exp) : null
        });
        if (limit - used > 0 && exp > 0 && (!nearest || exp < nearest.exp)) nearest = { exp, left: limit - used, name: String(p.display_desc || "") };
      }
      packs.sort((a, b) => (a.exp || 0) - (b.exp || 0));
      if (remain !== null) total += remain;
      rows.push({
        label: a.label || a.id,
        remain: remain,
        expireAt: nearest ? nearest.exp * 1e3 : null,
        days: nearest ? daysFromSec(nearest.exp) : null,
        note: nearest ? nearest.name + " " + nearest.left : "",
        packs: groupPacks(packs),
        err: a.error || null
      });
    }
    out.platforms.trae = { unit: "\u79EF\u5206", total, rows };
  } catch (e) {
    out.platforms.trae = { error: String(e && e.message || e) };
  }
  try {
    let total = 0;
    const rows = [];
    const pkBase = { PageNumber: 1, PageSize: 50, Status: [0, 3], OnlyValidPeriod: true, IsDisplayTotalInfo: true, OrderBy: "endTime", SortBy: "asc" };
    for (const a of await probePlatform(WorkBuddy, wbEnv(env))) {
      const calls = a.calls || {};
      const act = (calls["/v2/billing/meter/checkin-activity-status"] || {}).data || {};
      const sum = (calls["/billing/meter/get-user-resource-summary"] || {}).data || {};
      let remain = numOr(sum.TotalCredits);
      const packs = [];
      const seen = {};
      for (const key of ["/billing/meter/get-user-resource-free-packages", "/billing/meter/get-user-resource-paid-packages"]) {
        const accs = ((calls[key] || {}).data || {}).Accounts || [];
        for (const p of accs) {
          const rid = String(p.ResourceId || p.DealName || "") + "|" + String(p.PackageCode || "");
          if (seen[rid]) continue;
          seen[rid] = 1;
          const left = numOr(p.CapacityRemain);
          const exp = numOr(p.DeductionEndTime);
          packs.push({
            name: String(p.PackageName || p.PackageCode || "\u79EF\u5206\u5305"),
            left: left === null ? 0 : left,
            exp: exp || null,
            days: exp ? daysFromSec(exp) : null
          });
        }
      }
      packs.sort((x, y) => (x.exp || 0) - (y.exp || 0));
      let nearest = null;
      for (const p of packs) {
        if (p.left > 0 && p.exp) {
          nearest = p;
          break;
        }
      }
      if (remain !== null) total += remain;
      rows.push({
        label: a.label || a.id,
        remain: remain === null ? null : Math.round(remain * 100) / 100,
        expireAt: nearest ? nearest.exp : act.end_time || null,
        days: nearest ? nearest.days : daysFromStr(act.end_time),
        note: nearest ? nearest.name : String(act.activity_name || ""),
        packs: groupPacks(packs),
        err: a.error || null
      });
    }
    out.platforms.wb = { unit: "\u79EF\u5206", total: Math.round(total * 100) / 100, rows };
  } catch (e) {
    out.platforms.wb = { error: String(e && e.message || e) };
  }
  try {
    let total = 0;
    const rows = [];
    for (const a of await probePlatform(Qoder, qoderEnv(env))) {
      const p = a.payload || {};
      const list = p.campaigns || (p.data && p.data.campaigns) || [];
      let remain = null, exp = null;
      for (const r of list) {
        const amt = numOr(r && (r.credits || r.creditAmount));
        if (amt !== null) remain = (remain || 0) + amt;
        const e2 = r && (r.endTime || r.end_time || r.expireTime || r.expire_time);
        if (e2) {
          const ds = typeof e2 === "number" ? daysFromSec(e2) : daysFromStr(e2);
          if (ds !== null && (exp === null || ds < exp.days)) exp = { days: ds, at: e2 };
        }
      }
      if (remain !== null) total += remain;
      rows.push({
        label: a.label || a.id,
        remain: remain,
        expireAt: exp ? exp.at : null,
        days: exp ? exp.days : null,
        note: "",
        err: a.error || null
      });
    }
    out.platforms.qoder = { unit: "credits", total, rows };
  } catch (e) {
    out.platforms.qoder = { error: String(e && e.message || e) };
  }
  return out;
}
__name(balancesOf, "balancesOf");
'''
a13 = '__name(recordNotifyStatus, "recordNotifyStatus");\n'
must_one(s, a13, "recordNotifyStatus")
s = s.replace(a13, a13 + esc(BALANCE), 1)

BAL_ROUTE = '''      if (path === "/api/balance" && method === "GET") {
        const auth = requireAdmin(request, env);
        if (!auth.ok) return auth.res;
        const cRaw = env.KV ? await env.KV.get("bal:cache") : null;
        if (cRaw && url.searchParams.get("force") !== "1") {
          try {
            const c = JSON.parse(cRaw);
            if (c && c.at && Date.now() - c.at < 12e4) return json(c);
          } catch {
          }
        }
        const bal = await balancesOf(env);
        if (env.KV) ctx.waitUntil(env.KV.put("bal:cache", JSON.stringify(bal)).catch(() => null));
        return json(bal);
      }
'''
a13b = '      if (path === "/api/history" && method === "GET") {'
must_one(s, a13b, "balance-route")
s = s.replace(a13b, BAL_ROUTE + a13b, 1)

io.open(OUT, "w", encoding="utf-8", newline="\n").write(s)
print("OK bytes=%d" % len(s.encode("utf-8")))
