// Gaming-News für Shadepi: liest die RSS-/Atom-Feeds großer Spieleseiten, sammelt sie in
// einer lokalen Datenbank (userData/news.json, bis zu 400 Meldungen) und gibt die neuesten
// an das Overlay weiter. Ohne Abhängigkeiten: einfacher, toleranter Feed-Parser.
'use strict';
const fs = require('fs');
const path = require('path');

const FEEDS = {
  de: [
    { id: 'meinmmo', name: 'Mein-MMO', url: 'https://mein-mmo.de/feed/' },
    { id: 'pcgames', name: 'PC Games', url: 'https://www.pcgames.de/feed.cfm?menu_alias=home/' },
    { id: 'gamestar', name: 'GameStar', url: 'https://www.gamestar.de/news/rss/news.rss' },
    { id: 'gamepro', name: 'GamePro', url: 'https://www.gamepro.de/rss/gpnews.rss' },
    { id: 'pcgh', name: 'PCGH', url: 'https://www.pcgameshardware.de/feed.cfm?menu_alias=home/' },
    { id: 'gamereactor', name: 'Gamereactor', url: 'https://www.gamereactor.de/rss/rss.php' },
  ],
  en: [
    { id: 'pcgamer', name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/' },
    { id: 'ign', name: 'IGN', url: 'https://feeds.feedburner.com/ign/all' },
    { id: 'polygon', name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml' },
    { id: 'kotaku', name: 'Kotaku', url: 'https://kotaku.com/rss' },
    { id: 'rps', name: 'Rock Paper Shotgun', url: 'https://www.rockpapershotgun.com/feed/' },
    { id: 'eurogamer', name: 'Eurogamer', url: 'https://www.eurogamer.net/feed' },
  ],
};

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', eacute: 'é', egrave: 'è' };
function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (n in ENT ? ENT[n] : m));
}
function text(s) {
  // Zweimal dekodieren (manche Feeds kodieren HTML doppelt), dann Tags und Leerraum entfernen
  return decode(decode(s).replace(/<[^>]*>/g, ' ')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
function attr(block, name, a) {
  const m = block.match(new RegExp(`<${name}\\s[^>]*${a}=["']([^"']+)["']`, 'i'));
  return m ? decode(m[1]) : '';
}

function parseFeed(xml, feed) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks.slice(0, 40)) {
    const title = text(tag(b, 'title'));
    let link = text(tag(b, 'link')) || attr(b, 'link', 'href');
    if (!/^https?:\/\//i.test(link)) link = attr(b, 'link', 'href');
    const date = Date.parse(text(tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date'))) || Date.now();
    let teaser = text(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'));
    if (teaser.length > 240) teaser = teaser.slice(0, 236).replace(/\s+\S*$/, '') + ' …';
    if (!title || !/^https?:\/\//i.test(link)) continue;
    items.push({ id: link.replace(/[?#].*$/, ''), title: title.slice(0, 220), teaser, link, date, source: feed.name, src: feed.id });
  }
  return items;
}

class News {
  constructor(dir, log, fetchImpl) {
    // Im Programm Chromiums Netzwerk (electron net.fetch): wird von Seiten wie ein Browser behandelt
    this.fetch = fetchImpl || ((...a) => fetch(...a));
    this.file = path.join(dir, 'news.json');
    this.log = log || (() => {});
    this.items = [];
    this.status = {};
    this.lang = 'de';
    this.timer = null;
    this.onUpdate = null;
    this.busy = false;
    try { const d = JSON.parse(fs.readFileSync(this.file, 'utf8')); this.items = d.items || []; this.status = d.status || {}; } catch (_) {}
  }

  feeds() { return this.lang === 'beide' ? [...FEEDS.de, ...FEEDS.en] : FEEDS[this.lang] || FEEDS.de; }

  start(lang, everyMin = 30) {
    this.lang = lang || 'de';
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refresh(), everyMin * 60 * 1000);
    setTimeout(() => this.refresh(), 6000);
  }
  stop() { clearInterval(this.timer); this.timer = null; }
  setLang(lang) { if (lang !== this.lang) { this.lang = lang; this.refresh(); } }

  async fetchFeed(feed) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await this.fetch(feed.url, { signal: ctrl.signal, redirect: 'follow', headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5', 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const xml = await res.text();
      const items = parseFeed(xml, feed);
      this.status[feed.id] = { ok: true, n: items.length, at: Date.now() };
      return items;
    } catch (e) {
      this.status[feed.id] = { ok: false, err: String(e.message || e).slice(0, 80), at: Date.now() };
      return [];
    } finally { clearTimeout(t); }
  }

  async refresh() {
    if (this.busy || this.paused) return;
    this.busy = true;
    try {
      const lists = await Promise.all(this.feeds().map((f) => this.fetchFeed(f)));
      const byId = new Map(this.items.map((i) => [i.id, i]));
      let fresh = 0;
      for (const list of lists) for (const it of list) if (!byId.has(it.id)) { byId.set(it.id, it); fresh++; }
      const weekAgo = Date.now() - 14 * 24 * 3600 * 1000;
      this.items = [...byId.values()].filter((i) => i.date > weekAgo).sort((a, b) => b.date - a.date).slice(0, 400);
      try { fs.writeFileSync(this.file, JSON.stringify({ items: this.items, status: this.status })); } catch (_) {}
      const okFeeds = Object.entries(this.status).filter(([, s]) => s.ok).map(([k]) => k);
      this.log(`News: ${fresh} neu, ${this.items.length} gesamt, Quellen ok: ${okFeeds.join(', ') || 'keine'}`);
      if (this.onUpdate) this.onUpdate(this.payload());
    } finally { this.busy = false; }
  }

  payload() {
    const ids = new Set(this.feeds().map((f) => f.id));
    return {
      items: this.items.filter((i) => ids.has(i.src)).slice(0, 80),
      total: this.items.length,
      sources: this.feeds().map((f) => ({ id: f.id, name: f.name, ...(this.status[f.id] || {}) })),
    };
  }
}

module.exports = { News, parseFeed, FEEDS };
