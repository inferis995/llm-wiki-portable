/* ============================================================
   LLM Wiki — dashboard
   Vanilla JS, nessun build step. Tutto offline (file:// compatibile).
   ============================================================ */
(function () {
  "use strict";

  // ──────────────────────────────────────────────────── utils ──

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const el = (tag, attrs, kids) => {
    const node = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") node.className = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach((k) => k && node.appendChild(k));
    return node;
  };

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const norm = (s) => String(s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

  const debounce = (fn, ms) => {
    let t;
    return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), ms); };
  };

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
             : { r: 128, g: 128, b: 128 };
  }
  const rgba = (hex, a) => { const c = hexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; };

  function relTime(iso) {
    if (!iso) return "";
    const then = new Date(iso);
    if (isNaN(then)) return iso;
    const days = Math.floor((Date.now() - then) / 864e5);
    if (days < 0) return iso;
    if (days === 0) return "oggi";
    if (days === 1) return "ieri";
    if (days < 30) return `${days} giorni fa`;
    if (days < 365) return `${Math.floor(days / 30)} mesi fa`;
    return `${Math.floor(days / 365)} anni fa`;
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem("llmwiki:" + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem("llmwiki:" + k, JSON.stringify(v)); } catch (_) { /* modalità privata */ } },
  };

  // ───────────────────────────────────────────────────── data ──

  const FALLBACK = "#6b7280";
  const META_SLUGS = new Set(["index", "log", "README"]);

  const DATA = typeof WIKI_DATA !== "undefined" ? WIKI_DATA : null;

  const S = {
    pages: [], bySlug: new Map(), colors: {}, cats: [], tags: {},
    health: { broken_links: [], orphans: [] }, stats: {}, log: [],
    degree: new Map(), root: null,
    view: "graph", slug: null, tag: null, query: "",
    hiddenCats: new Set(store.get("hiddenCats", [])),
    history: [],
  };

  function boot() {
    if (!DATA) return fail("data.js non trovato", "Esegui <code>python3 tools/sync.py</code> e ricarica.");

    S.pages  = (DATA.pages || []).slice();
    S.colors = Object.assign({ root: FALLBACK }, DATA.categories || {});
    S.cats   = Object.keys(DATA.categories || {});
    S.tags   = DATA.tags || {};
    S.health = DATA.health || { broken_links: [], orphans: [] };
    S.stats  = DATA.stats || {};
    S.log    = DATA.log || [];
    S.root   = DATA.root || null;

    S.pages.forEach((p) => {
      p.fm = p.frontmatter || {};
      p.tags = p.fm.tags || [];
      p.name = p.slug.split("/").pop();
      p.words = p.words || p.content.split(/\s+/).length;
      p.isMeta = META_SLUGS.has(p.slug);
      S.bySlug.set(p.slug, p);
    });

    S.pages.forEach((p) => {
      S.degree.set(p.slug, (p.links || []).length + (p.backlinks || []).length);
    });

    S.contentPages = S.pages.filter((p) => !p.isMeta);

    if (!S.pages.length) return fail("Wiki vuota", "Aggiungi la prima pagina e rilancia il sync.");

    Theme.init();
    Sidebar.init();
    Graph.init();
    Palette.init();
    Shortcuts.init();
    Router.init();
    renderChrome();
  }

  function fail(title, detail) {
    $("#view-graph").innerHTML =
      `<div class="empty" style="position:absolute;inset:0;display:grid;place-content:center">
         <div class="empty__i">◍</div>
         <div class="empty__t">${esc(title)}</div>
         <div class="empty__d">${detail}</div>
       </div>`;
  }

  function findPage(ref) {
    if (!ref) return null;
    if (S.bySlug.has(ref)) return S.bySlug.get(ref);
    const n = norm(ref);
    return S.pages.find((p) => norm(p.name) === n)
        || S.pages.find((p) => p.slug.endsWith("/" + ref))
        || S.pages.find((p) => norm(p.title) === n)
        || null;
  }

  const colorOf = (p) => S.colors[p && p.category] || FALLBACK;

  function visiblePages() {
    return S.pages.filter((p) =>
      !S.hiddenCats.has(p.category) &&
      (!S.tag || p.tags.includes(S.tag)));
  }

  function excerpt(page, max) {
    const line = page.content.split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("---"));
    const txt = (line || page.content)
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
               (_, target, alias) => alias || target.split("/").pop())
      .replace(/[*_`]/g, "").trim();
    return txt.length > max ? txt.slice(0, max - 1) + "…" : txt;
  }

  // ──────────────────────────────────────────────────── toast ──

  let toastTimer;
  function toast(msg) {
    const node = $("#toast");
    node.textContent = msg;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 2200);
  }

  // ──────────────────────────────────────────────────── theme ──

  const Theme = {
    init() {
      const saved = store.get("theme", null);
      /* Se la pagina e' incorporata da un host che ha gia' stampato data-theme
         (anteprima, iframe), rispettalo finche' l'utente non sceglie. */
      const host = document.documentElement.getAttribute("data-theme");
      const sys = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      this.apply(saved || host || (sys ? "light" : "dark"));
    },
    apply(mode) {
      document.documentElement.setAttribute("data-theme", mode);
      store.set("theme", mode);
      S.theme = mode;
      if (Graph.ready) Graph.applyTheme();
    },
    toggle() { this.apply(S.theme === "light" ? "dark" : "light"); },
  };

  // ─────────────────────────────────────────────────── sidebar ──

  const Sidebar = {
    collapsed: new Set(store.get("collapsed", [])),

    init() {
      const sub = $("#brand-sub");
      if (S.root) { sub.textContent = S.root.split(/[\\/]/).filter(Boolean).pop() || "wiki"; sub.title = S.root; }
      this.renderTags();
      this.renderTree();
    },

    renderTags() {
      const rail = $("#tag-rail");
      rail.innerHTML = "";
      const top = Object.keys(S.tags).filter((t) => t !== "index").slice(0, 14);
      top.forEach((t) => rail.appendChild(el("button", {
        class: "tagchip" + (S.tag === t ? " is-active" : ""),
        html: `${esc(t)}<b>${S.tags[t]}</b>`,
        title: `Filtra per #${t}`,
        onclick: () => Sidebar.setTag(S.tag === t ? null : t),
      })));
    },

    setTag(tag) {
      S.tag = tag;
      this.renderTags();
      this.renderTree();
      Graph.applyFilter();
      if (tag) toast(`Filtro attivo: #${tag}`);
    },

    renderTree() {
      const host = $("#page-tree");
      host.innerHTML = "";

      const pages = visiblePages().filter((p) => !p.isMeta);
      if (!pages.length) {
        host.appendChild(el("div", { class: "tree__empty", text: "Nessuna pagina con questo filtro." }));
        return;
      }

      const groups = new Map();
      pages.forEach((p) => {
        if (!groups.has(p.category)) groups.set(p.category, []);
        groups.get(p.category).push(p);
      });

      const order = S.cats.filter((c) => groups.has(c))
        .concat(Array.from(groups.keys()).filter((c) => !S.cats.includes(c)));

      order.forEach((cat) => {
        const items = groups.get(cat).sort((a, b) => a.title.localeCompare(b.title));
        const isCollapsed = this.collapsed.has(cat);

        const group = el("div", { class: "tree__group" + (isCollapsed ? " is-collapsed" : "") });
        group.appendChild(el("button", {
          class: "tree__head",
          onclick: () => {
            if (this.collapsed.has(cat)) this.collapsed.delete(cat); else this.collapsed.add(cat);
            store.set("collapsed", Array.from(this.collapsed));
            this.renderTree();
          },
          html: `<i class="tree__dot" style="background:${S.colors[cat] || FALLBACK}"></i>
                 <span>${esc(cat)}</span>
                 <em class="tree__count">${items.length}</em>
                 <b class="tree__caret">▾</b>`,
        }));

        const list = el("div", { class: "tree__items" });
        items.forEach((p) => list.appendChild(el("button", {
          class: "tree__item" + (S.slug === p.slug ? " is-active" : ""),
          text: p.title,
          title: p.slug,
          "data-slug": p.slug,
          onclick: () => Router.go(p.slug),
        })));
        group.appendChild(list);
        host.appendChild(group);
      });
    },

    mark() {
      $$(".tree__item").forEach((n) => n.classList.toggle("is-active", n.dataset.slug === S.slug));
      const active = $(".tree__item.is-active");
      if (active) active.scrollIntoView({ block: "nearest" });
    },
  };

  function renderChrome() {
    $("#stat-pages").textContent = plural(S.contentPages.length, "pagina", "pagine");
    $("#stat-links").textContent = plural(S.stats.content_links || S.stats.total_links || 0, "link", "link");

    const issues = S.health.broken_links.length + S.health.orphans.length;
    const badge = $("#health-badge");
    badge.textContent = issues || "";
    badge.className = "badge" + (issues ? " is-on " + (S.health.broken_links.length ? "err" : "warn") : "");
  }

  // ─────────────────────────────────────────────────── router ──

  const Router = {
    init() {
      window.addEventListener("hashchange", () => this.read());
      this.read();
    },

    read() {
      const raw = decodeURIComponent(location.hash.slice(1));
      if (!raw) return this.show("graph", null);
      if (raw.startsWith("!")) {
        const [view, arg] = raw.slice(1).split(":");
        if (view === "search") { S.query = arg || ""; return this.show("search", null); }
        return this.show(view, null);
      }
      const page = findPage(raw);
      return page ? this.show("page", page.slug) : this.show("graph", null);
    },

    go(slug) {
      const page = findPage(slug);
      if (!page) return toast(`Pagina non trovata: ${slug}`);
      if (S.slug && S.slug !== page.slug) S.history.push(S.slug);
      location.hash = encodeURIComponent(page.slug);
    },

    view(name, arg) {
      location.hash = "!" + name + (arg ? ":" + arg : "");
    },

    back() {
      if (S.history.length) { const prev = S.history.pop(); location.hash = encodeURIComponent(prev); }
      else this.view("graph");
    },

    show(view, slug) {
      S.view = view;
      S.slug = slug;

      $$(".view").forEach((n) => n.classList.remove("is-active"));
      const target = $("#view-" + view) || $("#view-graph");
      target.classList.add("is-active");

      $$(".navbtn").forEach((n) => n.classList.toggle("is-active", n.dataset.view === view));
      $("#graph-tools").classList.toggle("is-on", view === "graph");

      if (view === "page")     Doc.render(slug);
      if (view === "search")   Search.render();
      if (view === "overview") Overview.render();
      if (view === "activity") Activity.render();
      if (view === "health")   Health.render();

      Sidebar.mark();
      Crumbs.render();
      if (view === "graph") Graph.resume(); else Graph.pause();
      if (view === "page") Graph.select(slug);
      if (window.innerWidth <= 720) $("#app").classList.add("sidebar-hidden");
      target.scrollTop = 0;
    },
  };

  const Crumbs = {
    render() {
      const host = $("#crumbs");
      host.innerHTML = "";
      const push = (label, fn) => host.appendChild(
        fn ? el("button", { class: "crumbs__link", text: label, onclick: fn })
           : el("span", { class: "crumbs__now", text: label }));
      const sep = () => host.appendChild(el("i", { class: "crumbs__sep", text: "/" }));

      if (S.view === "page") {
        const page = S.bySlug.get(S.slug);
        if (!page) return;
        push("Grafo", () => Router.view("graph"));
        sep();
        push(page.category, () => { S.tag = null; Sidebar.setTag(null); Router.view("graph"); });
        sep();
        push(page.title);
        return;
      }
      const labels = { graph: "Grafo", search: "Ricerca", overview: "Panoramica", activity: "Attività", health: "Salute" };
      push(labels[S.view] || "Grafo");
    },
  };

  // ═══════════════════════════════════════════════════ GRAFO 3D ══

  const Graph = {
    ready: false, fg: null, is2d: false,
    labelsAlways: store.get("labelsAlways", false),
    focusMode: store.get("focusMode", true),
    nodes: new Map(), selected: null, hovered: null,
    highlightNodes: new Set(), highlightLinks: new Set(),
    idleAt: Date.now(), angle: 0, stars: null,

    /* Texture radiale generata a runtime: è il "bloom" senza post-processing,
       che offline non abbiamo (UnrealBloomPass non è nel bundle). */
    glowTexture: (function () {
      const size = 128;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d").createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0.00, "rgba(255,255,255,1)");
      g.addColorStop(0.18, "rgba(255,255,255,.62)");
      g.addColorStop(0.42, "rgba(255,255,255,.20)");
      g.addColorStop(1.00, "rgba(255,255,255,0)");
      const ctx = c.getContext("2d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(c);
    })(),

    init() {
      const data = this.buildData();

      this.fg = ForceGraph3D()($("#graph-canvas"))
        .graphData(data)
        .backgroundColor("rgba(0,0,0,0)")
        .showNavInfo(false)
        .enableNodeDrag(true)
        .nodeRelSize(4)
        .cooldownTicks(320)
        .d3AlphaDecay(0.014)
        .d3VelocityDecay(0.28)

        .nodeThreeObject((n) => this.buildNode(n))
        .nodeThreeObjectExtend(false)
        .nodeVisibility((n) => this.isVisible(n))

        .linkVisibility((l) => this.isVisible(l.source) && this.isVisible(l.target))
        .linkCurvature(0.18)
        .linkWidth((l) => (this.highlightLinks.has(l) ? 1.6 : 0.55))
        .linkColor((l) => this.linkColor(l))
        .linkOpacity(0.8)
        .linkDirectionalParticles((l) => (this.highlightLinks.has(l) ? 3 : 0))
        .linkDirectionalParticleWidth(1.6)
        .linkDirectionalParticleSpeed(0.006)
        .linkDirectionalParticleColor((l) => this.nodeColor(l.source))

        .onNodeHover((n) => this.onHover(n))
        .onNodeClick((n) => { this.idleAt = Date.now(); Router.go(n.id); })
        .onBackgroundClick(() => { this.select(null); Router.view("graph"); })
        .onNodeDragEnd((n) => { n.fx = n.x; n.fy = n.y; n.fz = n.z; });

      this.fg.d3Force("link").distance((l) => 26 + 26 / (1 + Math.min(this.deg(l.source), this.deg(l.target))));
      this.fg.d3Force("charge").strength(-105).distanceMax(340);
      this.fg.d3Force("center").strength(0.85);
      if (window.d3 && d3.forceCollide) {
        this.fg.d3Force("collide", d3.forceCollide((n) => this.radius(n) * 1.35).strength(0.75));
      }

      this.setupScene();
      this.applyTheme();
      this.renderLegend();
      this.bind();
      this.ready = true;

      this.paint();
      this.applyCameraMode();
      this.fg.onEngineStop(() => this.settle());
      setTimeout(() => this.settle(), 5000);

      $("#graph-hint").innerHTML =
        "trascina per ruotare · rotella per zoomare<br>clic su un nodo per aprirlo";
      this.loop();
    },

    /* ── dati ─────────────────────────────────────────────── */

    buildData() {
      /* index.md e log.md restano fuori dal grafo: l'index linka ogni pagina,
         quindi comparirebbe come l'hub piu' importante della wiki senza esserlo. */
      const pages = S.pages.filter((p) => !p.isMeta);
      const nodes = pages.map((p) => ({
        id: p.slug, title: p.title, category: p.category,
        deg: S.degree.get(p.slug) || 0,
        broken: (p.broken_links || []).length,
        orphan: S.health.orphans.indexOf(p.slug) >= 0,
      }));
      const inGraph = new Set(pages.map((p) => p.slug));
      const seen = new Set();
      const links = [];
      pages.forEach((p) => (p.links || []).forEach((t) => {
        if (!inGraph.has(t)) return;
        const key = p.slug < t ? p.slug + "|" + t : t + "|" + p.slug;
        if (seen.has(key)) return;
        seen.add(key);
        links.push({ source: p.slug, target: t });
      }));
      return { nodes, links };
    },

    deg(ref) { const id = ref && ref.id != null ? ref.id : ref; return S.degree.get(id) || 0; },
    nodeColor(ref) {
      const id = ref && ref.id != null ? ref.id : ref;
      return colorOf(S.bySlug.get(id));
    },
    isVisible(ref) {
      const id = ref && ref.id != null ? ref.id : ref;
      const page = S.bySlug.get(id);
      if (!page || page.isMeta) return false;
      if (S.hiddenCats.has(page.category)) return false;
      if (S.tag && !page.tags.includes(S.tag)) return false;
      if (this.focusMode && this.highlightNodes.size && !this.highlightNodes.has(id)) return false;
      return true;
    },

    radius(node) { return 2.8 + Math.sqrt(node.deg) * 1.7; },

    /* ── costruzione nodo ─────────────────────────────────── */

    buildNode(node) {
      const color = new THREE.Color(this.nodeColor(node));
      const r = this.radius(node);
      const group = new THREE.Group();

      /* Corpo: MeshStandardMaterial + luci = volume vero.
         La v1 usava MeshBasicMaterial, per questo i nodi sembravano ritagli piatti. */
      const body = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, r > 6 ? 3 : 2),
        new THREE.MeshStandardMaterial({
          color: color,
          emissive: color.clone().multiplyScalar(0.5),
          roughness: 0.28,
          metalness: 0.05,
          transparent: true,
          opacity: 1,
        })
      );
      group.add(body);

      const light = S.theme === "light";
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: color,
        transparent: true,
        opacity: light ? 0.2 : 0.5,
        /* In tema chiaro l'additivo satura verso il bianco e il grafo diventa
           una nebbia: li' serve blending normale. */
        blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthWrite: false,
      }));
      glow.scale.setScalar(r * 3.4);
      group.add(glow);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r * 1.5, r * 1.72, 48),
        new THREE.MeshBasicMaterial({
          color: color, transparent: true, opacity: 0,
          side: THREE.DoubleSide, depthWrite: false,
        })
      );
      group.add(ring);

      const label = this.buildLabel(node, r);
      group.add(label);

      const marks = [];
      if (node.broken) marks.push(this.buildMark(r, 0xf0616d, 1));
      if (node.orphan) marks.push(this.buildMark(r, 0xeab24a, -1));
      marks.forEach((m) => group.add(m));

      this.nodes.set(node.id, { group, body, glow, ring, label, color, r, marks });
      return group;
    },

    buildMark(r, hex, side) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(r * 0.3, 10, 10),
        new THREE.MeshBasicMaterial({ color: hex })
      );
      dot.position.set(r * 0.85 * side, r * 0.85, r * 0.4);
      return dot;
    },

    buildLabel(node, r) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const text = node.title.length > 26 ? node.title.slice(0, 25) + "…" : node.title;
      const fontSize = 30;
      const pad = 14;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const font = `500 ${fontSize}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.font = font;
      const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
      const h = fontSize + pad;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.font = font;

      const light = S.theme === "light";
      ctx.fillStyle = light ? "rgba(255,255,255,.92)" : "rgba(10,12,18,.82)";
      const rad = 7;
      ctx.beginPath();
      ctx.moveTo(rad, 0); ctx.lineTo(w - rad, 0); ctx.quadraticCurveTo(w, 0, w, rad);
      ctx.lineTo(w, h - rad); ctx.quadraticCurveTo(w, h, w - rad, h);
      ctx.lineTo(rad, h); ctx.quadraticCurveTo(0, h, 0, h - rad);
      ctx.lineTo(0, rad); ctx.quadraticCurveTo(0, 0, rad, 0);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = light ? "#10141c" : "#eef1f7";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, w / 2, h / 2 + 1);

      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;

      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, opacity: 0,
      }));
      sprite.scale.set((w / h) * 5.2, 5.2, 1);
      sprite.position.y = -(r + 5.5);
      sprite.userData.hub = node.deg;
      return sprite;
    },

    /* ── scena ────────────────────────────────────────────── */

    setupScene() {
      const scene = this.fg.scene();

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));

      const key = new THREE.DirectionalLight(0xffffff, 1.05);
      key.position.set(1, 1.3, 1);
      scene.add(key);

      const rim = new THREE.DirectionalLight(0x8fb0ff, 0.5);
      rim.position.set(-1, -0.6, -0.9);
      scene.add(rim);

      scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x0a0d16, 0.35));

      this.stars = this.buildStars();
      scene.add(this.stars);
    },

    buildStars() {
      const count = 900;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = 1400 + Math.random() * 1600;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return new THREE.Points(geo, new THREE.PointsMaterial({
        size: 2.4, color: 0x8ea3c8, transparent: true, opacity: 0.5,
        sizeAttenuation: false, depthWrite: false,
      }));
    },

    glowOpacity() { return S.theme === "light" ? 0.2 : 0.5; },

    applyTheme() {
      const light = S.theme === "light";
      const bg = light ? 0xf2f4f8 : 0x07080c;
      const scene = this.fg.scene();
      scene.fog = new THREE.FogExp2(bg, light ? 0.0016 : 0.0021);
      this.fg.backgroundColor(light ? "#f2f4f8" : "#07080c");
      if (this.stars) this.stars.material.opacity = light ? 0.16 : 0.5;
      this.nodes.forEach((n) => {
        n.body.material.emissiveIntensity = light ? 0.35 : 1;
        n.glow.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
        n.glow.material.needsUpdate = true;
      });
      this.rebuildLabels();
      this.paint();
    },

    rebuildLabels() {
      const data = this.fg.graphData();
      data.nodes.forEach((node) => {
        const entry = this.nodes.get(node.id);
        if (!entry) return;
        const fresh = this.buildLabel(node, entry.r);
        fresh.material.opacity = entry.label.material.opacity;
        entry.group.remove(entry.label);
        entry.label.material.map.dispose();
        entry.label.material.dispose();
        entry.group.add(fresh);
        entry.label = fresh;
      });
    },

    linkColor(link) {
      if (this.highlightLinks.has(link)) return this.nodeColor(link.source);
      const dim = this.highlightNodes.size > 0;
      return S.theme === "light"
        ? (dim ? "rgba(20,28,48,.07)" : "rgba(28,40,68,.34)")
        : (dim ? "rgba(150,175,230,.06)" : "rgba(158,182,235,.40)");
    },

    /* ── interazione ──────────────────────────────────────── */

    onHover(node) {
      $("#graph-canvas").style.cursor = node ? "pointer" : "grab";
      this.idleAt = Date.now();
      this.hovered = node;
      if (!this.selected) this.highlightFrom(node);
      this.card(node);
    },

    highlightFrom(node) {
      this.highlightNodes.clear();
      this.highlightLinks.clear();

      if (node) {
        this.highlightNodes.add(node.id);
        this.fg.graphData().links.forEach((l) => {
          const s = l.source.id != null ? l.source.id : l.source;
          const t = l.target.id != null ? l.target.id : l.target;
          if (s === node.id || t === node.id) {
            this.highlightLinks.add(l);
            this.highlightNodes.add(s);
            this.highlightNodes.add(t);
          }
        });
      }
      this.paint();
    },

    repaintLinks() {
      this.fg.linkColor(this.fg.linkColor())
             .linkWidth(this.fg.linkWidth())
             .linkDirectionalParticles(this.fg.linkDirectionalParticles());
    },

    paint() {
      const dimming = this.highlightNodes.size > 0;
      this.nodes.forEach((n, id) => {
        const on = !dimming || this.highlightNodes.has(id);
        const isSel = this.selected === id;

        n.body.material.opacity = on ? 1 : 0.12;
        n.glow.material.opacity = (on ? this.glowOpacity() : 0.04) * (isSel ? 1.8 : 1);
        n.ring.material.opacity = isSel ? 0.85 : 0;
        n.marks.forEach((m) => { m.material.opacity = on ? 1 : 0.1; m.material.transparent = true; });

        const showLabel = this.labelsAlways
          || isSel
          || (dimming && on)
          || (!dimming && n.label.userData.hub >= this.hubThreshold);
        n.label.material.opacity = showLabel ? (on ? 1 : 0.2) : 0;
      });
      this.repaintLinks();
    },

    get hubThreshold() {
      if (this._hubT != null) return this._hubT;
      const degrees = Array.from(S.degree.values()).sort((a, b) => b - a);
      this._hubT = degrees.length > 10 ? Math.max(2, degrees[Math.floor(degrees.length * 0.34)]) : 1;
      return this._hubT;
    },

    select(slug) {
      this.selected = slug;
      const node = slug ? this.fg.graphData().nodes.find((n) => n.id === slug) : null;
      this.highlightFrom(node);
      if (node && node.x != null) this.focus(node);
    },

    focus(node) {
      const dist = 90 + this.radius(node) * 5;
      const len = Math.hypot(node.x, node.y, node.z) || 1;
      const k = 1 + dist / len;
      this.fg.cameraPosition(
        { x: node.x * k, y: node.y * k, z: node.z * k },
        node, 850);
    },

    card(node) {
      const host = $("#node-card");
      if (!node) { host.hidden = true; return; }
      const page = S.bySlug.get(node.id);
      if (!page) { host.hidden = true; return; }

      const color = colorOf(page);
      host.innerHTML =
        `<div class="node-card__cat" style="color:${color}">${esc(page.category)}</div>
         <div class="node-card__title">${esc(page.title)}</div>
         <div class="node-card__excerpt">${esc(excerpt(page, 150))}</div>
         <div class="node-card__meta">
           <span>${plural((page.links || []).length, "link", "link")}</span>
           <span>${plural((page.backlinks || []).length, "backlink", "backlink")}</span>
           <span>${plural(page.words, "parola", "parole")}</span>
         </div>`;
      host.hidden = false;

      const rect = $("#view-graph").getBoundingClientRect();
      const coords = this.fg.graph2ScreenCoords
        ? this.fg.graph2ScreenCoords(node.x, node.y, node.z) : null;
      const x = coords ? coords.x : rect.width / 2;
      const y = coords ? coords.y : rect.height / 2;
      host.style.left = clamp(x + 22, 12, rect.width - 320) + "px";
      host.style.top  = clamp(y - 30, 12, rect.height - 170) + "px";
    },

    /* ── controlli ────────────────────────────────────────── */

    applyFilter() {
      this._hubT = null;
      this.fg.nodeVisibility(this.fg.nodeVisibility())
             .linkVisibility(this.fg.linkVisibility());
      this.paint();
      this.renderLegend();
    },

    toggleCat(cat) {
      if (S.hiddenCats.has(cat)) S.hiddenCats.delete(cat); else S.hiddenCats.add(cat);
      store.set("hiddenCats", Array.from(S.hiddenCats));
      this.applyFilter();
      Sidebar.renderTree();
    },

    renderLegend() {
      const host = $("#graph-legend");
      host.innerHTML = "";
      const counts = S.stats.categories || {};
      S.cats.forEach((cat) => host.appendChild(el("button", {
        class: "legend__item" + (S.hiddenCats.has(cat) ? " is-off" : ""),
        title: `Mostra/nascondi ${cat}`,
        onclick: () => this.toggleCat(cat),
        html: `<i class="legend__swatch" style="background:${S.colors[cat]}"></i>
               <span class="legend__name">${esc(cat)}</span>
               <em class="legend__n">${counts[cat] || 0}</em>`,
      })));
    },

    settle() {
      if (this.fitted) return;
      this.fitted = true;
      this.paint();
      /* Un solo fit, a simulazione ferma: rifarlo mentre il layout si espande
         lascia la camera troppo lontana e il grafo minuscolo. */
      this.fit(700);
    },

    fit(ms) {
      const host = $("#graph-canvas");
      if (host.clientWidth) this.fg.width(host.clientWidth).height(host.clientHeight);
      this.fg.zoomToFit(ms || 600, 55, (n) => this.isVisible(n));
      this.idleAt = Date.now();
    },

    toggle2d() {
      this.is2d = !this.is2d;
      this.fitted = false;
      this.fg.numDimensions(this.is2d ? 2 : 3);
      this.applyCameraMode();

      const btn = $('[data-action="mode2d"]');
      btn.classList.toggle("is-on", this.is2d);
      btn.textContent = this.is2d ? "3D" : "2D";
      $("#graph-hint").innerHTML = this.is2d
        ? "trascina per spostare · rotella per zoomare<br>clic su un nodo per aprirlo"
        : "trascina per ruotare · rotella per zoomare<br>clic su un nodo per aprirlo";

      // Il fit va fatto a layout fermo: con numDimensions cambiate la
      // simulazione riparte, e inquadrare a meta' corsa lascia il grafo
      // fuori campo.
      this.fg.d3ReheatSimulation();
      setTimeout(() => this.settle(), 2600);

      toast(this.is2d ? "Vista 2D — trascina per spostare" : "Vista 3D");
    },

    /* In 2D il grafo e' un piano z=0: se la camera orbita lo inquadra di taglio
       e il grafo si riduce a una riga, fino a sparire. Quindi in 2D si fa pan e
       zoom, mai rotazione — ne' col mouse ne' con la rotazione automatica. */
    applyCameraMode() {
      const controls = this.fg.controls();
      if (!controls) return;

      // Sono TrackballControls (default di 3d-force-graph), non OrbitControls:
      // le proprieta' sono noRotate/noPan/staticMoving, non enableRotate.
      if (this.is2d) {
        controls.noRotate = true;
        // Senza staticMoving il pan continua ad applicarsi con smorzamento per
        // decine di frame dopo il rilascio, e un trascinamento breve manda il
        // grafo fuori campo.
        controls.staticMoving = true;
        controls.panSpeed = 0.2;   // calibrato 1:1 col cursore
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN,
        };
        controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
        this.faceOn();
      } else {
        controls.noRotate = false;
        controls.staticMoving = false;
        controls.dynamicDampingFactor = 0.2;
        controls.panSpeed = 0.3;
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN,
        };
        controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
      }
    },

    /* Riporta la camera sull'asse z, perpendicolare al piano del grafo. */
    faceOn() {
      const cam = this.fg.cameraPosition();
      const dist = Math.hypot(cam.x, cam.y, cam.z) || 400;
      const c = this.centroid();
      this.fg.cameraPosition({ x: c.x, y: c.y, z: c.z + dist }, c, 500);
    },

    centroid() {
      const now = Date.now();
      if (this._cen && now - this._cenAt < 500) return this._cen;
      const nodes = this.fg.graphData().nodes.filter((n) => n.x != null && this.isVisible(n));
      if (!nodes.length) return { x: 0, y: 0, z: 0 };
      const sum = nodes.reduce((a, n) => ({
        x: a.x + n.x, y: a.y + (n.y || 0), z: a.z + (n.z || 0),
      }), { x: 0, y: 0, z: 0 });
      this._cen = { x: sum.x / nodes.length, y: sum.y / nodes.length, z: sum.z / nodes.length };
      this._cenAt = now;
      return this._cen;
    },

    toggleLabels() {
      this.labelsAlways = !this.labelsAlways;
      store.set("labelsAlways", this.labelsAlways);
      $('[data-action="labels"]').classList.toggle("is-on", this.labelsAlways);
      this.paint();
    },

    toggleFocus() {
      this.focusMode = !this.focusMode;
      store.set("focusMode", this.focusMode);
      $('[data-action="dim"]').classList.toggle("is-on", this.focusMode);
      this.fg.nodeVisibility(this.fg.nodeVisibility())
             .linkVisibility(this.fg.linkVisibility());
      toast(this.focusMode ? "Focus: isola il vicinato" : "Focus disattivato");
    },

    pause() { if (this.fg) this.fg.pauseAnimation(); },
    resume() { if (this.fg) { this.fg.resumeAnimation(); this.idleAt = Date.now(); } },

    bind() {
      const canvas = $("#graph-canvas");
      ["mousedown", "wheel", "touchstart"].forEach((ev) =>
        canvas.addEventListener(ev, () => { this.idleAt = Date.now(); }, { passive: true }));
      $('[data-action="labels"]').classList.toggle("is-on", this.labelsAlways);
      $('[data-action="dim"]').classList.toggle("is-on", this.focusMode);
      window.addEventListener("resize", debounce(() => {
        const host = $("#graph-canvas");
        if (host.clientWidth) this.fg.width(host.clientWidth).height(host.clientHeight);
      }, 200));
    },

    /* Rotazione lenta quando l'utente è fermo: dà volume alla scena senza
       rubare il controllo appena tocca qualcosa.

       Solo in 3D — in 2D porterebbe il piano di taglio. E orbita attorno al
       centroide conservando quota e distanza: attorno all'origine, una camera
       spostata dall'utente veniva riportata di forza sull'equatore. */
    loop() {
      const IDLE = 9000, SPEED = 0.00045;
      const tick = () => {
        requestAnimationFrame(tick);
        if (!this.ready || this.is2d || S.view !== "graph" || this.selected) return;
        if (Date.now() - this.idleAt < IDLE) return;

        const c = this.centroid();
        const cam = this.fg.cameraPosition();
        const dx = cam.x - c.x, dz = cam.z - c.z;
        const r = Math.hypot(dx, dz);
        if (r < 1) return;

        const angle = Math.atan2(dx, dz) + SPEED * (300 / Math.max(r, 60));
        this.fg.cameraPosition({
          x: c.x + r * Math.sin(angle),
          y: cam.y,
          z: c.z + r * Math.cos(angle),
        }, c);
      };
      requestAnimationFrame(tick);
    },
  };

  // ═════════════════════════════════════════════════ DOCUMENTO ══

  const Doc = {
    render(slug) {
      const page = S.bySlug.get(slug);
      if (!page) return;

      const color = colorOf(page);
      const fm = page.fm;
      const head = $("#doc-head");

      const meta = [];
      if (fm.updated)  meta.push(`Aggiornato <b>${esc(fm.updated)}</b>`);
      if (fm.verified) meta.push(`Verificato <b>${esc(fm.verified)}</b>`);
      if (fm.confidence) meta.push(`<span class="conf conf--${esc(fm.confidence)}">${esc(fm.confidence)}</span>`);
      meta.push(`${plural(page.words, "parola", "parole")}`);

      head.innerHTML =
        `<div class="doc__cat" style="color:${color}"><i style="background:${color}"></i>${esc(page.category)}</div>
         <h1>${esc(page.title)}</h1>
         <div class="doc__meta">${meta.join("<span style='opacity:.35'>·</span>")}
           <span class="doc__actions"></span>
         </div>
         ${page.tags.length ? `<div class="doc__tags">${page.tags.map((t) =>
            `<button class="tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
         ${(page.broken_links || []).length ? `<div class="doc__warn">
            <b>Link rotti in questa pagina:</b> ${page.broken_links.map((t) => `<code>[[${esc(t)}]]</code>`).join(" ")}
            <br>Correggili con <code>/llm-wiki-lint</code>.</div>` : ""}`;

      const actions = $(".doc__actions", head);
      actions.appendChild(el("button", {
        class: "btn", html: `<svg viewBox="0 0 20 20"><path d="M8 12l-3 3a2.8 2.8 0 004 4l2-2M12 8l3-3a2.8 2.8 0 00-4-4l-2 2"/><path d="M7.5 12.5l5-5"/></svg>Copia link`,
        onclick: () => {
          const url = location.href;
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast("Link copiato"));
          else toast(url);
        },
      }));
      const filePath = this.filePath(page);
      if (filePath) {
        actions.appendChild(el("a", {
          class: "btn", href: "obsidian://open?path=" + encodeURIComponent(filePath),
          title: filePath,
          html: `<svg viewBox="0 0 20 20"><path d="M10 2l6 4v8l-6 4-6-4V6z"/></svg>Obsidian`,
        }));
        actions.appendChild(el("a", {
          class: "btn", href: "file://" + filePath.replace(/\\/g, "/"),
          html: `<svg viewBox="0 0 20 20"><path d="M4 3h6l2 3h4v11H4z"/></svg>File`,
        }));
      }
      actions.appendChild(el("button", {
        class: "btn", html: `<svg viewBox="0 0 20 20"><path d="M6 8V3h8v5M6 15H4v-5h12v5h-2M6 12h8v5H6z"/></svg>Stampa`,
        onclick: () => window.print(),
      }));

      $$(".tag", head).forEach((b) => b.addEventListener("click", () => {
        Sidebar.setTag(b.dataset.tag);
        Router.view("graph");
      }));

      $("#doc-content").innerHTML = this.markdown(page);
      this.wireLinks($("#doc-content"));
      this.aside(page);
      this.foot(page);
    },

    filePath(page) {
      if (!S.root) return null;
      const sep = S.root.indexOf("\\") >= 0 ? "\\" : "/";
      return [S.root, "wiki"].concat(page.slug.split("/")).join(sep) + ".md";
    },

    markdown(page) {
      /* L'header del documento mostra gia' il titolo: un H1 identico in cima
         al corpo lo ripete due volte. */
      let body = page.content.replace(/^\s*(#{1,6})\s+(.+?)\s*$/m, (match, _hashes, heading) =>
        norm(heading) === norm(page.title) ? "" : match);

      const withLinks = body.replace(
        /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        (_, target, alias) => {
          const label = alias || target.split("/").pop();
          const found = findPage(target);
          return found
            ? `<a href="#${encodeURIComponent(found.slug)}" data-slug="${esc(found.slug)}">${esc(label)}</a>`
            : `<a class="is-broken" title="Pagina inesistente: ${esc(target)}" data-broken="${esc(target)}">${esc(label)}</a>`;
        });
      return typeof marked !== "undefined"
        ? (marked.parse ? marked.parse(withLinks) : marked(withLinks))
        : `<pre>${esc(withLinks)}</pre>`;
    },

    wireLinks(root) {
      $$("a[data-slug]", root).forEach((a) => a.addEventListener("click", (e) => {
        e.preventDefault(); Router.go(a.dataset.slug);
      }));
      $$("a[data-broken]", root).forEach((a) => a.addEventListener("click", (e) => {
        e.preventDefault(); toast(`«${a.dataset.broken}» non esiste ancora`);
      }));
      $$("h2, h3", root).forEach((h, i) => { if (!h.id) h.id = "s" + i; });
    },

    aside(page) {
      const host = $("#doc-aside");
      host.innerHTML = "";

      const toc = $$("#doc-content h2, #doc-content h3");
      if (toc.length > 1) {
        host.appendChild(this.block("In questa pagina", toc.map((h) => el("button", {
          class: "aside__link" + (h.tagName === "H3" ? " aside__link--sub" : ""),
          text: h.textContent,
          onclick: () => h.scrollIntoView({ behavior: "smooth", block: "start" }),
        }))));
      }

      const backlinks = (page.backlinks || []).map((s) => S.bySlug.get(s))
        .filter((p) => p && !p.isMeta);
      host.appendChild(this.block(
        `Backlink (${backlinks.length})`,
        backlinks.length
          ? backlinks.map((p) => this.link(p))
          : [el("div", { class: "aside__empty", text: "Nessuna pagina la collega. È orfana." })]));

      const out = (page.links || []).map((s) => S.bySlug.get(s))
        .filter((p) => p && !p.isMeta);
      if (out.length) host.appendChild(this.block(`Collega a (${out.length})`, out.map((p) => this.link(p))));

      const related = this.related(page);
      if (related.length) host.appendChild(this.block("Tag in comune", related.map((p) => this.link(p))));
    },

    block(title, children) {
      return el("div", { class: "aside__block" }, [
        el("h4", { text: title }),
        el("div", { class: "aside__list" }, children),
      ]);
    },

    link(page) {
      return el("button", {
        class: "aside__link", text: page.title, title: page.slug,
        onclick: () => Router.go(page.slug),
      });
    },

    related(page) {
      if (!page.tags.length) return [];
      const linked = new Set([].concat(page.links || [], page.backlinks || []));
      return S.pages
        .filter((p) => p.slug !== page.slug && !p.isMeta && !linked.has(p.slug))
        .map((p) => ({ p, n: p.tags.filter((t) => page.tags.includes(t)).length }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 5)
        .map((x) => x.p);
    },

    foot(page) {
      const host = $("#doc-foot");
      host.innerHTML = "";
      const sources = page.fm.sources;
      const list = (Array.isArray(sources) ? sources : [sources]).filter(Boolean);
      if (list.length) {
        const refs = [];
        list.forEach((s) => String(s).replace(/\[\[([^\]|]+)/g, (_, t) => {
          const found = findPage(t);
          refs.push(found ? this.link(found) : el("span", { class: "aside__empty", text: t }));
          return "";
        }));
        if (refs.length) host.appendChild(this.block("Fonti", refs));
      }
      host.appendChild(el("div", { class: "doc__meta", style: "margin-top:16px" }, [
        el("span", { text: `slug: ${page.slug}` }),
      ]));
    },
  };

  // ═══════════════════════════════════════════════════ RICERCA ══

  const Search = {
    /* Ranking allineato a tools/search.py: titolo e slug pesano più del corpo. */
    run(query) {
      const q = norm(query).trim();
      if (!q) return [];
      const terms = q.split(/\s+/).filter((t) => t.length > 1);
      if (!terms.length) return [];

      return S.contentPages.map((page) => {
        const title = norm(page.title), slug = norm(page.slug),
              tags = norm(page.tags.join(" ")), body = norm(page.content);
        let score = 0, hits = 0;
        terms.forEach((t) => {
          let s = 0;
          if (title === t) s += 60;
          if (title.indexOf(t) >= 0) s += 26;
          if (slug.indexOf(t) >= 0) s += 14;
          if (tags.indexOf(t) >= 0) s += 12;
          const n = body.split(t).length - 1;
          if (n) s += Math.min(10, 2 + Math.log2(n) * 2);
          if (s) hits++;
          score += s;
        });
        if (hits < terms.length) score *= 0.35;
        return { page, score };
      }).filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);
    },

    plain(text) {
      return text
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, a) => a || t.split("/").pop())
        .replace(/^\s{0,3}#{1,6}\s+/gm, "")
        .replace(/^\s{0,3}[-*+]\s+/gm, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^---+$/gm, " ")
        .replace(/\s+/g, " ")
        .trim();
    },

    snippet(page, query) {
      const body = this.plain(page.content);
      const terms = norm(query).split(/\s+/).filter((t) => t.length > 1);
      const low = norm(body);
      let at = -1;
      for (const t of terms) { const i = low.indexOf(t); if (i >= 0) { at = i; break; } }
      const start = at < 0 ? 0 : Math.max(0, at - 70);
      let text = body.slice(start, start + 230).trim();
      text = esc(text);
      terms.forEach((t) => {
        text = text.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
      });
      return (start ? "…" : "") + text + "…";
    },

    render() {
      const host = $("#search-results");
      const results = this.run(S.query);

      host.innerHTML = `<div class="panel__head">
          <h2>Ricerca</h2>
          <p>${S.query ? `${plural(results.length, "risultato", "risultati")} per «${esc(S.query)}»` : "Scrivi qualcosa per cercare."}</p>
        </div>`;

      if (!S.query) return;
      if (!results.length) {
        host.appendChild(el("div", { class: "empty" }, [
          el("div", { class: "empty__i", text: "◍" }),
          el("div", { class: "empty__t", text: "Nessun risultato" }),
          el("div", { class: "empty__d", html: `La wiki non copre ancora «${esc(S.query)}». Chiedi all'agente di crearne la pagina.` }),
        ]));
        return;
      }

      const list = el("div", { class: "items" });
      results.slice(0, 60).forEach(({ page }) => list.appendChild(el("button", {
        class: "item item--col",
        onclick: () => Router.go(page.slug),
        html: `<span style="display:flex;align-items:center;gap:12px">
                 <i class="item__dot" style="background:${colorOf(page)}"></i>
                 <b class="item__t">${esc(page.title)}</b>
                 <em class="item__s">${esc(page.category)}</em>
               </span>
               <span class="item__x" style="white-space:normal">${this.snippet(page, S.query)}</span>`,
      })));
      host.appendChild(list);
    },
  };

  // ════════════════════════════════════════════════ PANORAMICA ══

  const Overview = {
    render() {
      const host = $("#overview");
      const stats = S.stats;
      const broken = S.health.broken_links.length;
      const orphans = S.health.orphans.length;
      const content = S.contentPages;
      const words = content.reduce((n, p) => n + p.words, 0);

      host.innerHTML = `<div class="panel__head">
          <h2>Panoramica</h2>
          <p>${S.root ? esc(S.root) : "knowledge base"}${DATA.generated_at ? " · sync " + esc(DATA.generated_at.replace("T", " ")) : ""}</p>
        </div>`;

      host.appendChild(el("div", { class: "stats" }, [
        this.stat(content.length, "pagine"),
        this.stat(stats.content_links || stats.total_links || 0, "collegamenti"),
        this.stat(Math.round(words / 100) / 10 + "k", "parole"),
        this.stat(Object.keys(S.tags).length, "tag"),
        this.stat(broken, "link rotti", broken ? "err" : "ok"),
        this.stat(orphans, "orfane", orphans ? "err" : "ok"),
      ]));

      const counts = stats.categories || {};
      const max = Math.max(1, ...Object.values(counts));
      host.appendChild(this.section("Distribuzione", el("div", { class: "bars" },
        S.cats.map((cat) => el("div", { class: "bar" }, [
          el("span", { class: "bar__l", text: cat }),
          el("span", { class: "bar__t" }, [el("i", {
            class: "bar__f",
            style: `width:${((counts[cat] || 0) / max) * 100}%;background:${S.colors[cat]}`,
          })]),
          el("span", { class: "bar__n", text: String(counts[cat] || 0) }),
        ])))));

      const hubs = content.slice()
        .sort((a, b) => (S.degree.get(b.slug) || 0) - (S.degree.get(a.slug) || 0))
        .slice(0, 8);
      host.appendChild(this.section("Pagine più collegate",
        this.list(hubs, (p) => `${plural(S.degree.get(p.slug) || 0, "connessione", "connessioni")}`)));

      const recent = content.slice()
        .filter((p) => p.fm.updated)
        .sort((a, b) => String(b.fm.updated).localeCompare(String(a.fm.updated)))
        .slice(0, 8);
      if (recent.length) host.appendChild(this.section("Aggiornate di recente",
        this.list(recent, (p) => relTime(p.fm.updated))));

      const tags = Object.keys(S.tags).filter((t) => t !== "index").slice(0, 30);
      if (tags.length) {
        const cloud = el("div", { class: "doc__tags" });
        tags.forEach((t) => cloud.appendChild(el("button", {
          class: "tag", html: `#${esc(t)} <b style="opacity:.5">${S.tags[t]}</b>`,
          onclick: () => { Sidebar.setTag(t); Router.view("graph"); },
        })));
        host.appendChild(this.section("Tag", cloud));
      }
    },

    stat(n, label, tone) {
      return el("div", { class: "stat" }, [
        el("div", { class: "stat__n" + (tone ? " " + tone : ""), text: String(n) }),
        el("div", { class: "stat__l", text: label }),
      ]);
    },

    section(title, body) {
      return el("div", { class: "section" }, [el("h3", { text: title }), body]);
    },

    list(pages, sub) {
      return el("div", { class: "items" }, pages.map((p) => el("button", {
        class: "item",
        onclick: () => Router.go(p.slug),
        html: `<i class="item__dot" style="background:${colorOf(p)}"></i>
               <b class="item__t">${esc(p.title)}</b>
               <em class="item__s">${esc(sub(p))}</em>`,
      })));
    },
  };

  // ═════════════════════════════════════════════════▸ ATTIVITÀ ══

  const Activity = {
    render() {
      const host = $("#activity");
      host.innerHTML = `<div class="panel__head">
          <h2>Attività</h2>
          <p>Come la wiki è cresciuta, da <code>wiki/log.md</code>.</p>
        </div>`;

      if (!S.log.length) {
        host.appendChild(el("div", { class: "empty" }, [
          el("div", { class: "empty__i", text: "◍" }),
          el("div", { class: "empty__t", text: "Nessuna attività registrata" }),
          el("div", { class: "empty__d", html: "Il log si popola a ogni ingest, query o lint dell'agente." }),
        ]));
        return;
      }

      const tl = el("div", { class: "tl" });
      S.log.forEach((entry) => {
        const item = el("div", { class: "tl__e", "data-kind": entry.kind });
        item.appendChild(el("div", { class: "tl__h", html:
          `<span class="tl__d">${esc(entry.date)}</span>
           <span class="tl__k">${esc(entry.kind)}</span>
           <span class="tl__t">${esc(entry.title)}</span>` }));
        if (entry.details && entry.details.length) {
          const ul = el("ul", { class: "tl__l" });
          entry.details.forEach((d) => {
            const html = esc(d.replace(/^[-*]\s*/, ""))
              .replace(/`([^`]+)`/g, "<code>$1</code>")
              .replace(
              /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
              (_, target, alias) => {
                const page = findPage(target);
                return page
                  ? `<a href="#${encodeURIComponent(page.slug)}" data-slug="${esc(page.slug)}">${esc(alias || target)}</a>`
                  : `<code>${esc(target)}</code>`;
              });
            ul.appendChild(el("li", { html }));
          });
          item.appendChild(ul);
        }
        tl.appendChild(item);
      });
      host.appendChild(tl);
      Doc.wireLinks(host);
    },
  };

  // ═══════════════════════════════════════════════════▸ SALUTE ══

  const Health = {
    render() {
      const host = $("#health");
      const broken = S.health.broken_links || [];
      const orphans = S.health.orphans || [];
      const bloated = S.contentPages.filter((p) => p.words > 500);
      const noTags = S.contentPages.filter((p) => !p.tags.length);

      host.innerHTML = `<div class="panel__head">
          <h2>Salute della wiki</h2>
          <p>${plural(S.contentPages.length, "pagina", "pagine")} · ${plural(S.stats.content_links || 0, "collegamento", "collegamenti")}${
            DATA.generated_at ? " · sync " + esc(DATA.generated_at.replace("T", " ")) : ""}</p>
        </div>`;

      if (!broken.length && !orphans.length && !bloated.length) {
        host.appendChild(el("div", { class: "ok-note", html:
          `<svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9"/></svg>
           Nessun problema rilevato. La wiki è in salute.` }));
      }

      if (broken.length) {
        host.appendChild(this.section("Link rotti", broken.length,
          "Wikilink che puntano a pagine inesistenti: nel grafo non esistono, e la conoscenza a cui rimandano non c'è.",
          broken.map((b) => {
            const page = S.bySlug.get(b.from);
            return el("button", {
              class: "item", onclick: () => Router.go(b.from),
              html: `<i class="item__dot" style="background:var(--err)"></i>
                     <b class="item__t">${esc(page ? page.title : b.from)}</b>
                     <em class="item__s">→ [[${esc(b.target)}]]</em>`,
            });
          })));
      }

      if (orphans.length) {
        host.appendChild(this.section("Pagine orfane", orphans.length,
          "Nessuna pagina le collega: nel grafo sono isolate e nella pratica non le ritrovi più.",
          orphans.map((slug) => {
            const page = S.bySlug.get(slug);
            return el("button", {
              class: "item", onclick: () => Router.go(slug),
              html: `<i class="item__dot" style="background:var(--warn)"></i>
                     <b class="item__t">${esc(page ? page.title : slug)}</b>
                     <em class="item__s">${esc(page ? page.category : "")}</em>`,
            });
          })));
      }

      if (bloated.length) {
        host.appendChild(this.section("Pagine troppo lunghe", bloated.length,
          "Oltre 500 parole. La distillazione accorcia: vanno divise in pagine più precise.",
          bloated.sort((a, b) => b.words - a.words).map((p) => el("button", {
            class: "item", onclick: () => Router.go(p.slug),
            html: `<i class="item__dot" style="background:${colorOf(p)}"></i>
                   <b class="item__t">${esc(p.title)}</b>
                   <em class="item__s">${p.words} parole</em>`,
          }))));
      }

      if (noTags.length) {
        host.appendChild(this.section("Senza tag", noTags.length,
          "Senza tag una pagina è raggiungibile solo dal grafo o dalla ricerca.",
          noTags.slice(0, 20).map((p) => el("button", {
            class: "item", onclick: () => Router.go(p.slug),
            html: `<i class="item__dot" style="background:${colorOf(p)}"></i>
                   <b class="item__t">${esc(p.title)}</b>
                   <em class="item__s">${esc(p.category)}</em>`,
          }))));
      }

      host.appendChild(el("p", { class: "hint", style: "margin-top:32px", html:
        "Correggi tutto con <code>/llm-wiki-lint</code>, oppure <code>python3 tools/lint.py</code> da terminale." }));
    },

    section(title, count, hint, items) {
      return el("div", { class: "section" }, [
        el("h3", { html: `${esc(title)} <em>${count}</em>` }),
        el("p", { class: "hint", text: hint }),
        el("div", { class: "items" }, items),
      ]);
    },
  };

  // ══════════════════════════════════════════ COMMAND PALETTE ══

  const Palette = {
    open: false, index: 0, items: [],

    actions: [
      { icon: "◍", label: "Vai al grafo",        run: () => Router.view("graph"),    keys: "G" },
      { icon: "▤", label: "Panoramica",          run: () => Router.view("overview"), keys: "O" },
      { icon: "◷", label: "Attività",            run: () => Router.view("activity"), keys: "A" },
      { icon: "♡", label: "Salute della wiki",   run: () => Router.view("health"),   keys: "H" },
      { icon: "◐", label: "Tema chiaro / scuro", run: () => Theme.toggle(),          keys: "T" },
      { icon: "⛶", label: "Inquadra il grafo",   run: () => { Router.view("graph"); setTimeout(() => Graph.fit(), 60); }, keys: "0" },
      { icon: "✕", label: "Azzera i filtri",     run: () => { S.hiddenCats.clear(); store.set("hiddenCats", []); Sidebar.setTag(null); Graph.applyFilter(); Graph.renderLegend(); } },
    ],

    init() {
      const input = $("#palette-input");
      input.addEventListener("input", () => { this.index = 0; this.list(input.value); });
      input.addEventListener("keydown", (e) => this.key(e));
      $$('[data-action="palette-close"]').forEach((n) => n.addEventListener("click", () => this.close()));
    },

    show() {
      this.open = true;
      this.index = 0;
      $("#palette").hidden = false;
      const input = $("#palette-input");
      input.value = "";
      this.list("");
      setTimeout(() => input.focus(), 10);
    },

    close() { this.open = false; $("#palette").hidden = true; },

    list(query) {
      const host = $("#palette-list");
      host.innerHTML = "";
      this.items = [];

      const q = norm(query).trim();

      if (!q) {
        const recent = S.contentPages.filter((p) => p.fm.updated)
          .sort((a, b) => String(b.fm.updated).localeCompare(String(a.fm.updated))).slice(0, 5);
        this.group(host, "Recenti", recent.map((p) => this.pageItem(p)));
        this.group(host, "Azioni", this.actions.map((a) => this.actionItem(a)));
      } else {
        const hits = Search.run(query).slice(0, 8);
        if (hits.length) this.group(host, "Pagine", hits.map(({ page }) => this.pageItem(page)));

        const tags = Object.keys(S.tags).filter((t) => norm(t).indexOf(q) >= 0).slice(0, 4);
        if (tags.length) this.group(host, "Tag", tags.map((t) => ({
          icon: "#", title: t, sub: plural(S.tags[t], "pagina", "pagine"),
          run: () => { Sidebar.setTag(t); Router.view("graph"); },
        })).map((i) => this.mk(i)));

        const acts = this.actions.filter((a) => norm(a.label).indexOf(q) >= 0);
        if (acts.length) this.group(host, "Azioni", acts.map((a) => this.actionItem(a)));

        this.group(host, "Ricerca", [this.mk({
          icon: "⌕", title: `Cerca «${query}» in tutta la wiki`,
          sub: "risultati con anteprima", run: () => Router.view("search", query),
        })]);
      }

      if (!this.items.length) host.appendChild(el("div", { class: "palette__empty", text: "Nessun risultato." }));
      this.paint();
    },

    group(host, title, nodes) {
      if (!nodes.length) return;
      host.appendChild(el("div", { class: "pal-sec", text: title }));
      nodes.forEach((n) => host.appendChild(n));
    },

    pageItem(page) {
      return this.mk({
        dot: colorOf(page), title: page.title,
        sub: page.slug + " · " + plural(S.degree.get(page.slug) || 0, "connessione", "connessioni"),
        run: () => Router.go(page.slug),
      });
    },

    actionItem(a) {
      return this.mk({ icon: a.icon, title: a.label, keys: a.keys, run: a.run });
    },

    mk(spec) {
      const node = el("button", {
        class: "pal-item",
        onclick: () => { this.close(); spec.run(); },
        html: `${spec.dot ? `<i class="pal-item__dot" style="background:${spec.dot}"></i>`
                          : `<span class="pal-item__ico">${esc(spec.icon || "›")}</span>`}
               <span class="pal-item__b">
                 <span class="pal-item__t">${esc(spec.title)}</span>
                 ${spec.sub ? `<span class="pal-item__s">${esc(spec.sub)}</span>` : ""}
               </span>
               ${spec.keys ? `<kbd class="pal-item__k">${esc(spec.keys)}</kbd>` : ""}`,
      });
      node.addEventListener("mousemove", () => {
        const i = this.items.indexOf(node);
        if (i >= 0 && i !== this.index) { this.index = i; this.paint(); }
      });
      this.items.push(node);
      return node;
    },

    paint() {
      this.items.forEach((n, i) => n.classList.toggle("is-sel", i === this.index));
      const sel = this.items[this.index];
      if (sel) sel.scrollIntoView({ block: "nearest" });
    },

    key(e) {
      if (e.key === "ArrowDown") { e.preventDefault(); this.index = (this.index + 1) % this.items.length; this.paint(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); this.index = (this.index - 1 + this.items.length) % this.items.length; this.paint(); }
      else if (e.key === "Enter") { e.preventDefault(); const n = this.items[this.index]; if (n) n.click(); }
      else if (e.key === "Tab") { e.preventDefault(); const q = $("#palette-input").value; if (q) { this.close(); Router.view("search", q); } }
      else if (e.key === "Escape") { e.preventDefault(); this.close(); }
    },
  };

  // ═════════════════════════════════════════════════ SHORTCUTS ══

  const KEYS = [
    ["Generale", null],
    ["Cerca ed esegui", ["⌘", "K"]],
    ["Scorciatoie", ["?"]],
    ["Tema chiaro / scuro", ["T"]],
    ["Sidebar", ["S"]],
    ["Indietro", ["Esc"]],
    ["Viste", null],
    ["Grafo", ["G"]],
    ["Panoramica", ["O"]],
    ["Attività", ["A"]],
    ["Salute", ["H"]],
    ["Grafo", null],
    ["Inquadra tutto", ["0"]],
    ["Vista 2D / 3D", ["D"]],
    ["Etichette sempre visibili", ["L"]],
    ["Focus sul vicinato", ["F"]],
  ];

  const Shortcuts = {
    init() {
      $("#help-body").innerHTML = `<div class="keys">${KEYS.map(([label, keys]) =>
        keys === null
          ? `<div class="keys__sec">${esc(label)}</div>`
          : `<span>${esc(label)}</span><div>${keys.map((k) => `<kbd>${esc(k)}</kbd>`).join("")}</div>`
      ).join("")}</div>`;

      document.addEventListener("click", (e) => {
        const target = e.target.closest("[data-action], [data-view]");
        if (!target) return;
        if (target.dataset.view) return Router.view(target.dataset.view);
        this.action(target.dataset.action);
      });

      document.addEventListener("keydown", (e) => this.key(e));
    },

    action(name) {
      switch (name) {
        case "palette": Palette.show(); break;
        case "palette-close": Palette.close(); break;
        case "theme": Theme.toggle(); break;
        case "toggle-sidebar": {
          $("#app").classList.toggle("sidebar-hidden");
          setTimeout(() => {
            const host = $("#graph-canvas");
            if (Graph.fg && host.clientWidth) Graph.fg.width(host.clientWidth).height(host.clientHeight);
          }, 230);
          break;
        }
        case "help": $("#help").hidden = false; break;
        case "help-close": $("#help").hidden = true; break;
        case "fit": Graph.fit(); break;
        case "mode2d": Graph.toggle2d(); break;
        case "labels": Graph.toggleLabels(); break;
        case "dim": Graph.toggleFocus(); break;
      }
    },

    key(e) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)
        || document.activeElement.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); return Palette.open ? Palette.close() : Palette.show();
      }
      if (Palette.open || typing) return;

      if (e.key === "Escape") {
        if (!$("#help").hidden) return this.action("help-close");
        if (S.view === "page") return Router.back();
        return Router.view("graph");
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const map = {
        "/": () => Palette.show(),
        "?": () => this.action("help"),
        g: () => Router.view("graph"),
        o: () => Router.view("overview"),
        a: () => Router.view("activity"),
        h: () => Router.view("health"),
        t: () => Theme.toggle(),
        s: () => this.action("toggle-sidebar"),
        "0": () => { Router.view("graph"); setTimeout(() => Graph.fit(), 60); },
        d: () => { Router.view("graph"); Graph.toggle2d(); },
        l: () => Graph.toggleLabels(),
        f: () => Graph.toggleFocus(),
      };
      const fn = map[e.key.toLowerCase()];
      if (fn) { e.preventDefault(); fn(); }
    },
  };

  // ─────────────────────────────────────────────────────── go ──

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
