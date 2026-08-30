/* ============================================================
   starmap.js — la wiki come mappa stellare.

   Tecnica e look derivati da Fathom Starmap (MIT, © 2026 Ariel Bowyer)
   https://github.com/dryweather-2544/fathom-starmap
   Adattati qui a una wiki markdown statica: le note diventano pagine, le
   cartelle costellazioni, i wikilink fili di luce. Canvas 2D, zero dipendenze.
   ============================================================ */
(function (global) {
  "use strict";

  // ─────────────────────────────────────────────── costanti ──

  const FOCAL = 900;          // lunghezza focale della camera
  const F2 = FOCAL / 0.9;     // focale in modalità volo
  const DAMP = 0.86;          // smorzamento della velocità per passo
  const ZMIN = 0.05, ZMAX = 14;

  const BACKDROP_COUNT = 240;
  const BACKDROP_RMIN = 1700, BACKDROP_RRANGE = 1200;

  // quante etichette per livello di importanza possono stare a schermo
  const TIERCAP = [0, 12, 14, 12];

  const SHAPES = ["natural", "spiral", "disc", "ring", "shell", "helix", "torus", "clusters", "cube"];

  const DEFAULTS = {
    repel: 1500, spring: 0.022, len: 105, center: 0.00016, heat: 0,
    warp: 0, spin: 1, zoomV: 1,
    stars: 1, nebula: 1, dust: 1, names: 1, nameSize: 1, links: 1, hole: 1,
    shape: "natural", thrust: 1,
  };

  /* Hash deterministico: stessa nebulosa a ogni caricamento. */
  function hash(a, b) {
    const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [140, 150, 170];
  }
  const rgbStr = (hex) => hexToRgb(hex).join(",");

  /* Inviluppo convesso (monotone chain di Andrew): il contorno di una costellazione. */
  function hull(pts) {
    if (pts.length < 3) return null;
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
      lo.push(p);
    }
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
      up.push(p);
    }
    lo.pop(); up.pop();
    return lo.concat(up);
  }

  // ─────────────────────────────────────────────── il motore ──

  function Starmap(opts) {
    this.host = opts.host;
    this.onSelect = opts.onSelect || function () {};
    this.onHover = opts.onHover || function () {};

    this.S = Object.assign({}, DEFAULTS);
    this.nodes = [];
    this.links = [];
    this.fams = {};          // chiave categoria -> {name, color, rgb}
    this.famOrder = [];
    this.famFade = {};       // 0 = accesa, 1 = spenta (quando un'altra è in hover)
    this.hidden = new Set();
    this.solo = null;

    this.cam = { yaw: 0.4, pitch: -0.25, zoom: 1, ctr: { x: 0, y: 0, z: 0 } };
    this.target = { yaw: 0.4, pitch: -0.25, zoom: 1 };
    this.flight = { on: false, pos: { x: 0, y: 0, z: -600 }, vel: { x: 0, y: 0, z: 0 } };

    this.alpha = 1;
    this.hover = -1;
    this.focus = -1;
    this.idleT = 0;
    this.t0 = performance.now();
    this.reduceMotion = global.matchMedia
      && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.time = null;        // {dates, pos, playing} quando il replay è attivo
    this.keys = new Set();
    this.dead = false;

    this._build();
  }

  Starmap.prototype._build = function () {
    const host = this.host;
    host.innerHTML = "";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "sm-canvas";
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    // La nebulosa si disegna a risoluzione ridotta su un canvas separato e poi
    // si riscala: la nebbia è sfocata comunque, e così costa un quarto.
    this.fogCv = document.createElement("canvas");
    this.fogCtx = this.fogCv.getContext("2d");

    this._resize();
    this._bindEvents();
  };

  Starmap.prototype._resize = function () {
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width));
    this.H = Math.max(1, Math.round(r.height));
    this.DPR = Math.min(global.devicePixelRatio || 1, 2);
    this.canvas.width = this.W * this.DPR;
    this.canvas.height = this.H * this.DPR;
    this.canvas.style.width = this.W + "px";
    this.canvas.style.height = this.H + "px";
    this.fogCv.width = Math.max(1, Math.round(this.W * 0.7));
    this.fogCv.height = Math.max(1, Math.round(this.H * 0.7));
  };

  // ────────────────────────────────────────────────── dati ──

  /* pages: [{slug,title,category,links:[slug],created,updated,words,superseded}] */
  Starmap.prototype.setData = function (pages, categories) {
    const idx = new Map();
    this.nodes = pages.map((p, i) => {
      idx.set(p.slug, i);
      const a = hash(i, 1) * 6.283, b = hash(i, 2) * 3.14159, rr = 60 + hash(i, 3) * 90;
      return {
        i, slug: p.slug, title: p.title, fam: p.category,
        created: p.created || null, updated: p.updated || null,
        superseded: !!p.superseded, orphan: !!p.orphan, words: p.words || 0,
        x: Math.cos(a) * Math.sin(b) * rr,
        y: Math.cos(b) * rr * 0.6,
        z: Math.sin(a) * Math.sin(b) * rr,
        vx: 0, vy: 0, vz: 0,
        deg: 1, w: 0, r: 2, nbr: new Set(),
        sx: 0, sy: 0, ss: 1, sd: 0, near: false, nf: 1,
        dim: 0, litE: 0, lblA: 0, lblOn: false, lblTier: 3, alive: 1,
      };
    });

    this.links = [];
    const seen = new Set();
    pages.forEach((p) => {
      (p.links || []).forEach((t) => {
        if (!idx.has(t) || t === p.slug) return;
        const s = idx.get(p.slug), d = idx.get(t);
        const key = s < d ? s + "|" + d : d + "|" + s;
        if (seen.has(key)) return;
        seen.add(key);
        this.links.push({ s: s, t: d, hl: 0, dm: 0 });
        this.nodes[s].nbr.add(d);
        this.nodes[d].nbr.add(s);
      });
    });

    for (const n of this.nodes) {
      n.w = n.nbr.size;
      n.deg = 1 + n.w;
      n.r = 2.1 + Math.sqrt(n.w) * 1.9;
    }

    this.fams = {};
    this.famOrder = [];
    Object.keys(categories || {}).forEach((k) => {
      this.fams[k] = { name: k, color: categories[k], rgb: rgbStr(categories[k]) };
      this.famFade[k] = 0;
      this.famOrder.push(k);
    });
    for (const n of this.nodes) {
      if (!this.fams[n.fam]) {
        this.fams[n.fam] = { name: n.fam, color: "#8792a8", rgb: "135,146,168" };
        this.famFade[n.fam] = 0;
        this.famOrder.push(n.fam);
      }
    }

    this._makePuffs();
    this._makeBackdrop();
    this._order();
    this._makeTimeline();

    this.alpha = 1;
    this.idleT = 0;
    this._autofit = false;
  };

  /* Sprite di nebbia pre-renderizzate, una per costellazione: disegnare un
     gradiente radiale per ogni sbuffo a ogni frame sarebbe insostenibile. */
  Starmap.prototype._makePuffs = function () {
    this.puffs = {};
    this.halos = {};
    for (const k in this.fams) {
      const size = 128;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d");
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      const rgb = this.fams[k].rgb;
      grad.addColorStop(0, "rgba(" + rgb + ",0.85)");
      grad.addColorStop(0.35, "rgba(" + rgb + ",0.30)");
      grad.addColorStop(0.7, "rgba(" + rgb + ",0.07)");
      grad.addColorStop(1, "rgba(" + rgb + ",0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      this.puffs[k] = c;

      // alone della stella: stesso trucco, sfumatura più stretta
      const hs = 96;
      const hc = document.createElement("canvas");
      hc.width = hc.height = hs;
      const hg2 = hc.getContext("2d");
      const hgrad = hg2.createRadialGradient(hs / 2, hs / 2, 0, hs / 2, hs / 2, hs / 2);
      hgrad.addColorStop(0, "rgba(" + rgb + ",1)");
      hgrad.addColorStop(0.18, "rgba(" + rgb + ",0.55)");
      hgrad.addColorStop(0.45, "rgba(" + rgb + ",0.15)");
      hgrad.addColorStop(1, "rgba(" + rgb + ",0)");
      hg2.fillStyle = hgrad;
      hg2.fillRect(0, 0, hs, hs);
      this.halos[k] = hc;
    }
  };

  /* Stelle di sfondo: un guscio fisso di puntini lontani che dà profondità. */
  Starmap.prototype._makeBackdrop = function () {
    this.backdrop = [];
    for (let i = 0; i < BACKDROP_COUNT; i++) {
      const a = hash(i, 7) * 6.283, b = Math.acos(2 * hash(i, 8) - 1);
      const r = BACKDROP_RMIN + hash(i, 9) * BACKDROP_RRANGE;
      this.backdrop.push({
        x: r * Math.sin(b) * Math.cos(a),
        y: r * Math.cos(b),
        z: r * Math.sin(b) * Math.sin(a),
        b: 0.4 + hash(i, 10) * 0.9,
        l: hash(i, 11) > 0.85 ? 2 : 1,
      });
    }
  };

  /* Ordine di disegno fisso: stelle grandi dietro, piccole davanti. Se si
     riordinasse per profondità della camera, i dischi sovrapposti si
     scambierebbero e i colori sfarfallerebbero. */
  Starmap.prototype._order = function () {
    this.ord = this.nodes.map((n) => n.i).sort((a, b) => this.nodes[b].w - this.nodes[a].w);
  };

  Starmap.prototype._makeTimeline = function () {
    const ds = this.nodes.map((n) => n.created).filter(Boolean).sort();
    this.dates = Array.from(new Set(ds));
    this.timePos = this.dates.length ? this.dates.length - 1 : 0;
    this.playing = false;
  };

  // ───────────────────────────────────────────── proiezione ──

  Starmap.prototype.project = function (n) {
    const c = this.cam;
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const W = this.W, H = this.H;

    if (this.flight.on) {
      const p = this.flight.pos;
      const nx = n.x - p.x, ny = n.y - p.y, nz = n.z - p.z;
      let x = nx * cy + nz * sy, z = -nx * sy + nz * cy;
      const y = ny * cp - z * sp;
      z = ny * sp + z * cp;
      n.near = z < 70;
      n.nf = Math.min(1, Math.max(0, (z - 70) / 140));
      const s = Math.min(8, F2 / Math.max(70, z));
      n.sx = W / 2 + x * s; n.sy = H / 2 + y * s; n.ss = s;
      n.sd = z - FOCAL / (0.9 * c.zoom);
      return;
    }

    const nx = n.x - c.ctr.x, ny = n.y - c.ctr.y, nz = n.z - c.ctr.z;
    let x = nx * cy + nz * sy, z = -nx * sy + nz * cy;
    const y = ny * cp - z * sp;
    z = ny * sp + z * cp;
    const den = FOCAL + z * c.zoom * 0.9;
    n.near = den < 140;
    n.nf = Math.min(1, Math.max(0, (den - 140) / 200));
    const s = Math.min(6, FOCAL / Math.max(140, den) * c.zoom);
    n.sx = W / 2 + x * s; n.sy = H / 2 + y * s; n.ss = s;
    n.sd = z;
  };

  // ─────────────────────────────────────────────── fisica ──

  Starmap.prototype.step = function () {
    const nodes = this.nodes, S = this.S;
    const shp = S.shape || "natural";
    // con una forma attiva le molle allentano la presa, altrimenti combattono
    // i magneti della forma e la struttura oscilla
    const spr = S.spring * (shp === "natural" ? 1 : 0.3);

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        if (!b.alive) continue;
        let dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1) d2 = 1;
        if (d2 > 160000) continue;
        const f = S.repel / d2, d = Math.sqrt(d2);
        dx /= d; dy /= d; dz /= d;
        a.vx += dx * f; a.vy += dy * f; a.vz += dz * f;
        b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
      }
    }

    for (const l of this.links) {
      const a = nodes[l.s], b = nodes[l.t];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const f = spr * (d - S.len) / d;
      const wa = 1 / Math.sqrt(a.deg), wb = 1 / Math.sqrt(b.deg);
      a.vx += dx * f * wa; a.vy += dy * f * wa; a.vz += dz * f * wa;
      b.vx -= dx * f * wb; b.vy -= dy * f * wb; b.vz -= dz * f * wb;
    }

    this._shape();

    const jitter = S.heat * 0.6;
    for (const n of nodes) {
      if (!n.alive) continue;
      if (jitter) {
        n.vx += (Math.random() - 0.5) * jitter;
        n.vy += (Math.random() - 0.5) * jitter;
        n.vz += (Math.random() - 0.5) * jitter;
      }
      n.vx *= DAMP; n.vy *= DAMP; n.vz *= DAMP;
      const m = Math.max(this.alpha, jitter ? 0.5 : 0);
      n.x += n.vx * m; n.y += n.vy * m; n.z += n.vz * m;
    }
    this.alpha *= 0.985;
  };

  /* Magneti di forma: spingono dolcemente le stelle in una silhouette. */
  Starmap.prototype._shape = function () {
    const nodes = this.nodes, S = this.S, shp = S.shape || "natural";

    let R = 0;
    if (shp !== "natural" && shp !== "disc" && shp !== "spiral") {
      let sm = 0, k = 0;
      for (const n of nodes) { if (!n.alive) continue; sm += Math.hypot(n.x, n.y, n.z); k++; }
      R = k ? sm / k : 0;
    }

    let clC = null;
    if (shp === "clusters") {
      if (!this.clR) this.clR = R || 1;
      const CR = this.clR * 1.6;
      clC = {};
      this.famOrder.forEach((k, ci) => {
        const ca = ci * 2.399;
        clC[k] = [Math.cos(ca) * CR, ((ci % 3) - 1) * CR * 0.45, Math.sin(ca) * CR];
      });
    }

    for (const n of nodes) {
      if (!n.alive) continue;
      n.vx -= n.x * S.center * n.deg;
      n.vy -= n.y * S.center * n.deg;
      n.vz -= n.z * S.center * n.deg;

      if (shp === "disc" || shp === "spiral" || shp === "ring") n.vy -= n.y * 0.05;

      if (shp === "spiral") {
        const r = Math.hypot(n.x, n.z);
        if (r > 26) {
          const th = Math.atan2(n.z, n.x);
          let e = (th - 1.4 * Math.log(r)) % Math.PI;
          if (e < -Math.PI / 2) e += Math.PI;
          if (e >= Math.PI / 2) e -= Math.PI;
          const dth = -e * 0.045;
          n.vx += -Math.sin(th) * r * dth;
          n.vz += Math.cos(th) * r * dth;
        }
      } else if (shp === "ring") {
        const r = Math.hypot(n.x, n.z) || 1, f = (R - r) * 0.03;
        n.vx += n.x / r * f; n.vz += n.z / r * f;
      } else if (shp === "shell") {
        const r = Math.hypot(n.x, n.y, n.z) || 1, f = (R - r) * 0.035;
        n.vx += n.x / r * f; n.vy += n.y / r * f; n.vz += n.z / r * f;
      } else if (shp === "helix") {
        const r = Math.hypot(n.x, n.z) || 1, f = (R * 0.75 - r) * 0.014;
        n.vx += n.x / r * f; n.vz += n.z / r * f;
        if (n.hxA === undefined) n.hxA = n.y * 0.012;
        const ang = Math.atan2(n.z, n.x);
        let e = (ang - n.hxA) % Math.PI;
        if (e < -Math.PI / 2) e += Math.PI;
        if (e >= Math.PI / 2) e -= Math.PI;
        const dth = -e * 0.03;
        n.vx += -Math.sin(ang) * r * dth;
        n.vz += Math.cos(ang) * r * dth;
      } else if (shp === "torus") {
        const r = Math.hypot(n.x, n.z) || 1, dr = r - R;
        const d = Math.hypot(dr, n.y) || 1, f = (R * 0.16 - d) * 0.03;
        n.vx += (n.x / r) * (dr / d) * f;
        n.vy += (n.y / d) * f;
        n.vz += (n.z / r) * (dr / d) * f;
      } else if (shp === "clusters" && clC) {
        const cc = clC[n.fam];
        if (cc) {
          n.vx += (cc[0] - n.x) * 0.006;
          n.vy += (cc[1] - n.y) * 0.006;
          n.vz += (cc[2] - n.z) * 0.006;
        }
      } else if (shp === "cube") {
        const hs = R * 0.75 || 1;
        let tx = Math.max(-hs, Math.min(hs, n.x));
        let ty = Math.max(-hs, Math.min(hs, n.y));
        let tz = Math.max(-hs, Math.min(hs, n.z));
        const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
        if (ax >= ay && ax >= az) tx = (n.x < 0 ? -1 : 1) * hs;
        else if (ay >= az) ty = (n.y < 0 ? -1 : 1) * hs;
        else tz = (n.z < 0 ? -1 : 1) * hs;
        n.vx += (tx - n.x) * 0.012;
        n.vy += (ty - n.y) * 0.012;
        n.vz += (tz - n.z) * 0.012;
      }
    }
  };

  // ────────────────────────────────────────────── rendering ──

  Starmap.prototype.famColor = function (k) {
    return this.fams[k] || { color: "#8792a8", rgb: "135,146,168" };
  };

  Starmap.prototype.isHidden = function (n) {
    if (!n.alive) return true;
    if (this.hidden.has(n.fam)) return true;
    if (this.solo && n.fam !== this.solo) return true;
    return false;
  };

  Starmap.prototype.start = function () {
    if (this._raf) return;
    const loop = (now) => {
      if (this.dead) return;
      this._raf = requestAnimationFrame(loop);
      this.frame(now);
    };
    this._raf = requestAnimationFrame(loop);
  };

  Starmap.prototype.stop = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  };

  Starmap.prototype.destroy = function () {
    this.dead = true;
    this.stop();
  };

  Starmap.prototype.frame = function (now) {
    const t = (now - this.t0) / 1000;
    const S = this.S, ctx = this.ctx, W = this.W, H = this.H;
    if (!W || !H || !this.nodes.length) return;

    // Ferma-e-congela: la galassia si forma sempre (alpha caldo), poi il warp
    // decide. A 0 la fisica è congelata: è questo che tiene alto il framerate.
    let warp = S.warp;
    if (this.alpha > 0.12) warp = Math.max((S.shape !== "natural") ? 2 : 1, warp);
    else if (this.reduceMotion) warp = 0;
    else if (S.heat > 0.01) warp = Math.max(1, warp);
    const dt = Math.min(0.1, (now - (this._last || now)) / 1000);
    this._last = now;
    this._acc = (this._acc || 0) + warp * dt * 60;
    let guard = 0;
    while (this._acc >= 1 && guard++ < 12) { this.step(); this._acc--; }
    if (this._acc > 12) this._acc = 0;

    if (!this._autofit && this.alpha <= 0.125 && this.gCtr) {
      this._autofit = true;
      this.fit();
    }

    this.idleT++;
    const c = this.cam, tg = this.target;
    if (!this.flight.on && !this.dragging && this.idleT > 140 && !this.reduceMotion) {
      tg.yaw += 0.00035 * S.spin;
    }
    c.yaw += (tg.yaw - c.yaw) * 0.08;
    c.pitch += (tg.pitch - c.pitch) * 0.08;
    c.zoom += (tg.zoom - c.zoom) * 0.08;

    this._flightStep();

    // La camera insegue il centro VIVO delle stelle visibili, non l'origine:
    // un layout che deriva lascerebbe l'origine nel vuoto e la galassia in un
    // angolo, senza modo di ricentrarla.
    if (!this.flight.on) {
      const tgt = this.focus >= 0 ? this.nodes[this.focus] : (this.gCtr || { x: 0, y: 0, z: 0 });
      c.ctr.x += (tgt.x - c.ctr.x) * 0.12;
      c.ctr.y += (tgt.y - c.ctr.y) * 0.12;
      c.ctr.z += (tgt.z - c.ctr.z) * 0.12;
    }

    for (const n of this.nodes) this.project(n);

    ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    const bg = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.8);
    bg.addColorStop(0, "#080D1A");
    bg.addColorStop(1, "#03050A");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this._drawBackdrop(t);
    this._ease();
    this._drawNebula(t);
    const gInfo = this._drawCartography(t);
    this._drawLinks();
    this._drawStars(t);
    this._drawStarNames(t);
    this._drawHoverLabel();
    void gInfo;
  };

  /* Stelle di sfondo, con un lieve scintillio. */
  Starmap.prototype._drawBackdrop = function (t) {
    const S = this.S;
    if (S.stars <= 0.02) return;
    const ctx = this.ctx, W = this.W, H = this.H;
    const p = { x: 0, y: 0, z: 0, sx: 0, sy: 0, ss: 1, sd: 0, near: false, nf: 1 };
    for (const s of this.backdrop) {
      p.x = s.x; p.y = s.y; p.z = s.z;
      this.project(p);
      if (p.near || p.sx < -4 || p.sx > W + 4 || p.sy < -4 || p.sy > H + 4) continue;
      const tw = this.reduceMotion ? 1 : 0.6 + 0.4 * Math.sin(t * 1.1 + s.x * 0.02);
      ctx.fillStyle = "rgba(190,205,235," + Math.min(0.9, 0.12 * s.b * tw * (s.l + 1) * S.stars) + ")";
      const sz = s.l > 1 ? 1.6 : 1;
      ctx.fillRect(p.sx, p.sy, sz, sz);
    }
  };

  /* Stati di hover smorzati: tutto sfuma in ~250ms invece di scattare. */
  Starmap.prototype._ease = function () {
    const hn = this.hover >= 0 ? this.nodes[this.hover] : null;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const dt = hn && i !== this.hover && !hn.nbr.has(i) ? 1 : 0;
      n.dim += (dt - n.dim) * 0.09;
      const lt = (i === this.hover || i === this.focus) ? 1 : 0;
      n.litE += (lt - n.litE) * 0.15;
    }
    for (const l of this.links) {
      const on = hn && (l.s === this.hover || l.t === this.hover) ? 1 : 0;
      l.hl += (on - l.hl) * 0.12;
      l.dm += ((hn && !on ? 1 : 0) - l.dm) * 0.09;
    }
    for (const k in this.famFade) {
      this.famFade[k] += ((hn && hn.fam !== k ? 1 : 0) - this.famFade[k]) * 0.09;
    }
  };

  /* Nebbia: sbuffi additivi a mezza risoluzione, poi riscalati in 'screen'. */
  Starmap.prototype._drawNebula = function (t) {
    const S = this.S;
    if (S.nebula <= 0.02) return;
    const ctx = this.ctx, fg = this.fogCtx, W = this.W, H = this.H;
    const sc = this.fogCv.width / W;

    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.clearRect(0, 0, this.fogCv.width, this.fogCv.height);
    fg.setTransform(sc, 0, 0, sc, 0, 0);
    fg.globalCompositeOperation = "lighter";

    // ancore = le pagine più connesse di ogni costellazione: la nebbia si
    // addensa attorno agli hub, non uniformemente
    const anchors = this.anchors || (this.anchors = this._pickAnchors());

    for (let ai = 0; ai < anchors.length; ai++) {
      const n = this.nodes[anchors[ai]];
      if (this.isHidden(n)) continue;
      const sprite = this.puffs[n.fam];
      if (!sprite) continue;
      const fd = this.famFade[n.fam] || 0;
      const baseR = Math.min(340, (34 + n.w * 3.4) * n.ss);
      const ext = baseR * 2.4;
      if (n.sx < -ext || n.sx > W + ext || n.sy < -ext || n.sy > H + ext) continue;
      const puffN = n.ss > 1.8 ? 8 : (n.w >= 10 ? 16 : 12);
      for (let p = 0; p < puffN; p++) {
        const h1 = hash(ai, p), h2 = hash(ai, p + 50), h3 = hash(ai, p + 100);
        const ang = h1 * 6.283 + (this.reduceMotion ? 0 : t * 0.03 * (h2 - 0.5));
        const dist = baseR * (0.15 + h2 * 0.75), R = baseR * (0.55 + h3 * 0.9);
        const a = (0.075 - 0.035 * fd) * S.nebula
          * (0.6 + 0.4 * Math.sin(t * 0.2 + h1 * 6.283)) * (n.nf === undefined ? 1 : n.nf);
        if (a < 0.009) continue;
        fg.globalAlpha = Math.max(0.008, a);
        fg.drawImage(sprite, n.sx + Math.cos(ang) * dist - R, n.sy + Math.sin(ang) * dist - R, R * 2, R * 2);
      }
      if (fd < 0.9 && S.dust > 0.02) {
        fg.fillStyle = "rgba(" + this.famColor(n.fam).rgb + ",0.5)";
        for (let d = 0; d < 18; d++) {
          const h1 = hash(ai + 300, d), h2 = hash(ai + 400, d);
          const ang = h1 * 6.283, dist = baseR * (0.2 + h2 * 0.9);
          const tw = this.reduceMotion ? 0.5 : 0.25 + 0.45 * Math.sin(t * 1.6 + h1 * 40);
          fg.globalAlpha = Math.min(0.55, 0.22 * tw * (1 - fd) * S.dust);
          fg.fillRect(n.sx + Math.cos(ang) * dist, n.sy + Math.sin(ang) * dist, 2.6, 2.6);
        }
      }
    }
    fg.globalAlpha = 1;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(this.fogCv, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  };

  Starmap.prototype._pickAnchors = function () {
    const byFam = {};
    this.nodes.forEach((n) => (byFam[n.fam] = byFam[n.fam] || []).push(n));
    const out = [];
    for (const k in byFam) {
      byFam[k].sort((a, b) => b.w - a.w);
      const take = Math.max(1, Math.min(4, Math.ceil(byFam[k].length * 0.18)));
      byFam[k].slice(0, take).forEach((n) => out.push(n.i));
    }
    return out;
  };

  /* Cartografia: contorni tratteggiati e nomi delle costellazioni su anelli
     orbitali inclinati, ciascuno sul proprio piano come pianeti. */
  Starmap.prototype._drawCartography = function (t) {
    const ctx = this.ctx, S = this.S;
    const famPts = {}, famNds = {};
    let gcx = 0, gcy = 0, gcz = 0, gn = 0;

    for (const n of this.nodes) {
      if (this.isHidden(n)) continue;
      (famPts[n.fam] = famPts[n.fam] || []).push([n.sx, n.sy]);
      (famNds[n.fam] = famNds[n.fam] || []).push(n);
      gcx += n.x; gcy += n.y; gcz += n.z; gn++;
    }
    if (!gn) return null;
    gcx /= gn; gcy /= gn; gcz /= gn;
    this.gCtr = { x: gcx, y: gcy, z: gcz };

    const gd = [];
    for (const n of this.nodes) {
      if (this.isHidden(n)) continue;
      gd.push(Math.hypot(n.x - gcx, n.y - gcy, n.z - gcz));
    }
    gd.sort((a, b) => a - b);
    const Rg = gd[Math.floor(gd.length * 0.85)] || 100;
    this.Rg = Rg;

    const gP = { x: gcx, y: gcy, z: gcz, sx: 0, sy: 0, ss: 1, sd: 0, near: false, nf: 1 };
    this.project(gP);
    this.gP = gP;

    for (const k in famPts) {
      const pts = famPts[k];
      if (pts.length < 4) continue;
      const fd = this.famFade[k] || 0;
      const h = hull(pts);
      if (!h || h.length < 3) continue;

      let cx = 0, cy = 0;
      for (const p of h) { cx += p[0]; cy += p[1]; }
      cx /= h.length; cy /= h.length;

      ctx.setLineDash([2, 6]);
      ctx.strokeStyle = "rgba(" + this.famColor(k).rgb + "," + (0.20 - 0.13 * fd).toFixed(3) + ")";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      h.forEach((p, i) => {
        const ix = p[0] + (p[0] - cx) * 0.14, iy = p[1] + (p[1] - cy) * 0.14;
        i ? ctx.lineTo(ix, iy) : ctx.moveTo(ix, iy);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      if (S.names > 0.02) this._drawRingName(k, famNds[k], gcx, gcy, gcz, Rg, gP, t);
    }
    return true;
  };

  Starmap.prototype._drawRingName = function (k, mem, gcx, gcy, gcz, Rg, gP, t) {
    if (!mem || mem.length < 4) return;
    const ctx = this.ctx, S = this.S;

    let c3x = 0, c3y = 0, c3z = 0, tw = 0;
    for (const n of mem) {
      const w = 1 + n.w;
      c3x += n.x * w; c3y += n.y * w; c3z += n.z * w; tw += w;
    }
    c3x /= tw; c3y /= tw; c3z /= tw;

    const idx = Math.max(0, this.famOrder.indexOf(k));
    const inc = ((idx % 7) - 3) * 0.20;           // inclinazione dell'anello
    const nodA = idx * 2.399;                      // angolo aureo
    const ux = Math.cos(nodA), uz = Math.sin(nodA);
    const vx = -Math.sin(nodA) * Math.cos(inc), vy = Math.sin(inc), vz = Math.cos(nodA) * Math.cos(inc);
    const R3 = Rg * 1.30 + 24 + idx * Math.min(12, 70 / Math.max(4, this.famOrder.length - 1));

    const scRef = gP.ss;
    const fs = Math.max(9, Math.min(30, Rg * scRef * 0.115)) * S.nameSize;
    if (fs <= 9.5) return;

    const name = k.toUpperCase();
    this._nameCache = this._nameCache || {};
    if (!this._nameCache[name]) {
      ctx.font = "italic 100px Georgia, serif";
      const adv = []; let tot = 0;
      for (const ch of name) { const w = ctx.measureText(ch).width; adv.push(w); tot += w; }
      this._nameCache[name] = { adv, tot };
    }
    const lc = this._nameCache[name], sc = fs / 100;

    // ancora fissa: il punto dell'anello più vicino alle stelle del settore
    let angW = 0, bD = Infinity;
    for (let s = 0; s < 64; s++) {
      const a = s / 64 * 6.28319;
      const px = gcx + (ux * Math.cos(a) + vx * Math.sin(a)) * R3;
      const py = gcy + (vy * Math.sin(a)) * R3;
      const pz = gcz + (uz * Math.cos(a) + vz * Math.sin(a)) * R3;
      const d = (px - c3x) ** 2 + (py - c3y) ** 2 + (pz - c3z) ** 2;
      if (d < bD) { bD = d; angW = a; }
    }

    const spacing = fs * 0.14;
    const totalAng = (lc.tot * sc + spacing * (name.length - 1)) / (R3 * scRef);
    const rp = (aa) => {
      const o = {
        x: gcx + (ux * Math.cos(aa) + vx * Math.sin(aa)) * R3,
        y: gcy + (vy * Math.sin(aa)) * R3,
        z: gcz + (uz * Math.cos(aa) + vz * Math.sin(aa)) * R3,
        sx: 0, sy: 0, ss: 1, sd: 0, near: false, nf: 1,
      };
      this.project(o);
      return o;
    };
    const cwS = rp(angW - totalAng / 2), cwM = rp(angW), cwE = rp(angW + totalAng / 2);

    // Affollamento: se l'anello è di taglio le lettere non hanno spazio e il
    // nome intero sfuma, invece di accavallarsi.
    const relM = Math.max(0.35, Math.min(1.6, cwM.ss / Math.max(0.001, scRef)));
    const halfW = Math.max(1, (lc.tot * sc + spacing * (name.length - 1)) * 0.5 * relM);
    const crowd = Math.min(
      Math.hypot(cwM.sx - cwS.sx, cwM.sy - cwS.sy) / halfW,
      Math.hypot(cwE.sx - cwM.sx, cwE.sy - cwM.sy) / halfW);
    const crowdFade = Math.min(1, Math.max(0, (crowd - 0.40) / 0.25));

    // il nome si scioglie mentre passa dietro la galassia
    const depthFrac = (cwM.sd - gP.sd) / R3;
    const depthFade = Math.min(1, Math.max(0, (0.10 - depthFrac) / 0.55));

    // ribaltamento agganciato: il testo cambia verso solo quando è invisibile
    this._flip = this._flip || {};
    this._fade = this._fade || {};
    const eDx = cwE.sx - cwS.sx, eDy = cwE.sy - cwS.sy;
    if (this._flip[k] === undefined) this._flip[k] = eDx < 0;
    const want = Math.abs(eDx) < 4 ? this._flip[k] : (eDx < 0);
    if (this._flip[k] !== want && (this._fade[k] === undefined || this._fade[k] < 0.03)) {
      this._flip[k] = want;
    }
    const flip = this._flip[k];

    // il nome sfuma se si inclina troppo: non lo si guarda mai ruotare verticale
    let tilt = Math.abs(Math.atan2(eDy, eDx)) * 57.2958;
    if (tilt > 90) tilt = 180 - tilt;
    const tiltFade = Math.min(1, Math.max(0, (65 - tilt) / 25));

    const fd = this.famFade[k] || 0;
    const want2 = crowdFade * depthFade * tiltFade * (1 - fd * 0.75);
    this._fade[k] = (this._fade[k] || 0) + (want2 - (this._fade[k] || 0)) * 0.08;
    const alpha = this._fade[k];
    if (alpha < 0.03) return;

    ctx.textAlign = "center";
    ctx.font = "italic " + fs.toFixed(1) + "px Georgia, serif";
    const rgb = this.famColor(k).rgb;

    let acc = -(lc.tot * sc + spacing * (name.length - 1)) / 2;
    for (let ci = 0; ci < name.length; ci++) {
      const adv = lc.adv[ci] * sc;
      const mid = acc + adv / 2;
      acc += adv + spacing;
      const da = (flip ? -mid : mid) / (R3 * scRef);
      const a2 = angW + da;
      const o = rp(a2);
      if (o.near) continue;
      const o2 = rp(a2 + 0.001);
      let rot = Math.atan2(o2.sy - o.sy, o2.sx - o.sx);
      if (flip) rot += Math.PI;
      const rel = Math.max(0.4, Math.min(1.5, o.ss / Math.max(0.001, scRef)));
      ctx.save();
      ctx.translate(o.sx, o.sy);
      ctx.rotate(rot);
      ctx.globalAlpha = Math.min(0.85, alpha * 0.8 * (o.nf === undefined ? 1 : o.nf));
      ctx.fillStyle = "rgb(" + rgb + ")";
      ctx.font = "italic " + (fs * rel).toFixed(1) + "px Georgia, serif";
      ctx.fillText(name[ci], 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  /* Fili di luce: i wikilink. */
  Starmap.prototype._drawLinks = function () {
    const S = this.S;
    if (S.links <= 0.02) return;
    const ctx = this.ctx, W = this.W, H = this.H, nodes = this.nodes;
    ctx.lineWidth = 0.7;
    for (const l of this.links) {
      const a = nodes[l.s], b = nodes[l.t];
      if (this.isHidden(a) || this.isHidden(b) || a.near || b.near) continue;
      if ((a.sx < 0 && b.sx < 0) || (a.sx > W && b.sx > W)) continue;
      if ((a.sy < 0 && b.sy < 0) || (a.sy > H && b.sy > H)) continue;
      const base = 0.16 * S.links;
      const al = (base * (1 - l.dm * 0.85) + l.hl * 0.55) * Math.min(a.nf, b.nf);
      if (al < 0.012) continue;
      const rgb = l.hl > 0.2 ? this.famColor(a.fam).rgb : "150,175,215";
      ctx.strokeStyle = "rgba(" + rgb + "," + al.toFixed(3) + ")";
      ctx.lineWidth = 0.7 + l.hl * 1.1;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
  };

  /* Le stelle: nucleo + alone additivo, corona per le pagine appena toccate. */
  Starmap.prototype._drawStars = function (t) {
    const ctx = this.ctx, W = this.W, H = this.H, nodes = this.nodes;
    const now = Date.now();

    ctx.globalCompositeOperation = "lighter";
    for (const i of this.ord) {
      const n = nodes[i];
      if (this.isHidden(n) || n.near) continue;
      const R = Math.max(0.8, n.r * n.ss);
      const margin = R * 9 + 40;
      if (n.sx < -margin || n.sx > W + margin || n.sy < -margin || n.sy > H + margin) continue;

      const fade = (1 - n.dim * 0.88) * n.nf;
      if (fade < 0.03) continue;
      const rgb = this.famColor(n.fam).rgb;

      const sprite = this.halos[n.fam];
      if (!sprite) continue;

      // corona da supernova: pagine aggiornate negli ultimi giorni
      if (n.updated && !this.reduceMotion) {
        const age = (now - Date.parse(n.updated)) / 86400000;
        if (age >= 0 && age < 7) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.7 + i);
          const cr = R * (5 + pulse * 3.5);
          ctx.globalAlpha = Math.min(0.5, 0.3 * (1 - age / 7) * fade);
          ctx.drawImage(sprite, n.sx - cr, n.sy - cr, cr * 2, cr * 2);
        }
      }

      const hr = R * (3.4 + n.litE * 2.2);
      ctx.globalAlpha = Math.min(0.75, (0.42 + n.litE * 0.4) * fade);
      ctx.drawImage(sprite, n.sx - hr, n.sy - hr, hr * 2, hr * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    for (const i of this.ord) {
      const n = nodes[i];
      if (this.isHidden(n) || n.near) continue;
      const R = Math.max(0.8, n.r * n.ss);
      if (n.sx < -R - 8 || n.sx > W + R + 8 || n.sy < -R - 8 || n.sy > H + R + 8) continue;
      const fade = (1 - n.dim * 0.88) * n.nf;
      if (fade < 0.03) continue;
      const rgb = this.famColor(n.fam).rgb;

      ctx.fillStyle = "rgba(" + rgb + "," + Math.min(1, 0.85 * fade + n.litE * 0.15).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(n.sx, n.sy, R, 0, 7);
      ctx.fill();

      // nucleo bianco caldo sugli hub e sulla stella attiva
      if (n.w >= 6 || n.litE > 0.2) {
        ctx.fillStyle = "rgba(255,255,255," + Math.min(0.9, (0.25 + n.litE * 0.6) * fade).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, R * 0.42, 0, 7);
        ctx.fill();
      }

      // anello di selezione
      if (n.litE > 0.02) {
        ctx.strokeStyle = "rgba(" + rgb + "," + (n.litE * 0.7).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, R * 2.1 + 3, 0, 7);
        ctx.stroke();
      }
    }
  };

  /* I nomi delle pagine: ciascuno è una luna in orbita 3D attorno alla sua
     stella. Ne stanno a schermo solo le più importanti, senza sovrapporsi. */
  Starmap.prototype._drawStarNames = function (t) {
    const S = this.S;
    if (S.names <= 0.02) return;
    const ctx = this.ctx, W = this.W, H = this.H, nodes = this.nodes;

    for (const i of this.ord) {
      const n = nodes[i];
      const tier = n.w >= 10 ? 1 : (n.w >= 3 ? 2 : 3);
      n.lblTier = tier;
      let ok = false;
      if (!this.isHidden(n) && n.dim <= 0.85
          && n.sx >= -80 && n.sx <= W + 80 && n.sy >= -60 && n.sy <= H + 60) {
        const th = [0, 0.34, 0.72, 1.15][tier];
        const sMul = n.ss * Math.sqrt(S.names);
        ok = n.lblOn ? sMul > th * 0.85 : sMul > th * 1.08;
      }
      n.lblWant = ok;
    }

    // assegnazione appiccicosa: chi ha già il posto lo tiene, i nuovi occupano
    // solo spazio libero — così le etichette non lampeggiano
    const cands = [];
    for (const i of this.ord) {
      const n = nodes[i];
      if (!n.lblWant) { n.lblOn = false; continue; }
      cands.push([(n.lblOn ? 100000 : 0) + (3 - n.lblTier) * 1000 + n.w, i]);
    }
    cands.sort((a, b) => (b[0] - a[0]) || (a[1] - b[1]));

    const placed = [], tierCount = [0, 0, 0, 0];
    for (const [, i] of cands) {
      const n = nodes[i];
      if (tierCount[n.lblTier] >= TIERCAP[n.lblTier]) { n.lblOn = false; continue; }
      if (!n.lc) {
        const lbl = n.title.length > 26 ? n.title.slice(0, 24) + "…" : n.title;
        ctx.font = "italic 100px Georgia, serif";
        const adv = []; let tot = 0;
        for (const ch of lbl) { const w = ctx.measureText(ch).width; adv.push(w); tot += w; }
        n.lc = { lbl, adv, tot };
      }
      const fs = (n.lblTier === 1 ? 13 : n.lblTier === 2 ? 10.5 : 9) * Math.min(1.7, Math.sqrt(n.ss));
      const wpx = n.lc.tot * (fs / 100) + fs * 0.06;
      const box = { x: n.sx - wpx / 2 - 10, y: n.sy - n.r * n.ss - fs * 2.4, w: wpx + 20, h: fs * 3 };
      let clash = false;
      for (const b of placed) {
        if (box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y) {
          clash = true; break;
        }
      }
      if (clash) { n.lblOn = false; continue; }
      placed.push(box);
      tierCount[n.lblTier]++;
      n.lblOn = true;
    }

    ctx.textAlign = "center";
    for (const i of this.ord) {
      const n = nodes[i];
      const tgt = n.lblOn ? 1 : 0;
      n.lblA += (tgt - n.lblA) * 0.10;
      if (n.lblA <= 0.03 || this.isHidden(n) || !n.lc) continue;
      const ang = (this.reduceMotion ? 0 : t * 0.12) + i * 2.4;
      const rW = n.r * 2.6 + 13;
      const tmp = {
        x: n.x + Math.cos(ang) * rW, y: n.y - n.r * 0.8, z: n.z + Math.sin(ang) * rW,
        sx: 0, sy: 0, ss: 1, sd: 0, near: false, nf: 1,
      };
      this.project(tmp);
      if (tmp.near) continue;
      const behind = tmp.sd > n.sd;
      const rel = Math.max(0.5, Math.min(1.4, tmp.ss / Math.max(0.001, n.ss)));
      const fs = (n.lblTier === 1 ? 13 : n.lblTier === 2 ? 10.5 : 9)
        * Math.min(1.7, Math.sqrt(n.ss)) * rel;
      const aa = Math.min(0.85,
        (n.lblTier === 1 ? 0.62 : n.lblTier === 2 ? 0.52 : 0.44)
        * (1 - n.dim) * n.lblA * (behind ? 0.4 : 1) * (tmp.nf === undefined ? 1 : tmp.nf));
      if (aa <= 0.02) continue;
      ctx.fillStyle = "rgba(" + this.famColor(n.fam).rgb + "," + aa.toFixed(3) + ")";
      ctx.font = "italic " + fs.toFixed(1) + "px Georgia, serif";
      ctx.fillText(n.lc.lbl, tmp.sx, tmp.sy);
    }
  };

  /* Etichetta monospaziata per la stella sotto il puntatore o selezionata. */
  Starmap.prototype._drawHoverLabel = function () {
    const idx = this.hover >= 0 ? this.hover : this.focus;
    if (idx < 0) return;
    const n = this.nodes[idx];
    if (!n || this.isHidden(n) || n.near) return;
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.font = "11px ui-monospace, Menlo, monospace";
    const y = n.sy + n.r * n.ss + 18;
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(4,6,12,0.9)";
    ctx.strokeText(n.title, n.sx, y);
    ctx.fillStyle = "#EAF1FC";
    ctx.fillText(n.title, n.sx, y);
  };

  Starmap.prototype._flightStep = function () {
    if (!this.flight.on) return;
    this.idleT = 0;
    const c = this.cam, f = this.flight, S = this.S;
    const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const fwd = [-sy * cp, sp, cy * cp];
    const rgt = [cy, 0, sy];
    const up = [sy * sp, cp, -cy * sp];
    const acc = (this.keys.has("shift") ? 0.45 : 0.15) * S.thrust;
    const th = (v, k) => { f.vel.x += v[0] * k * acc; f.vel.y += v[1] * k * acc; f.vel.z += v[2] * k * acc; };
    if (this.keys.has("w")) th(fwd, 1);
    if (this.keys.has("s")) th(fwd, -1);
    if (this.keys.has("d")) th(rgt, 1);
    if (this.keys.has("a")) th(rgt, -1);
    if (this.keys.has("e")) th(up, 1);
    if (this.keys.has("q")) th(up, -1);
    f.vel.x *= 0.965; f.vel.y *= 0.965; f.vel.z *= 0.965;
    f.pos.x += f.vel.x; f.pos.y += f.vel.y; f.pos.z += f.vel.z;
  };


  // ───────────────────────────────────────────── interazione ──

  Starmap.prototype._hit = function (mx, my) {
    let best = -1, bd = 26 * 26;
    for (const i of this.ord) {
      const n = this.nodes[i];
      if (this.isHidden(n) || n.near) continue;
      const dx = n.sx - mx, dy = n.sy - my;
      const d = dx * dx + dy * dy;
      const rr = Math.max(9, n.r * n.ss + 7);
      if (d < rr * rr && d < bd) { bd = d; best = i; }
    }
    return best;
  };

  Starmap.prototype._bindEvents = function () {
    const cv = this.canvas;
    let downX = 0, downY = 0, moved = false;

    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    cv.addEventListener("pointerdown", (e) => {
      cv.setPointerCapture(e.pointerId);
      this.dragging = true;
      moved = false;
      downX = e.clientX; downY = e.clientY;
      this.idleT = 0;
      cv.classList.add("sm-drag");
    });

    cv.addEventListener("pointermove", (e) => {
      const [mx, my] = pos(e);
      if (this.dragging) {
        const dx = e.clientX - downX, dy = e.clientY - downY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        if (this.flight.on) {
          this.target.yaw += dx * 0.004;
          this.target.pitch = Math.max(-1.4, Math.min(1.4, this.target.pitch + dy * 0.004));
        } else {
          this.target.yaw += dx * 0.006;
          this.target.pitch = Math.max(-1.35, Math.min(1.35, this.target.pitch + dy * 0.006));
        }
        downX = e.clientX; downY = e.clientY;
        this.idleT = 0;
        return;
      }
      const h = this._hit(mx, my);
      if (h !== this.hover) {
        this.hover = h;
        cv.style.cursor = h >= 0 ? "pointer" : "grab";
        this.onHover(h >= 0 ? this.nodes[h] : null, mx, my);
      } else if (h >= 0) {
        this.onHover(this.nodes[h], mx, my);
      }
    });

    const up = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      cv.classList.remove("sm-drag");
      if (!moved) {
        const [mx, my] = pos(e);
        const h = this._hit(mx, my);
        if (h >= 0) this.onSelect(this.nodes[h]);
        else this.onSelect(null);
      }
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", () => { this.dragging = false; cv.classList.remove("sm-drag"); });

    cv.addEventListener("pointerleave", () => {
      if (this.hover !== -1) { this.hover = -1; this.onHover(null); }
    });

    cv.addEventListener("wheel", (e) => {
      e.preventDefault();

      // deltaMode dice in che unità è deltaY: 0 pixel, 1 righe, 2 pagine.
      // Senza convertirlo, i browser che riportano righe (Firefox e molti
      // trackpad) mandano deltaY≈3 e lo zoom si muove del 3 per mille a
      // evento: da fuori sembra semplicemente rotto.
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      else if (e.deltaMode === 2) d *= this.H || 600;

      // il pinch a due dita del trackpad arriva come wheel + ctrl, con delta
      // minuscoli: va amplificato o non si muove niente
      if (e.ctrlKey) d *= 8;

      // un solo evento non può fare più di un passo pieno, altrimenti i mouse
      // con rotella libera saltano da un capo all'altro dello zoom
      d = Math.max(-180, Math.min(180, d));

      this.zoomBy(Math.exp(-d * 0.0022));
    }, { passive: false });

    // doppio clic: avvicina, o si posa sulla stella sotto il puntatore
    cv.addEventListener("dblclick", (e) => {
      e.preventDefault();
      const [mx, my] = pos(e);
      const h = this._hit(mx, my);
      if (h >= 0) this.focus = h;
      this.zoomBy(1.8);
    });

    this._onResize = () => this._resize();
    global.addEventListener("resize", this._onResize);
  };

  // ──────────────────────────────────────────── API pubblica ──

  Starmap.prototype.selectSlug = function (slug) {
    const i = slug ? this.nodes.findIndex((n) => n.slug === slug) : -1;
    this.focus = i;
    if (i >= 0) {
      this.target.zoom = Math.max(this.target.zoom, 1.35);
      this.idleT = 0;
    }
    return i;
  };

  Starmap.prototype.toggleFam = function (k) {
    if (this.hidden.has(k)) this.hidden.delete(k); else this.hidden.add(k);
    this.anchors = null;
    this.alpha = Math.max(this.alpha, 0.25);
  };

  Starmap.prototype.setSolo = function (k) {
    this.solo = k;
    this.anchors = null;
    this.alpha = Math.max(this.alpha, 0.25);
    this._autofit = false;
  };

  Starmap.prototype.setFilter = function (predicate) {
    // predicate(node) -> true se la pagina deve restare nel cielo
    for (const n of this.nodes) n.alive = predicate(n) ? 1 : 0;
    this.anchors = null;
    this.alpha = Math.max(this.alpha, 0.3);
    this._autofit = false;
  };

  Starmap.prototype.setShape = function (shape) {
    this.S.shape = SHAPES.indexOf(shape) >= 0 ? shape : "natural";
    this.clR = 0;
    this.alpha = Math.max(this.alpha, 0.6);
    this.idleT = 0;
    return this.S.shape;
  };

  Starmap.prototype.nextShape = function () {
    const i = SHAPES.indexOf(this.S.shape || "natural");
    return this.setShape(SHAPES[(i + 1) % SHAPES.length]);
  };

  Starmap.prototype.shapes = function () { return SHAPES.slice(); };

  /* Moltiplica lo zoom, tenendolo nei limiti. */
  Starmap.prototype.zoomBy = function (k) {
    this.target.zoom = Math.max(ZMIN, Math.min(ZMAX, this.target.zoom * k));
    this.idleT = 0;
    return this.target.zoom;
  };

  Starmap.prototype.zoomLevel = function () { return this.target.zoom; };

  Starmap.prototype.fit = function (fill) {
    this.focus = -1;
    this.idleT = 0;
    if (this.gCtr) {
      this.cam.ctr.x = this.gCtr.x;
      this.cam.ctr.y = this.gCtr.y;
      this.cam.ctr.z = this.gCtr.z;
    }
    const live = this.nodes.filter((n) => !this.isHidden(n) && !n.near);
    if (!live.length) { this.target.zoom = 1; return; }

    let maxX = 0, maxY = 0;
    for (const n of live) {
      maxX = Math.max(maxX, Math.abs(n.sx - this.W / 2) + n.r * n.ss);
      maxY = Math.max(maxY, Math.abs(n.sy - this.H / 2) + n.r * n.ss);
    }
    if (maxX < 1 || maxY < 1) return;

    // lascia margine ai nomi delle costellazioni, che stanno fuori dal grosso
    const want = (fill || 0.50);
    const k = Math.min((this.W / 2) * want / maxX, (this.H / 2) * want / maxY);
    this.target.zoom = Math.max(ZMIN, Math.min(ZMAX, this.cam.zoom * k));
  };

  Starmap.prototype.setFlight = function (on) {
    this.flight.on = !!on;
    if (on) {
      const c = this.cam, g = this.gCtr || { x: 0, y: 0, z: 0 };
      const d = (this.Rg || 200) * 2.6;
      this.flight.pos = {
        x: g.x + Math.sin(c.yaw) * d,
        y: g.y - Math.sin(c.pitch) * d,
        z: g.z - Math.cos(c.yaw) * d,
      };
      this.flight.vel = { x: 0, y: 0, z: 0 };
    }
    this.idleT = 0;
    return this.flight.on;
  };

  Starmap.prototype.key = function (k, down) {
    k = String(k).toLowerCase();
    if (down) this.keys.add(k); else this.keys.delete(k);
  };

  Starmap.prototype.set = function (key, value) {
    if (key in this.S) {
      this.S[key] = value;
      if (key === "repel" || key === "spring" || key === "len" || key === "center") {
        this.alpha = Math.max(this.alpha, 0.4);
      }
    }
  };

  Starmap.prototype.reheat = function (a) {
    this.alpha = Math.max(this.alpha, a || 0.5);
    this.idleT = 0;
  };

  Starmap.prototype.screenOf = function (slug) {
    const n = this.nodes.find((x) => x.slug === slug);
    return n && !n.near ? { x: n.sx, y: n.sy } : null;
  };

  global.Starmap = Starmap;
})(window);
