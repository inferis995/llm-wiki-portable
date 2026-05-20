// LLM Wiki Portable — app.js
// Static HTML/JS wiki viewer with 3D graph

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────
  const FALLBACK_COLOR       = "#6b7280";
  const IDLE_DELAY_MS        = 4000;   // ms before ambient rotation starts
  const ROTATION_SPEED       = 0.0025;
  const ROTATION_RADIUS      = 320;

  let CATEGORY_COLORS = {};
  let CATEGORY_ORDER  = [];

  // ── State ──────────────────────────────────────────────────
  let pages              = [];
  let pageBySlug         = new Map();
  let graphData          = { nodes: [], links: [] };
  let activeSlug         = null;
  let graph              = null;
  let collapsedCategories = new Set();

  // Highlight state
  let hoveredNode        = null;
  let highlightNodes     = new Set();
  let highlightLinks     = new Set();
  const nodeMaterials    = {};  // nodeId → { core, glow, baseColor }

  // Rotation state
  let lastInteractionTime = Date.now();
  let rotationAngle       = 0;
  let rotationRunning     = false;

  // ── DOM refs ───────────────────────────────────────────────
  const sidebarPages   = document.getElementById("sidebar-pages");
  const searchInput    = document.getElementById("search");
  const graphContainer = document.getElementById("graph-container");
  const pageViewer     = document.getElementById("page-viewer");
  const pageHeader     = document.getElementById("page-header");
  const pageContent    = document.getElementById("page-content");
  const pageLinks      = document.getElementById("page-links");
  const backBtn        = document.getElementById("back-btn");
  const toggleBtn      = document.getElementById("toggle-sidebar");
  const sidebar        = document.getElementById("sidebar");
  const topbarTitle    = document.getElementById("topbar-title");
  const legend         = document.getElementById("legend");
  const pageCount      = document.getElementById("page-count");
  const linkCount      = document.getElementById("link-count");

  // ── Init ───────────────────────────────────────────────────
  function init() {
    if (typeof WIKI_DATA === "undefined") {
      graphContainer.innerHTML =
        '<div class="loading">data.js non trovato. Esegui sync.py prima.</div>';
      return;
    }
    pages = WIKI_DATA.pages || [];

    if (pages.length === 0) {
      graphContainer.innerHTML =
        '<div class="loading">Nessuna pagina nella wiki.</div>';
      return;
    }

    const rawCats = WIKI_DATA.categories || {};
    CATEGORY_COLORS = Object.assign({ root: FALLBACK_COLOR }, rawCats);
    CATEGORY_ORDER  = Object.keys(rawCats);

    pages.forEach((p) => pageBySlug.set(p.slug, p));

    graphData = buildGraphData(pages);
    buildLegend();
    renderSidebar();
    updateStats();
    initGraph();
    bindEvents();
    startRotationLoop();

    if (location.hash) {
      const slug = decodeURIComponent(location.hash.slice(1));
      if (slug && pageBySlug.has(slug)) navigateTo(slug, false);
    }
  }

  // ── Legend ─────────────────────────────────────────────────
  function catLabel(cat) {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  function buildLegend() {
    if (!legend) return;
    legend.innerHTML = CATEGORY_ORDER.map(
      (cat) =>
        `<span class="legend-item">` +
        `<span class="category-dot" style="background:${CATEGORY_COLORS[cat] || FALLBACK_COLOR}"></span>` +
        `${catLabel(cat)}</span>`
    ).join("");
  }

  // ── Graph Data ─────────────────────────────────────────────
  function buildGraphData(pages) {
    const nodes = pages.map((p) => ({
      id:       p.slug,
      title:    p.title,
      category: p.category,
    }));

    const linkSet = new Set();
    const links   = [];

    pages.forEach((page) => {
      (page.links || []).forEach((link) => {
        const target = pageBySlug.get(link);
        if (!target) return;
        const key = [page.slug, target.slug].sort().join("|");
        if (linkSet.has(key)) return;
        linkSet.add(key);
        links.push({ source: page.slug, target: target.slug });
      });
    });

    const connected = new Set();
    links.forEach((l) => { connected.add(l.source); connected.add(l.target); });

    const connCounts = {};
    links.forEach((l) => {
      connCounts[l.source] = (connCounts[l.source] || 0) + 1;
      connCounts[l.target] = (connCounts[l.target] || 0) + 1;
    });
    let hubId = nodes[0]?.id || "";
    let maxC  = 0;
    for (const [id, c] of Object.entries(connCounts)) {
      if (c > maxC) { maxC = c; hubId = id; }
    }

    nodes.forEach((n) => {
      if (!connected.has(n.id) && n.id !== hubId)
        links.push({ source: n.id, target: hubId, __virtual: true });
    });

    const byCat = {};
    nodes.forEach((n) => {
      if (!byCat[n.category]) byCat[n.category] = [];
      byCat[n.category].push(n.id);
    });
    for (const catNodes of Object.values(byCat)) {
      for (let i = 1; i < catNodes.length; i++) {
        const a = catNodes[i - 1], b = catNodes[i];
        const key = [a, b].sort().join("|");
        if (!linkSet.has(key))
          links.push({ source: a, target: b, __virtual: true });
      }
    }

    return { nodes, links };
  }

  // ── Connection count map ────────────────────────────────────
  function buildConnCounts() {
    const counts = {};
    graphData.links.forEach((l) => {
      if (l.__virtual) return;
      const s = l.source?.id || l.source;
      const t = l.target?.id || l.target;
      counts[s] = (counts[s] || 0) + 1;
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }

  // ── Sidebar ────────────────────────────────────────────────
  function renderSidebar(query) {
    const q = (query || "").toLowerCase().trim();
    const grouped = {};

    pages.forEach((p) => {
      if (q) {
        const matchTitle   = p.title.toLowerCase().includes(q);
        const matchTags    = (p.frontmatter.tags || []).some((t) => t.toLowerCase().includes(q));
        const matchContent = p.content.toLowerCase().includes(q);
        if (!matchTitle && !matchTags && !matchContent) return;
      }
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });

    let html = "";
    const allCats = [...CATEGORY_ORDER, "root"].filter((c, i, a) => a.indexOf(c) === i);
    allCats.forEach((cat) => {
      const catPages = grouped[cat];
      if (!catPages) return;
      const collapsed = collapsedCategories.has(cat);
      html += `<div class="category-group">
        <div class="category-header" data-cat="${cat}">
          <span class="category-dot" style="background:${CATEGORY_COLORS[cat] || FALLBACK_COLOR}"></span>
          ${catLabel(cat)}
          <span class="category-count">${catPages.length}</span>
          <span class="category-arrow">${collapsed ? "▶" : "▼"}</span>
        </div>`;
      if (!collapsed) {
        catPages.forEach((p) => {
          const isActive = activeSlug === p.slug ? " active" : "";
          html += `<div class="sidebar-link${isActive}" data-slug="${p.slug}">${p.title}</div>`;
        });
      }
      html += "</div>";
    });

    sidebarPages.innerHTML = html;

    sidebarPages.querySelectorAll(".category-header").forEach((el) => {
      el.addEventListener("click", () => {
        const cat = el.dataset.cat;
        if (collapsedCategories.has(cat)) collapsedCategories.delete(cat);
        else collapsedCategories.add(cat);
        renderSidebar(searchInput.value);
      });
    });

    sidebarPages.querySelectorAll(".sidebar-link").forEach((el) => {
      el.addEventListener("click", () => navigateTo(el.dataset.slug));
    });
  }

  // ── Stats ──────────────────────────────────────────────────
  function updateStats() {
    const realLinks = graphData.links.filter((l) => !l.__virtual).length;
    if (pageCount) pageCount.textContent = `${pages.length} pagine`;
    if (linkCount) linkCount.textContent = `${realLinks} link`;
  }

  // ── Navigation ─────────────────────────────────────────────
  function navigateTo(slug, updateHash = true) {
    activeSlug = slug;
    if (updateHash)
      history.pushState(null, "", "#" + encodeURIComponent(slug));
    renderSidebar(searchInput.value);
    showPage(slug);
  }

  function findPage(slug) {
    if (pageBySlug.has(slug)) return pageBySlug.get(slug);
    for (const p of pages) {
      if (p.slug.endsWith("/" + slug)) return p;
      if (p.title.toLowerCase() === slug.toLowerCase()) return p;
    }
    return null;
  }

  function showPage(slug) {
    const page = findPage(slug);
    if (!page) return;

    graphContainer.style.display = "none";
    pageViewer.classList.add("active");
    backBtn.style.display = "inline-flex";
    topbarTitle.textContent = page.title;

    const catColor = CATEGORY_COLORS[page.category] || FALLBACK_COLOR;
    let headerHtml =
      `<span class="category-badge" style="background:${catColor}30;color:${catColor}">${catLabel(page.category)}</span>` +
      `<h2>${page.title}</h2><div class="meta">`;
    if (page.frontmatter.updated)
      headerHtml += `Aggiornato: ${page.frontmatter.updated}`;
    if (page.frontmatter.sources)
      headerHtml += ` · Fonti: ${page.frontmatter.sources}`;
    headerHtml += "</div>";

    if (page.frontmatter.tags?.length) {
      headerHtml += '<div class="tags">';
      page.frontmatter.tags.forEach((t) => { headerHtml += `<span class="tag">${t}</span>`; });
      headerHtml += "</div>";
    }
    pageHeader.innerHTML = headerHtml;

    pageContent.innerHTML = marked.parse(processWikilinks(page.content));
    pageContent.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && !href.startsWith("http") && !href.startsWith("mailto:")) {
        a.addEventListener("click", (e) => { e.preventDefault(); navigateTo(href); });
        a.classList.add("wiki-link");
      } else {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        a.classList.add("wiki-link");
      }
    });

    let linksHtml = "";
    if (page.backlinks?.length) {
      linksHtml += `<div class="links-section"><h3>Backlinks</h3><div>`;
      page.backlinks.forEach((bl) => {
        const blPage = findPage(bl);
        linksHtml += `<a data-slug="${bl}">${blPage ? blPage.title : bl.split("/").pop()}</a>`;
      });
      linksHtml += "</div></div>";
    }
    if (page.links?.length) {
      linksHtml += `<div class="links-section"><h3>Correlati</h3><div>`;
      page.links.forEach((link) => {
        const lp = findPage(link);
        linksHtml += `<a data-slug="${link}">${lp ? lp.title : link}</a>`;
      });
      linksHtml += "</div></div>";
    }
    pageLinks.innerHTML = linksHtml;
    pageLinks.querySelectorAll("a[data-slug]").forEach((el) => {
      el.addEventListener("click", () => navigateTo(el.dataset.slug));
    });
  }

  function showGraph() {
    activeSlug = null;
    history.pushState(null, "", location.pathname + location.search);
    pageViewer.classList.remove("active");
    graphContainer.style.display = "block";
    backBtn.style.display = "none";
    topbarTitle.textContent = "";
    renderSidebar(searchInput.value);
  }

  function processWikilinks(content) {
    return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, slug, alias) => {
      const display = alias || slug.split("/").pop() || slug;
      return `[${display}](${slug})`;
    });
  }

  // ── Highlight helpers ──────────────────────────────────────
  function updateHighlight(node) {
    hoveredNode = node;
    highlightNodes.clear();
    highlightLinks.clear();

    if (node) {
      highlightNodes.add(node.id || node);
      graphData.links.forEach((l) => {
        if (l.__virtual) return;
        const s = l.source?.id ?? l.source;
        const t = l.target?.id ?? l.target;
        const nid = node.id || node;
        if (s === nid || t === nid) {
          highlightLinks.add(l);
          highlightNodes.add(s);
          highlightNodes.add(t);
        }
      });
    }

    // Update Three.js materials directly (no re-render needed)
    graphData.nodes.forEach((n) => {
      const mats = nodeMaterials[n.id];
      if (!mats) return;
      const active = !hoveredNode || highlightNodes.has(n.id);
      const col = new THREE.Color(mats.baseColor);
      mats.core.color.set(active ? col : new THREE.Color(0x111111));
      mats.core.opacity   = active ? 0.95 : 0.12;
      mats.glow.color.set(active ? col : new THREE.Color(0x111111));
      mats.glow.opacity   = active ? 0.12 : 0.01;
    });
  }

  // ── 3D Graph ───────────────────────────────────────────────
  function initGraph() {
    const connCounts = buildConnCounts();

    graph = ForceGraph3D()(graphContainer)
      .graphData(graphData)
      .backgroundColor("#07070c")
      .enableNodeDrag(true)
      .cooldownTicks(400)
      .d3AlphaDecay(0.012)
      .d3VelocityDecay(0.25)
      .showNavInfo(false)

      // Links — clean lines, no arrows
      .linkColor((l) => {
        if (l.__virtual) return "rgba(0,0,0,0)";
        const active = !hoveredNode || highlightLinks.has(l);
        return active ? "rgba(160,180,220,0.5)" : "rgba(40,40,60,0.15)";
      })
      .linkWidth((l) => l.__virtual ? 0 : 1)
      .linkOpacity(1)
      .linkDirectionalArrowLength(0)

      // Particles — animated flow along real links
      .linkDirectionalParticles((l) => l.__virtual ? 0 : 2)
      .linkDirectionalParticleWidth((l) => {
        if (l.__virtual) return 0;
        return !hoveredNode || highlightLinks.has(l) ? 2 : 0;
      })
      .linkDirectionalParticleSpeed(0.005)
      .linkDirectionalParticleColor((l) => {
        const s = l.source?.id ?? l.source;
        const t = l.target?.id ?? l.target;
        const sNode = graphData.nodes.find((n) => n.id === s);
        return sNode ? CATEGORY_COLORS[sNode.category] || FALLBACK_COLOR : FALLBACK_COLOR;
      })

      // Nodes — custom Three.js objects
      .nodeThreeObject((node) => buildNodeObject(node, connCounts))
      .nodeThreeObjectExtend(true)

      // Hover
      .onNodeHover((node) => {
        graphContainer.style.cursor = node ? "pointer" : "default";
        updateHighlight(node);
        resetIdleTimer();

        // Show/hide label for hovered node
        graphData.nodes.forEach((n) => {
          const mats = nodeMaterials[n.id];
          if (mats?.label) {
            mats.label.visible = node && n.id === (node.id || node);
          }
        });
      })

      // Click
      .onNodeClick((node) => {
        navigateTo(node.id);
        resetIdleTimer();
        const dist = 60;
        graph.cameraPosition(
          { x: node.x + dist, y: node.y + dist * 0.3, z: node.z + dist },
          node,
          900
        );
      })

      // Background click → deselect highlight
      .onBackgroundClick(() => { updateHighlight(null); });

    // Force tuning
    graph.d3Force("link").distance((l) => l.__virtual ? 20 : 50);
    graph.d3Force("charge").strength(-60);
    graph.d3Force("center").strength(0.8);

    // Initial fit
    setTimeout(() => graph.zoomToFit(400, 60), 3000);
  }

  function buildNodeObject(node, connCounts) {
    const color = CATEGORY_COLORS[node.category] || FALLBACK_COLOR;
    const count = connCounts[node.id] || 0;
    const size  = 3 + Math.sqrt(count) * 2;   // sqrt scaling: hubs are big, leaves are small

    const group = new THREE.Group();

    // Core sphere
    const geo = new THREE.SphereGeometry(size, 20, 20);
    const mat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color(color),
      transparent: true,
      opacity:     0.95,
    });
    group.add(new THREE.Mesh(geo, mat));

    // Glow halo
    const glowGeo = new THREE.SphereGeometry(size * 2, 12, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color(color),
      transparent: true,
      opacity:     0.10,
      side:        THREE.BackSide,
    });
    group.add(new THREE.Mesh(glowGeo, glowMat));

    // Floating label — visible only on hover
    const label  = shortTitle(node.title || "", 22);
    const canvas = document.createElement("canvas");
    const ctx    = canvas.getContext("2d");
    const fs     = 32;
    ctx.font     = `${fs}px Inter, Arial, sans-serif`;
    const tw     = ctx.measureText(label).width || label.length * fs * 0.5;
    canvas.width  = Math.ceil(tw + 28);
    canvas.height = fs + 18;
    ctx.font      = `${fs}px Inter, Arial, sans-serif`;

    // pill background
    const pw = canvas.width, ph = canvas.height, r = 7;
    ctx.fillStyle = "rgba(10,10,18,0.88)";
    ctx.beginPath();
    ctx.moveTo(r,0); ctx.lineTo(pw-r,0); ctx.quadraticCurveTo(pw,0,pw,r);
    ctx.lineTo(pw,ph-r); ctx.quadraticCurveTo(pw,ph,pw-r,ph);
    ctx.lineTo(r,ph); ctx.quadraticCurveTo(0,ph,0,ph-r);
    ctx.lineTo(0,r); ctx.quadraticCurveTo(0,0,r,0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle    = "#e2e8f0";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, pw / 2, ph / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, sizeAttenuation: true })
    );
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(aspect * 4, 4, 1);
    sprite.position.y = -(size + 4);
    sprite.visible = false;   // hidden by default, shown on hover
    group.add(sprite);

    // Store for later updates
    nodeMaterials[node.id] = { core: mat, glow: glowMat, label: sprite, baseColor: color };

    return group;
  }

  function shortTitle(title, max) {
    return title.length <= max ? title : title.slice(0, max - 1) + "…";
  }

  // ── Ambient rotation ───────────────────────────────────────
  function resetIdleTimer() {
    lastInteractionTime = Date.now();
  }

  function startRotationLoop() {
    function tick() {
      requestAnimationFrame(tick);
      if (!graph || activeSlug) return;
      if (Date.now() - lastInteractionTime < IDLE_DELAY_MS) return;
      rotationAngle += ROTATION_SPEED;
      graph.cameraPosition({
        x: ROTATION_RADIUS * Math.sin(rotationAngle),
        z: ROTATION_RADIUS * Math.cos(rotationAngle),
      });
    }
    requestAnimationFrame(tick);
  }

  // ── Events ─────────────────────────────────────────────────
  function bindEvents() {
    searchInput.addEventListener("input", () => renderSidebar(searchInput.value));
    backBtn.addEventListener("click", showGraph);
    toggleBtn.addEventListener("click", () => sidebar.classList.toggle("collapsed"));

    // Reset idle on any graph interaction
    graphContainer.addEventListener("mousedown", resetIdleTimer, { passive: true });
    graphContainer.addEventListener("wheel", resetIdleTimer, { passive: true });
    graphContainer.addEventListener("touchstart", resetIdleTimer, { passive: true });

    window.addEventListener("popstate", () => {
      if (location.hash) {
        const slug = decodeURIComponent(location.hash.slice(1));
        if (slug && pageBySlug.has(slug)) navigateTo(slug, false);
      } else {
        showGraph();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== searchInput &&
          document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }
      if (e.key === "Escape") {
        if (document.activeElement === searchInput) {
          searchInput.blur();
        } else if (activeSlug) {
          showGraph();
        }
      }
    });
  }

  // ── Start ──────────────────────────────────────────────────
  init();
})();
