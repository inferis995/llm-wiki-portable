// LLM Wiki Portable — app.js
// Static HTML/JS wiki viewer with 3D graph

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────
  const CATEGORY_COLORS = {
    sources:     "#3b82f6",
    entities:    "#22c55e",
    concepts:    "#f59e0b",
    comparisons: "#a855f7",
    clippings:   "#ec4899",
    root:        "#6b7280",
  };
  const CATEGORY_LABELS = {
    sources:     "Fonti",
    entities:    "Entità",
    concepts:    "Concetti",
    comparisons: "Confronti",
    clippings:   "Clippings",
    root:        "Root",
  };
  const CATEGORY_ORDER = [
    "sources",
    "entities",
    "concepts",
    "comparisons",
    "clippings",
  ];

  // ── State ──────────────────────────────────────────────────
  let pages = [];
  let pageBySlug = new Map();   // O(1) lookup by slug
  let graphData = { nodes: [], links: [] };
  let activeSlug = null;
  let graph = null;
  let collapsedCategories = new Set();
  let tooltip = null;

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
    buildLegend();

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

    // Build O(1) lookup map
    pages.forEach((p) => pageBySlug.set(p.slug, p));

    graphData = buildGraphData(pages);
    renderSidebar();
    updateStats();
    initGraph();
    initTooltip();
    bindEvents();

    // Hash routing — navigate to page if hash present
    if (location.hash) {
      const slug = decodeURIComponent(location.hash.slice(1));
      if (slug && pageBySlug.has(slug)) navigateTo(slug, false);
    }
  }

  // ── Legend ─────────────────────────────────────────────────
  function buildLegend() {
    legend.innerHTML = CATEGORY_ORDER.map(
      (cat) =>
        `<span class="legend-item">` +
        `<span class="category-dot" style="background:${CATEGORY_COLORS[cat]}"></span>` +
        `${CATEGORY_LABELS[cat]}</span>`
    ).join("");
  }

  // ── Tooltip ────────────────────────────────────────────────
  function initTooltip() {
    tooltip = document.createElement("div");
    tooltip.className = "graph-tooltip";
    tooltip.style.display = "none";
    graphContainer.appendChild(tooltip);

    graphContainer.addEventListener("mousemove", (e) => {
      if (tooltip.style.display === "none") return;
      tooltip.style.left = e.offsetX + 14 + "px";
      tooltip.style.top  = e.offsetY - 10 + "px";
    });
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

    // Track connected nodes
    const connected = new Set();
    links.forEach((l) => { connected.add(l.source); connected.add(l.target); });

    // Find hub (most connected node)
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

    // Isolated nodes → virtual link to hub
    nodes.forEach((n) => {
      if (!connected.has(n.id) && n.id !== hubId) {
        links.push({ source: n.id, target: hubId, __virtual: true });
      }
    });

    // Same-category chain for visual grouping
    const byCat = {};
    nodes.forEach((n) => {
      if (!byCat[n.category]) byCat[n.category] = [];
      byCat[n.category].push(n.id);
    });
    for (const catNodes of Object.values(byCat)) {
      for (let i = 1; i < catNodes.length; i++) {
        const a = catNodes[i - 1], b = catNodes[i];
        const key = [a, b].sort().join("|");
        if (!linkSet.has(key)) {
          links.push({ source: a, target: b, __virtual: true });
        }
      }
    }

    return { nodes, links };
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
    const allCats = [...CATEGORY_ORDER, "root"];
    allCats.forEach((cat) => {
      const catPages = grouped[cat];
      if (!catPages) return;
      const collapsed = collapsedCategories.has(cat);
      const arrow = collapsed ? "▶" : "▼";
      html += `<div class="category-group">
        <div class="category-header" data-cat="${cat}">
          <span class="category-dot" style="background:${CATEGORY_COLORS[cat] || CATEGORY_COLORS.root}"></span>
          ${CATEGORY_LABELS[cat] || cat}
          <span class="category-count">${catPages.length}</span>
          <span class="category-arrow">${arrow}</span>
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
    pageCount.textContent = `${pages.length} pagine`;
    linkCount.textContent = `${realLinks} link`;
  }

  // ── Navigation ─────────────────────────────────────────────
  function navigateTo(slug, updateHash = true) {
    activeSlug = slug;
    if (updateHash) {
      history.pushState(null, "", "#" + encodeURIComponent(slug));
    }
    renderSidebar(searchInput.value);
    showPage(slug);
  }

  function findPage(slug) {
    if (pageBySlug.has(slug)) return pageBySlug.get(slug);
    // Fallback: suffix match and title match (for wikilinks without category prefix)
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

    const catColor = CATEGORY_COLORS[page.category] || CATEGORY_COLORS.root;
    const catLabel = CATEGORY_LABELS[page.category] || page.category;

    let headerHtml =
      `<span class="category-badge" style="background:${catColor}30;color:${catColor}">${catLabel}</span>` +
      `<h2>${page.title}</h2><div class="meta">`;
    if (page.frontmatter.updated)
      headerHtml += `Aggiornato: ${page.frontmatter.updated}`;
    if (page.frontmatter.sources)
      headerHtml += ` &middot; Fonti: ${page.frontmatter.sources}`;
    headerHtml += "</div>";

    if (page.frontmatter.tags && page.frontmatter.tags.length > 0) {
      headerHtml += '<div class="tags">';
      page.frontmatter.tags.forEach((t) => {
        headerHtml += `<span class="tag">${t}</span>`;
      });
      headerHtml += "</div>";
    }

    pageHeader.innerHTML = headerHtml;

    const processed = processWikilinks(page.content);
    pageContent.innerHTML = marked.parse(processed);

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
    if (page.backlinks && page.backlinks.length > 0) {
      linksHtml += `<div class="links-section"><h3>Backlinks</h3><div>`;
      page.backlinks.forEach((bl) => {
        const blPage = findPage(bl);
        const label  = blPage ? blPage.title : bl.split("/").pop();
        linksHtml += `<a data-slug="${bl}">${label}</a>`;
      });
      linksHtml += "</div></div>";
    }
    if (page.links && page.links.length > 0) {
      linksHtml += `<div class="links-section"><h3>Correlati</h3><div>`;
      page.links.forEach((link) => {
        const linkPage = findPage(link);
        const label    = linkPage ? linkPage.title : link;
        linksHtml += `<a data-slug="${link}">${label}</a>`;
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

  // ── 3D Graph ───────────────────────────────────────────────
  function initGraph() {
    const connectionCounts = {};
    graphData.links.forEach((l) => {
      if (l.__virtual) return;
      connectionCounts[l.source] = (connectionCounts[l.source] || 0) + 1;
      connectionCounts[l.target] = (connectionCounts[l.target] || 0) + 1;
    });

    graph = ForceGraph3D()(graphContainer)
      .graphData(graphData)
      .backgroundColor("#08080c")
      .enableNodeDrag(true)
      .cooldownTicks(300)
      .d3AlphaDecay(0.015)
      .d3VelocityDecay(0.3)
      .showNavInfo(false)
      .linkColor((link) =>
        link.__virtual ? "rgba(80,80,80,0)" : "rgba(120,140,170,0.35)"
      )
      .linkWidth((link) => (link.__virtual ? 0 : 1))
      .linkDirectionalArrowLength((link) => (link.__virtual ? 0 : 4))
      .linkDirectionalArrowRelPos(0.92)
      .linkDirectionalArrowColor("rgba(120,140,170,0.5)")
      .linkOpacity(0.3)
      .nodeThreeObject((node) => buildNodeObject(node, connectionCounts))
      .nodeThreeObjectExtend(true)
      .onNodeHover((node) => {
        if (!tooltip) return;
        if (node) {
          tooltip.textContent = node.title;
          tooltip.style.display = "block";
        } else {
          tooltip.style.display = "none";
        }
      })
      .onNodeClick((node) => {
        navigateTo(node.id);
        const dist = 40;
        graph.cameraPosition(
          { x: node.x + dist, y: node.y + dist * 0.4, z: node.z + dist },
          node,
          800
        );
      });

    graph.d3Force("link").distance((link) => (link.__virtual ? 25 : 40));
    graph.d3Force("charge").strength(-30);
    graph.d3Force("center").strength(1.0);

    setTimeout(() => graph.zoomToFit(300, 50), 3500);
  }

  function buildNodeObject(node, connectionCounts) {
    const color    = CATEGORY_COLORS[node.category] || "#64748b";
    const count    = connectionCounts[node.id] || 0;
    const size     = 3 + Math.min(count * 0.4, 4);
    const isActive = activeSlug === node.id;

    const group = new THREE.Group();

    // Core sphere
    const geo = new THREE.SphereGeometry(size, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color:            new THREE.Color(isActive ? "#ffffff" : color),
      emissive:         new THREE.Color(color),
      emissiveIntensity: isActive ? 1.0 : 0.3,
      roughness:        0.3,
      metalness:        0.4,
    });
    group.add(new THREE.Mesh(geo, mat));

    // Glow halo
    const glowGeo = new THREE.SphereGeometry(size * 1.6, 14, 14);
    const glowMat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color(color),
      transparent: true,
      opacity:     isActive ? 0.35 : 0.12,
    });
    group.add(new THREE.Mesh(glowGeo, glowMat));

    // Label sprite
    const label    = shortTitle(node.title || "");
    const canvas   = document.createElement("canvas");
    const ctx      = canvas.getContext("2d");
    const fontSize = 36;
    const font     = `${isActive ? "bold " : ""}${fontSize}px Inter, Arial, sans-serif`;
    ctx.font       = font;
    const measured = ctx.measureText(label);
    const textW    = measured.width || label.length * fontSize * 0.5;

    canvas.width  = Math.ceil(textW + 32);
    canvas.height = fontSize + 20;
    ctx.font      = font;

    ctx.fillStyle = isActive ? "rgba(255,255,255,0.18)" : "rgba(6,6,10,0.75)";
    const pw = canvas.width, ph = canvas.height, r = 8;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(pw - r, 0); ctx.quadraticCurveTo(pw, 0, pw, r);
    ctx.lineTo(pw, ph - r); ctx.quadraticCurveTo(pw, ph, pw - r, ph);
    ctx.lineTo(r, ph); ctx.quadraticCurveTo(0, ph, 0, ph - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle    = isActive ? "#ffffff" : "#d4dae4";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);

    const texture       = new THREE.CanvasTexture(canvas);
    texture.minFilter   = THREE.LinearFilter;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: isActive ? 1 : 0.85, sizeAttenuation: true })
    );
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(aspect * 3, 3, 1);
    sprite.position.y = -(size + 3);
    group.add(sprite);

    return group;
  }

  function shortTitle(title, max) {
    max = max || 20;
    return title.length <= max ? title : title.slice(0, max - 1) + "…";
  }

  // ── Events ─────────────────────────────────────────────────
  function bindEvents() {
    searchInput.addEventListener("input", () => renderSidebar(searchInput.value));
    backBtn.addEventListener("click", showGraph);
    toggleBtn.addEventListener("click", () => sidebar.classList.toggle("collapsed"));

    // Hash routing — browser back/forward
    window.addEventListener("popstate", () => {
      if (location.hash) {
        const slug = decodeURIComponent(location.hash.slice(1));
        if (slug && pageBySlug.has(slug)) showPage(slug);
      } else {
        showGraph();
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // '/' — focus search (when not already in an input)
      if (e.key === "/" && document.activeElement !== searchInput &&
          document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }
      // 'Escape' — blur search or go back to graph
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
