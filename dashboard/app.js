// Token Launch Radar — renders window.RADAR (written by main.ts) with no network.
// Views: #/ board, #/detail/<slug> detail, #/live live tokens, #/model the model.
// Board filters ride in the hash query: #/?category=Lending&chain=Ethereum&q=us&watchlist=1&sort=tvl
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) {
    document.getElementById('meta').textContent = 'No radar data: run main.ts first.';
    return;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function usd(n) {
    if (n == null || !isFinite(n)) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function usdFull(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function pct(n) {
    if (n == null || !isFinite(n)) return '—';
    var v = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + (n > 0 ? 'up' : n < 0 ? 'down' : '') + '">' + v + '</span>';
  }
  function age(n) {
    if (n == null) return '—';
    if (n >= 365) return (n / 365).toFixed(1) + 'y';
    return n + 'd';
  }

  var $ = function (id) { return document.getElementById(id); };
  var rowsBySlug = {};
  R.rows.forEach(function (r) { rowsBySlug[r.slug] = r; });

  // ---- header / footer -----------------------------------------------------
  $('meta').innerHTML =
    '<strong>' + R.board_size + ' protocols ranked</strong> · ' + R.watchlist_size +
    ' on the watchlist · ' + R.live_size + ' live tokens set aside · snapshot ' +
    esc(R.as_of) + ' · model ' + esc(R.model_version);
  $('asof').textContent = R.as_of;
  $('model-version').textContent = R.model_version;

  // ---- filter controls -----------------------------------------------------
  var categories = [];
  var chains = [];
  R.rows.forEach(function (r) {
    if (r.category && categories.indexOf(r.category) < 0) categories.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  categories.sort();
  chains.sort();
  categories.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('category').appendChild(o);
  });
  chains.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('chain').appendChild(o);
  });

  function parseHash() {
    var h = location.hash || '#/';
    var rest = h.slice(2);
    var qi = rest.indexOf('?');
    var route = qi < 0 ? rest : rest.slice(0, qi);
    var query = {};
    if (qi >= 0) {
      rest.slice(qi + 1).split('&').forEach(function (pair) {
        var kv = pair.split('=');
        if (kv[0]) query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    return { route: route, query: query };
  }

  function boardQuery() {
    var q = parseHash().query;
    return {
      q: q.q || '',
      category: q.category || '',
      chain: q.chain || '',
      watchlist: q.watchlist === '1',
      sort: q.sort || 'rank',
    };
  }

  function setHashQuery(patch) {
    var cur = boardQuery();
    var next = {
      q: patch.q !== undefined ? patch.q : cur.q,
      category: patch.category !== undefined ? patch.category : cur.category,
      chain: patch.chain !== undefined ? patch.chain : cur.chain,
      watchlist: patch.watchlist !== undefined ? patch.watchlist : cur.watchlist,
      sort: patch.sort !== undefined ? patch.sort : cur.sort,
    };
    var parts = [];
    if (next.q) parts.push('q=' + encodeURIComponent(next.q));
    if (next.category) parts.push('category=' + encodeURIComponent(next.category));
    if (next.chain) parts.push('chain=' + encodeURIComponent(next.chain));
    if (next.watchlist) parts.push('watchlist=1');
    if (next.sort && next.sort !== 'rank') parts.push('sort=' + encodeURIComponent(next.sort));
    location.hash = '#/' + (parts.length ? '?' + parts.join('&') : '');
  }

  function filteredRows() {
    var f = boardQuery();
    var out = R.rows.filter(function (r) {
      if (f.watchlist && !r.watchlist) return false;
      if (f.category && r.category !== f.category) return false;
      if (f.chain && r.chains.indexOf(f.chain) < 0) return false;
      if (f.q) {
        var needle = f.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(needle) < 0 && r.slug.toLowerCase().indexOf(needle) < 0) return false;
      }
      return true;
    });
    var sorters = {
      rank: function (a, b) { return a.rank - b.rank; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
    };
    out.sort(sorters[f.sort] || sorters.rank);
    return out;
  }

  function rowHtml(r) {
    return '<tr data-slug="' + esc(r.slug) + '">' +
      '<td class="rank">' + r.rank + '</td>' +
      '<td class="name">' + esc(r.name) + (r.watchlist ? '<span class="badge">Watchlist</span>' : '') + '</td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td>' + esc(r.chains.slice(0, 3).join(', ') || '—') + '</td>' +
      '<td class="num">' + usd(r.tvl_usd) + '</td>' +
      '<td class="num">' + pct(r.change_7d) + '</td>' +
      '<td class="num">' + age(r.age_days) + '</td>' +
      '<td class="num"><strong>' + usd(r.implied_value_usd) + '</strong></td>' +
      '</tr>';
  }

  function renderBoard() {
    var f = boardQuery();
    $('q').value = f.q;
    $('category').value = f.category;
    $('chain').value = f.chain;
    $('watchlist').checked = f.watchlist;
    $('sort').value = f.sort;
    var list = filteredRows();
    $('count').textContent = list.length + ' of ' + R.board_size + ' ranked protocols shown';
    $('rows').innerHTML = list.map(rowHtml).join('');
  }

  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) location.hash = '#/detail/' + tr.getAttribute('data-slug');
  });
  $('q').addEventListener('input', function () { setHashQuery({ q: $('q').value }); });
  $('category').addEventListener('change', function () { setHashQuery({ category: $('category').value }); });
  $('chain').addEventListener('change', function () { setHashQuery({ chain: $('chain').value }); });
  $('watchlist').addEventListener('change', function () { setHashQuery({ watchlist: $('watchlist').checked }); });
  $('sort').addEventListener('change', function () { setHashQuery({ sort: $('sort').value }); });
  document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () { setHashQuery({ sort: th.getAttribute('data-sort') }); });
  });

  // ---- detail view ---------------------------------------------------------
  function renderDetail(slug) {
    var r = rowsBySlug[slug];
    if (!r) {
      $('detail').innerHTML = '<h2>Not on the board</h2><p class="lede">No ranked protocol has the slug ' + esc(slug) + '.</p>';
      return;
    }
    var steps = r.farm_steps.map(function (s) {
      var m = s.match(/^(.*?) Cost: (.*?)\. Time: (.*?)\.?$/);
      var text = m ? m[1] : s;
      var cost = m ? m[2] : '';
      var time = m ? m[3] : '';
      return '<li>' + esc(text) + '<div class="cost">Cost: ' + esc(cost) + ' · Time: ' + esc(time) + '</div></li>';
    }).join('');
    $('detail').innerHTML =
      '<div class="detail"><h2>' + esc(r.name) + '</h2>' +
      '<p class="sub">Rank #' + r.rank + ' · ' + esc(r.category || 'no category') + ' · ' +
      esc(r.chains.join(', ') || 'no chain listed') +
      (r.watchlist ? ' · <span class="badge">Watchlist</span>' : '') +
      ' · <span class="badge">Records no token</span></p>' +
      '<div class="facts">' +
      '<div class="fact"><div class="k">Implied value</div><div class="v">' + usd(r.implied_value_usd) + '</div></div>' +
      '<div class="fact"><div class="k">TVL</div><div class="v">' + usd(r.tvl_usd) + '</div></div>' +
      '<div class="fact"><div class="k">7-day change</div><div class="v">' + (r.change_7d == null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</div></div>' +
      '<div class="fact"><div class="k">Listed</div><div class="v">' + esc(r.listed_at || '—') + '</div></div>' +
      '<div class="fact"><div class="k">Age</div><div class="v">' + age(r.age_days) + '</div></div>' +
      '</div>' +
      '<h3>How the value is built</h3>' +
      '<div class="tablewrap"><table class="model-table"><tbody>' +
      '<tr><td>TVL</td><td class="num">' + usdFull(r.tvl_usd) + '</td></tr>' +
      '<tr><td>Category multiple (' + esc(r.category || 'no category') + ')</td><td class="num">&times; ' + r.category_multiple.toFixed(3) + '</td></tr>' +
      '<tr><td>Growth multiplier</td><td class="num">&times; ' + r.growth_multiplier.toFixed(3) + '</td></tr>' +
      '<tr><td>Maturity multiplier</td><td class="num">&times; ' + r.maturity_multiplier.toFixed(3) + '</td></tr>' +
      '<tr><td>Breadth multiplier (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')</td><td class="num">&times; ' + r.breadth_multiplier.toFixed(3) + '</td></tr>' +
      '<tr><td><strong>Implied value</strong></td><td class="num"><strong>' + usdFull(r.implied_value_usd) + '</strong></td></tr>' +
      '</tbody></table></div>' +
      '<h3>Farm plan</h3><ol class="steps">' + steps + '</ol></div>';
  }

  // ---- live view -----------------------------------------------------------
  function renderLive() {
    $('live-rows').innerHTML = R.live.map(function (p) {
      return '<tr><td class="name">' + esc(p.name) + '<span class="badge live">Live token</span></td>' +
        '<td>' + esc(p.category || '—') + '</td>' +
        '<td>' + esc(p.chains.slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + usd(p.tvl_usd) + '</td>' +
        '<td class="num"><strong>' + usd(p.mcap_usd) + '</strong></td>' +
        '<td class="num">' + pct(p.change_7d) + '</td></tr>';
    }).join('');
  }

  // ---- model view ----------------------------------------------------------
  function renderModel() {
    var cats = Object.keys(R.multiples).sort(function (a, b) {
      return R.multiples[b].multiple - R.multiples[a].multiple;
    });
    $('multiples').innerHTML = cats.map(function (c) {
      var m = R.multiples[c];
      return '<tr><td>' + esc(c) + '</td><td class="num">&times; ' + m.multiple.toFixed(3) + '</td>' +
        '<td class="num">' + m.samples + '</td></tr>';
    }).join('') +
    '<tr><td><strong>Global fallback</strong> (categories with fewer than 3 live samples)</td>' +
    '<td class="num"><strong>&times; ' + R.global_multiple.toFixed(3) + '</strong></td><td class="num">—</td></tr>';
  }

  // ---- routing -------------------------------------------------------------
  function show(view) {
    ['board', 'detail', 'live', 'model'].forEach(function (v) {
      $('view-' + v).hidden = v !== view;
    });
    document.querySelectorAll('#tabs a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-view') === (view === 'detail' ? 'board' : view));
    });
  }

  function route() {
    var parsed = parseHash();
    var parts = parsed.route.split('/').filter(Boolean);
    if (parts[0] === 'detail' && parts[1]) {
      show('detail');
      renderDetail(decodeURIComponent(parts[1]));
    } else if (parts[0] === 'live') {
      show('live');
      renderLive();
    } else if (parts[0] === 'model') {
      show('model');
      renderModel();
    } else {
      show('board');
      renderBoard();
    }
  }

  window.addEventListener('hashchange', route);
  route();
})();
