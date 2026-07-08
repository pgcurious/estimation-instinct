/* ============================================================
   The Practice Arena — an infinite, self-contained estimation trainer.
   Generates a randomized system + scale, takes the reader's answer for
   each metric, then reveals the worked five-rung solution using ONLY the
   book's cheat-sheet canon and grades each answer by order of magnitude.
   No backend, no network. Runs only on the Practice Arena page.
   ============================================================ */
(function () {
  function boot() {
    var mount = document.getElementById('practice-arena');
    if (!mount) return;

    // ---- canon constants (Appendix A) ----
    var DAY = 1e5;            // seconds in a day, interview rounding
    var STORE_MULT = 5;       // logical -> provisioned (x3 replication * x1.5 overhead)
    var BLOB_MULT = 1.5;      // erasure-coded blob stores
    var UTIL = 0.6;           // run compute at 60%
    var SRV = { heavy: 100, typical: 1000, trivial: 10000 };
    var REDIS = 1e5, SQL_W = 1000, NOSQL_W = 10000;
    var SIZE = { rec: 1e3, url: 100, loc: 100, feedPhoto: 2e5, photo4: 4e6, videoMin: 5e7 };
    var COST = { box: 1000, storeTB: 20, egressTB: 100, cdnTB: 30 };

    // ---- helpers ----
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    function LADDER(kind) {
      return {
        qps: [['/s', 1], ['k/s', 1e3], ['M/s', 1e6]],
        gb: [['GB', 1], ['TB', 1e3], ['PB', 1e6]],
        mbps: [['MB/s', 1], ['GB/s', 1e3], ['TB/s', 1e6]],
        money: [['$/mo', 1], ['k$/mo', 1e3], ['M$/mo', 1e6]],
        count: [['', 1], ['k', 1e3], ['M', 1e6]]
      }[kind];
    }
    function fmt(v, kind) {
      var ld = LADDER(kind), best = ld[0];
      for (var i = 0; i < ld.length; i++) if (v >= ld[i][1]) best = ld[i];
      var s = v / best[1];
      s = s >= 100 ? Math.round(s) : s >= 10 ? Math.round(s * 10) / 10 : Math.round(s * 100) / 100;
      return s + (best[0] ? ' ' + best[0] : '');
    }
    function human(n) { // compact number for prompt prose, e.g. 200000000 -> 200M
      var u = ['', 'k', 'M', 'B', 'T'], i = 0, x = Math.abs(n);
      while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; }
      x = x >= 100 ? Math.round(x) : x >= 10 ? Math.round(x * 10) / 10 : Math.round(x * 100) / 100;
      return x + u[i];
    }
    function parseHuman(s) {
      if (s == null) return NaN;
      s = ('' + s).trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '');
      if (!s) return NaN;
      var m = s.match(/^([0-9]*\.?[0-9]+)(e[0-9]+)?([kmbtg])?$/);
      if (!m) { var f = parseFloat(s); return isNaN(f) ? NaN : f; }
      var num = parseFloat(m[1] + (m[2] || ''));
      var suf = m[3];
      var mult = suf === 'k' ? 1e3 : suf === 'm' ? 1e6 : (suf === 'b' || suf === 'g') ? 1e9 : suf === 't' ? 1e12 : 1;
      return num * mult;
    }
    function grade(userBase, value) {
      if (!isFinite(userBase) || userBase <= 0) return 'none';
      var d = Math.abs(Math.log(userBase / value) / Math.LN10);
      return d <= 0.5 ? 'spot' : d <= 1.0 ? 'close' : 'off';
    }

    // ---- problem templates ----
    // each returns { system, tag, tagClass, prompt, givens:[[k,v]], asks:[{label,kind,value,working:[..],hint}], soWhat }
    var TEMPLATES = [
      function socialFeed() {
        var dau = pick([5e7, 1e8, 2e8]), opens = pick([4, 5, 6]), foll = pick([100, 200, 300]);
        var reads = dau * opens, writes = dau * 0.5;
        var pRead = reads / DAY * 3, pWrite = writes / DAY * 3, fan = pWrite * foll;
        var stGB = writes * SIZE.rec * STORE_MULT / 1e9;
        return {
          system: 'Social news feed', tag: 'Read-heavy · fan-out', tagClass: 'read',
          prompt: 'Design the home timeline for a social network of ' + human(dau) + ' DAU. Each user opens the feed ' + opens + '× a day and posts about 0.5× a day; the average account has ~' + foll + ' followers. Text posts only. Put numbers on it first.',
          givens: [['DAU', human(dau)], ['Feed opens / user / day', opens], ['Posts / user / day', '0.5'], ['Avg followers', foll], ['Post record', '~1 KB'], ['Peak factor', '×3 (global)']],
          asks: [
            { label: 'Peak feed-open QPS', kind: 'qps', value: pRead, hint: 'opens/day ÷ 1e5 × 3', working: [human(dau) + ' × ' + opens + ' = ' + human(reads) + ' opens/day', human(reads) + ' ÷ 1e5 = ' + fmt(reads / DAY, 'qps') + ' avg', '× 3 peak = ' + fmt(pRead, 'qps')] },
            { label: 'Peak fan-out inserts/s (push)', kind: 'qps', value: fan, hint: 'peak posts/s × followers', working: [human(dau) + ' × 0.5 = ' + human(writes) + ' posts/day', human(writes) + ' ÷ 1e5 × 3 = ' + fmt(pWrite, 'qps') + ' peak posts', '× ' + foll + ' followers = ' + fmt(fan, 'qps') + ' inserts/s'] },
            { label: 'New post storage / day', kind: 'gb', value: stGB, hint: 'posts/day × 1 KB × 5', working: [human(writes) + ' posts × 1 KB = ' + fmt(writes * SIZE.rec / 1e9, 'gb') + ' logical', '× 5 (replication + overhead) = ' + fmt(stGB, 'gb')] }
          ],
          soWhat: 'Posts are rare, reads incessant. The ' + fmt(fan, 'qps') + ' fan-out is the whole design — and one celebrity breaks pure push. Storage is a rounding error; this is a traffic problem in a storage costume.'
        };
      },
      function chat() {
        var dau = pick([1e8, 3e8, 5e8]), msgs = pick([40, 50, 60]);
        var sends = dau * msgs, pSend = sends / DAY * 3, conc = dau * 0.1, ws = conc / 1e5;
        var stGB = sends * SIZE.rec * STORE_MULT / 1e9;
        return {
          system: 'Chat / messaging', tag: 'Write-heavy · realtime', tagClass: 'write',
          prompt: 'Design a WhatsApp-scale messaging backend: ' + human(dau) + ' DAU, each sending ~' + msgs + ' messages a day over persistent connections. Size the realtime path.',
          givens: [['DAU', human(dau)], ['Messages / user / day', msgs], ['Message', '~1 KB'], ['Peak concurrent', '10% of DAU'], ['WebSockets / box', '100k'], ['Peak factor', '×3']],
          asks: [
            { label: 'Peak messages/s', kind: 'qps', value: pSend, hint: 'msgs/day ÷ 1e5 × 3', working: [human(dau) + ' × ' + msgs + ' = ' + human(sends) + ' msgs/day', '÷ 1e5 = ' + fmt(sends / DAY, 'qps') + ' avg × 3 = ' + fmt(pSend, 'qps')] },
            { label: 'Peak concurrent connections', kind: 'count', value: conc, hint: '10% of DAU', working: [human(dau) + ' × 10% = ' + fmt(conc, 'count') + ' live sockets'] },
            { label: 'Connection-gateway boxes', kind: 'count', value: ws, hint: 'connections ÷ 100k/box', working: [fmt(conc, 'count') + ' ÷ 100k per box = ' + fmt(ws, 'count') + ' boxes'] }
          ],
          soWhat: 'Chat is ~1:1 read:write, so throughput and the ' + fmt(conc, 'count') + ' live connections dominate — the gateway fleet, not storage, is the system.'
        };
      },
      function video() {
        var dau = pick([1e8, 2e8]), views = pick([3, 5]), mins = pick([5, 10]);
        var v = dau * views, egB = v * mins * SIZE.videoMin, egMBs = egB / DAY / 1e6;
        var egTBmo = egB * 30 / 1e12, costCdn = egTBmo * COST.cdnTB;
        return {
          system: 'Video streaming', tag: 'Media · egress', tagClass: 'media',
          prompt: 'Design the delivery path for a video platform: ' + human(dau) + ' DAU, each watching ~' + views + ' videos a day averaging ' + mins + ' minutes. 1080p ≈ 50 MB/min. Where does the money go?',
          givens: [['DAU', human(dau)], ['Views / user / day', views], ['Avg minutes / view', mins], ['1080p stream', '~50 MB/min'], ['CDN egress', '~$30 / TB'], ['Peak factor', '×3']],
          asks: [
            { label: 'Average egress bandwidth', kind: 'mbps', value: egMBs, hint: 'egress bytes/day ÷ 1e5', working: [human(v) + ' views × ' + mins + ' min × 50 MB = ' + fmt(egB / 1e6, 'mbps').replace('/s', '') + ' /day', '÷ 1e5 s = ' + fmt(egMBs, 'mbps') + ' average'] },
            { label: 'Peak egress bandwidth', kind: 'mbps', value: egMBs * 3, hint: '× 3 peak', working: [fmt(egMBs, 'mbps') + ' × 3 = ' + fmt(egMBs * 3, 'mbps')] },
            { label: 'Monthly egress cost (via CDN)', kind: 'money', value: costCdn, hint: 'TB/month × $30', working: [human(v) + ' × ' + mins + ' × 50 MB × 30 days = ' + fmt(egTBmo, 'gb').replace('GB', 'TB').replace('PB', 'PB') + '/mo', '× $30/TB = ' + fmt(costCdn, 'money')] }
          ],
          soWhat: 'Traffic and storage are noise; ' + fmt(egMBs * 3, 'mbps') + ' of peak egress — ' + fmt(costCdn, 'money') + ' even through a CDN — IS the system. All engineering goes on the delivery path.'
        };
      },
      function rideHailing() {
        var drivers = pick([1e5, 5e5, 1e6]), iv = pick([4, 5]);
        var ups = drivers / iv, ingMBs = ups * SIZE.loc / 1e6, stGB = ups * DAY * SIZE.loc * STORE_MULT / 1e9;
        return {
          system: 'Ride-hailing locations', tag: 'Write-heavy · realtime', tagClass: 'write',
          prompt: 'Design the location-ingest pipeline for a ride-hailing app in one large region: ' + human(drivers) + ' drivers online, each pinging GPS every ' + iv + ' seconds (~100 B per ping).',
          givens: [['Active drivers', human(drivers)], ['Ping interval', iv + ' s'], ['Location ping', '~100 B'], ['Retention', '1 day of raw'], ['Storage mult', '×5']],
          asks: [
            { label: 'Location updates/s', kind: 'qps', value: ups, hint: 'drivers ÷ interval', working: [human(drivers) + ' ÷ ' + iv + ' s = ' + fmt(ups, 'qps')] },
            { label: 'Ingest bandwidth', kind: 'mbps', value: ingMBs, hint: 'updates/s × 100 B', working: [fmt(ups, 'qps') + ' × 100 B = ' + fmt(ingMBs, 'mbps')] },
            { label: 'Raw storage / day', kind: 'gb', value: stGB, hint: 'updates/s × 1e5 × 100 B × 5', working: [fmt(ups, 'qps') + ' × 1e5 s = ' + human(ups * DAY) + ' pings/day', '× 100 B × 5 = ' + fmt(stGB, 'gb')] }
          ],
          soWhat: 'A steady ' + fmt(ups, 'qps') + ' write firehose of tiny objects — this is a streaming-ingest and geo-index problem, not a QPS-of-requests one.'
        };
      },
      function urlShortener() {
        var writes = pick([1e7, 5e7, 1e8]), reads = writes * 100;
        var pRead = reads / DAY * 3, pWrite = writes / DAY * 3;
        var stGByr = writes * (SIZE.url * 5) * STORE_MULT / 1e9 * 365;
        return {
          system: 'URL shortener', tag: 'Read-heavy · tiny objects', tagClass: 'read',
          prompt: 'Design a URL shortener creating ' + human(writes) + ' new links a day, read at the canonical 100:1 ratio. Each record ~500 B.',
          givens: [['New links / day', human(writes)], ['Read : write', '100 : 1'], ['Record', '~500 B'], ['Retention', 'multi-year'], ['Peak factor', '×3']],
          asks: [
            { label: 'Peak redirect QPS', kind: 'qps', value: pRead, hint: 'reads/day ÷ 1e5 × 3', working: [human(writes) + ' × 100 = ' + human(reads) + ' reads/day', '÷ 1e5 × 3 = ' + fmt(pRead, 'qps')] },
            { label: 'Peak write QPS', kind: 'qps', value: pWrite, hint: 'writes/day ÷ 1e5 × 3', working: [human(writes) + ' ÷ 1e5 × 3 = ' + fmt(pWrite, 'qps')] },
            { label: 'Storage / year', kind: 'gb', value: stGByr, hint: 'writes/day × 500 B × 5 × 365', working: [human(writes) + ' × 500 B × 5 = ' + fmt(writes * SIZE.url * 5 * STORE_MULT / 1e9, 'gb') + '/day', '× 365 = ' + fmt(stGByr, 'gb')] }
          ],
          soWhat: 'A ' + fmt(pRead, 'qps') + ' read tier of trivial lookups over tiny rows — pure cache-and-replica territory. Writes and storage barely register.'
        };
      },
      function iot() {
        var dev = pick([1e6, 1e7, 5e7]), perMin = pick([1, 2]);
        var wps = dev * perMin / 60, wday = dev * perMin * 1440;
        var stGB = wday * 200 * STORE_MULT / 1e9, nodes = wps / NOSQL_W;
        return {
          system: 'IoT telemetry', tag: 'Write-heavy · firehose', tagClass: 'write',
          prompt: 'Design ingestion for ' + human(dev) + ' IoT sensors, each emitting ' + perMin + ' reading(s) per minute (~200 B each). Size the write path.',
          givens: [['Devices', human(dev)], ['Readings / device / min', perMin], ['Reading', '~200 B'], ['LSM write ceiling', '10k/s/node'], ['Storage mult', '×5']],
          asks: [
            { label: 'Ingest writes/s', kind: 'qps', value: wps, hint: 'devices × per-min ÷ 60', working: [human(dev) + ' × ' + perMin + ' ÷ 60 s = ' + fmt(wps, 'qps')] },
            { label: 'Raw storage / day', kind: 'gb', value: stGB, hint: 'writes/day × 200 B × 5', working: [human(wday) + ' writes/day × 200 B × 5 = ' + fmt(stGB, 'gb')] },
            { label: 'LSM write nodes', kind: 'count', value: nodes, hint: 'writes/s ÷ 10k', working: [fmt(wps, 'qps') + ' ÷ 10k/node = ' + fmt(nodes, 'count') + ' nodes'] }
          ],
          soWhat: 'A relentless ' + fmt(wps, 'qps') + ' of small writes — an LSM store (Cassandra-class), not SQL, and time-based retention to keep the ' + fmt(stGB, 'gb') + '/day from becoming a wall.'
        };
      },
      function flashSale() {
        var dau = pick([1e7, 3e7, 5e7]), calls = pick([15, 20]);
        var base = dau * calls / DAY, peak = base * 10, boxes = peak / SRV.typical / UTIL;
        return {
          system: 'E-commerce flash sale', tag: 'Event spike · ×10', tagClass: 'event',
          prompt: 'Size the API tier for a shopping app of ' + human(dau) + ' DAU (~' + calls + ' calls each) during a flash sale that compresses traffic into minutes — an event peak of ×10.',
          givens: [['DAU', human(dau)], ['API calls / user / day', calls], ['Work class', 'typical (1k QPS/box)'], ['Utilization', '60%'], ['Peak factor', '×10 (event)']],
          asks: [
            { label: 'Average QPS', kind: 'qps', value: base, hint: 'calls/day ÷ 1e5', working: [human(dau) + ' × ' + calls + ' = ' + human(dau * calls) + '/day', '÷ 1e5 = ' + fmt(base, 'qps')] },
            { label: 'Peak QPS (sale)', kind: 'qps', value: peak, hint: '× 10 event', working: [fmt(base, 'qps') + ' × 10 = ' + fmt(peak, 'qps')] },
            { label: 'API boxes at peak', kind: 'count', value: boxes, hint: 'peak ÷ 1k ÷ 0.6', working: [fmt(peak, 'qps') + ' ÷ 1k/box ÷ 0.6 = ' + fmt(boxes, 'count') + ' boxes'] }
          ],
          soWhat: 'The ×10 event factor — not the average — sizes the fleet at ' + fmt(boxes, 'count') + ' boxes. Provision for the spike or autoscale ahead of it; the average is a lie during a sale.'
        };
      },
      function photo() {
        var dau = pick([5e7, 1e8]), up = pick([0.5, 1]);
        var uploads = dau * up, pUp = uploads / DAY * 3;
        var stGBday = uploads * SIZE.photo4 * BLOB_MULT / 1e9, costMo = stGBday * 30 / 1000 * COST.storeTB;
        return {
          system: 'Photo sharing', tag: 'Media · storage growth', tagClass: 'media',
          prompt: 'Design storage for a photo app: ' + human(dau) + ' DAU uploading ' + up + ' photo(s) a day. Each photo plus its variants is ~4 MB; blob store overhead ×1.5.',
          givens: [['DAU', human(dau)], ['Uploads / user / day', up], ['Photo + variants', '~4 MB'], ['Blob overhead', '×1.5'], ['Object storage', '$20 / TB-mo']],
          asks: [
            { label: 'Peak upload QPS', kind: 'qps', value: pUp, hint: 'uploads/day ÷ 1e5 × 3', working: [human(uploads) + ' uploads/day ÷ 1e5 × 3 = ' + fmt(pUp, 'qps')] },
            { label: 'Storage / day', kind: 'gb', value: stGBday, hint: 'uploads × 4 MB × 1.5', working: [human(uploads) + ' × 4 MB × 1.5 = ' + fmt(stGBday, 'gb')] },
            { label: 'Added storage cost / month', kind: 'money', value: costMo, hint: 'TB added × $20', working: [fmt(stGBday, 'gb') + '/day × 30 = ' + fmt(stGBday * 30, 'gb'), '× $20/TB = ' + fmt(costMo, 'money')] }
          ],
          soWhat: 'Media makes storage the story: ' + fmt(stGBday, 'gb') + '/day compounding. The thumbnail/variant policy and CDN offload are where the real levers are.'
        };
      }
    ];

    // ---- state ----
    var stats = load();
    var current = null;

    function load() {
      try { return JSON.parse(localStorage.getItem('ei_arena') || '') || {}; }
      catch (e) { return {}; }
      finally { }
    }
    function save() { try { localStorage.setItem('ei_arena', JSON.stringify(stats)); } catch (e) { } }
    stats.attempts = stats.attempts || 0;
    stats.spot = stats.spot || 0;
    stats.streak = stats.streak || 0;
    stats.best = stats.best || 0;

    // ---- render ----
    function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
    function esc(s) { return ('' + s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    function newProblem() {
      current = pick(TEMPLATES)();
      draw();
    }

    function draw() {
      var p = current;
      var givens = p.givens.map(function (g) { return '<div class="pa-given"><span>' + esc(g[0]) + '</span><b>' + esc(g[1]) + '</b></div>'; }).join('');
      var asks = p.asks.map(function (a, i) {
        var ld = LADDER(a.kind);
        var opts = ld.map(function (u) { return '<option value="' + u[1] + '">' + (u[0] || '×1') + '</option>'; }).join('');
        var hasUnit = ld.length > 1;
        return '<div class="pa-ask" data-i="' + i + '">' +
          '<label>' + esc(a.label) + '</label>' +
          '<div class="pa-inrow">' +
          '<input type="text" inputmode="decimal" class="pa-input" placeholder="your estimate…" autocomplete="off">' +
          (hasUnit ? '<select class="pa-unit">' + opts + '</select>' : '<span class="pa-unit-fixed">' + (ld[0][0] || '') + '</span>') +
          '</div>' +
          '<div class="pa-hint">hint: ' + esc(a.hint) + '</div>' +
          '<div class="pa-verdict" hidden></div>' +
          '</div>';
      }).join('');

      mount.innerHTML = '';
      mount.appendChild(el(
        '<div class="pa">' +
        '<div class="pa-top">' +
        '<div class="pa-tag pa-' + p.tagClass + '">' + esc(p.tag) + '</div>' +
        '<div class="pa-score">🎯 <b>' + stats.spot + '</b>/' + stats.attempts + ' · 🔥 streak <b>' + stats.streak + '</b> · best ' + stats.best + '</div>' +
        '</div>' +
        '<h3 class="pa-system">' + esc(p.system) + '</h3>' +
        '<p class="pa-prompt">' + esc(p.prompt) + '</p>' +
        '<div class="pa-givens">' + givens + '</div>' +
        '<p class="pa-instruct">Estimate each out loud, <em>then</em> type it. Order-of-magnitude is the game.</p>' +
        '<div class="pa-asks">' + asks + '</div>' +
        '<div class="pa-btns">' +
        '<button class="pa-reveal">Reveal &amp; grade</button>' +
        '<button class="pa-next" hidden>New problem →</button>' +
        '</div>' +
        '<div class="pa-sowhat" hidden></div>' +
        '</div>'
      ));

      mount.querySelector('.pa-reveal').addEventListener('click', reveal);
      var nx = mount.querySelector('.pa-next');
      nx.addEventListener('click', newProblem);
      // Enter key on last input reveals
      var inputs = mount.querySelectorAll('.pa-input');
      inputs.forEach(function (inp, idx) {
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { if (idx < inputs.length - 1) inputs[idx + 1].focus(); else reveal(); }
        });
      });
      if (inputs[0]) inputs[0].focus();
    }

    function reveal() {
      var p = current, allSpot = true, answered = false;
      var rows = mount.querySelectorAll('.pa-ask');
      rows.forEach(function (row, i) {
        var a = p.asks[i];
        var inp = row.querySelector('.pa-input');
        var unitSel = row.querySelector('.pa-unit');
        var factor = unitSel ? parseFloat(unitSel.value) : 1;
        var raw = parseHuman(inp.value);
        var userBase = raw * factor;
        var g = grade(userBase, a.value);
        if (g !== 'none') answered = true;
        if (g !== 'spot') allSpot = false;
        var badge = g === 'spot' ? '<span class="pa-b pa-spot">✓ spot on</span>'
          : g === 'close' ? '<span class="pa-b pa-close">≈ within 10×</span>'
          : g === 'off' ? '<span class="pa-b pa-off">✗ off by >10×</span>'
          : '<span class="pa-b pa-skip">— skipped</span>';
        var v = row.querySelector('.pa-verdict');
        v.hidden = false;
        v.innerHTML = badge +
          '<div class="pa-answer">answer: <b>' + fmt(a.value, a.kind) + '</b>' +
          (g !== 'none' ? ' <span class="pa-yours">(you: ' + (isFinite(userBase) ? fmt(userBase, a.kind) : '—') + ')</span>' : '') + '</div>' +
          '<pre class="pa-working">' + a.working.map(esc).join('\n') + '</pre>';
        inp.disabled = true; if (unitSel) unitSel.disabled = true;
      });

      // scoring: a problem counts once; "spot" if every answered ask is spot-on
      stats.attempts += 1;
      if (answered && allSpot) { stats.spot += 1; stats.streak += 1; if (stats.streak > stats.best) stats.best = stats.streak; }
      else { stats.streak = 0; }
      save();

      var sw = mount.querySelector('.pa-sowhat');
      sw.hidden = false;
      sw.innerHTML = '<b>So what —</b> ' + esc(p.soWhat) +
        '<div class="pa-say">🎤 Now say the whole estimate aloud, one breath, before the next one.</div>';
      mount.querySelector('.pa-reveal').hidden = true;
      mount.querySelector('.pa-next').hidden = false;
      mount.querySelector('.pa-score').innerHTML = '🎯 <b>' + stats.spot + '</b>/' + stats.attempts + ' · 🔥 streak <b>' + stats.streak + '</b> · best ' + stats.best;
      mount.querySelector('.pa-next').focus();
    }

    newProblem();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
