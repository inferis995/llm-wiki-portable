// LLM Wiki Portable — app.js
// Static HTML/JS wiki viewer with 3D graph

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────
  const CATEGORY_COLORS = {
    sources: "#3b82f6",
    entities: "#22c55e",
    concepts: "#f59e0b",
    comparisons: "#a855f7",
    root: "#6b7280",
  };
  const CATEGORY_LABELS = {
    sources: "Fonti",
    entities: "Entità",
    concepts: "Concetti",
    comparisons: "Confronti",
    root: "Root",
  };
  const CATEGORY_ORDER = [
    "sources",
    "entities",
    "concepts",
    "comparisons",
  ];

  // ── State ──────────────────────────────────────────────────
  let pages = [];
  let graphData = { nodes: [], links: [] };
  let activeSlug = null;
  let graph = null;

  // ── DOM refs ───────────────────────────────────────────────
  const sidebarPages = document.getElementById("sidebar-pages");
  const searchInput = document.getElementById("search");
  const graphContainer = document.getElementById("graph-container");
  const pageViewer = document.getElementById("page-viewer");
  const pageHeader = document.getElementById("page-header");
  const pageContent = document.getElementById("page-content");
  const pageLinks = document.getElementById("page-links");
  const backBtn = document.getElementById("back-btn");
  const toggleBtn = document.getElementById("toggle-sidebar");
  const sidebar = document.getElementById("sidebar");
  const topbarTitle = document.getElementById("topbar-title");
  const legend = document.getElementById("legend");
  const pageCount = document.getElementById("page-count");
  const linkCount = document.getElementById("link-count");

  // ── Init ───────────────────────────────────────────────────
  function init() {
    buildLegend();

    // Read data from global WIKI_DATA (loaded via data.js script tag — works with file://)
    if (typeof WIKI_DATA === 'undefined') {
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

    graphData = buildGraphData(pages);
    renderSidebar();
    updateStats();
    initGraph();
  }

  // ── Legend ─────────────────────────────────────────────────
  function buildLegend() {
    legend.innerHTML = CATEGORY_ORDER.map(
      (cat) =>
        `<span class="legend-item"><span class="category-dot" style="background:${CATEGORY_COLORS[cat]}"></span>${CATEGORY_LABELS[cat]}</span>`
    ).join("");
  }

  // ── Graph Data ─────────────────────────────────────────────
  function buildGraphData(pages) {
    const nodes = pages.map((p) => ({
      id: p.slug,
      title: p.title,
      category: p.category,
    }));

    const linkSet = new Set();
    const links = [];

    pages.forEach((page) => {
      (page.links || []).forEach((link) => {
        const target = pages.find(
          (p) =>
            p.slug === link ||
            p.slug.endsWith("/" + link) ||
            p.title.toLowerCase() === link.toLowerCase()
        );
        if (!target) return;
        const key = [page.slug, target.slug].sort().join("|");
        if (linkSet.has(key)) return;
        linkSet.add(key);
        links.push({ source: page.slug, target: target.slug });
      });
    });

    // Virtual links for isolated nodes
    const connected = new Set();
    links.forEach((l) => {
      connected.add(l.source);
      connected.add(l.target);
    });

    // Find hub
    const connCounts = {};
    links.forEach((l) => {
      connCounts[l.source] = (connCounts[l.source] || 0) + 1;
      connCounts[l.target] = (connCounts[l.target] || 0) + 1;
    });
    let hubId = nodes[0]?.id || "";
    let maxC = 0;
    for (const [id, c] of Object.entries(connCounts)) {
      if (c > maxC) {
        maxC = c;
        hubId = id;
      }
    }

    // Isolated → hub
    nodes.forEach((n) => {
      if (!connected.has(n.id) && n.id !== hubId) {
        links.push({ source: n.id, target: hubId, __virtual: true });
      }
    });

    // Same-category chain
    const byCat = {};
    nodes.forEach((n) => {
      if (!byCat[n.category]) byCat[n.category] = [];
      byCat[n.category].push(n.id);
    });
    for (const catNodes of Object.values(byCat)) {
      for (let i = 1; i < catNodes.length; i++) {
        const a = catNodes[i - 1],
          b = catNodes[i];
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
    const q = (query || "").toLowerCase();
    const grouped = {};
    pages.forEach((p) => {
      if (q) {
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchTags = (p.frontmatter.tags || []).some((t) =>
          t.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchTags) return;
      }
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });

    let html = "";
    CATEGORY_ORDER.forEach((cat) => {
      const catPages = grouped[cat];
      if (!catPages) return;
      html += `<div class="category-group">
        <div class="category-header">
          <span class="category-dot" style="background:${CATEGORY_COLORS[cat]}"></span>
          ${CATEGORY_LABELS[cat] || cat}
          <span class="category-count">${catPages.length}</span>
        </div>`;
      catPages.forEach((p) => {
        html += `<div class="sidebar-link${activeSlug === p.slug ? " active" : ""}" data-slug="${p.slug}">${p.title}</div>`;
      });
      html += "</div>";
    });

    // Uncategorized (root)
    if (grouped.root) {
      html += `<div class="category-group">
        <div class="category-header">
          <span class="category-dot" style="background:${CATEGORY_COLORS.root}"></span>
          Root
          <span class="category-count">${grouped.root.length}</span>
        </div>`;
      grouped.root.forEach((p) => {
        html += `<div class="sidebar-link${activeSlug === p.slug ? " active" : ""}" data-slug="${p.slug}">${p.title}</div>`;
      });
      html += "</div>";
    }

    sidebarPages.innerHTML = html;

    // Bind clicks
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
  function navigateTo(slug) {
    activeSlug = slug;
    renderSidebar(searchInput.value);
    showPage(slug);
  }

  function findPage(slug) {
    return pages.find(
      (p) =>
        p.slug === slug ||
        p.slug.endsWith("/" + slug) ||
        p.title.toLowerCase() === slug.toLowerCase()
    );
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

    let headerHtml = `<span class="category-badge" style="background:${catColor}30;color:${catColor}">${catLabel}</span>
      <h2>${page.title}</h2>
      <div class="meta">`;
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

    // Process wikilinks in content
    const processed = processWikilinks(page.content);
    pageContent.innerHTML = marked.parse(processed);

    // Make internal links clickable
    pageContent.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && !href.startsWith("http") && !href.startsWith("mailto:")) {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          navigateTo(href);
        });
        a.classList.add("wiki-link");
      } else {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        a.classList.add("wiki-link");
      }
    });

    // Backlinks + Related
    let linksHtml = "";
    if (page.backlinks && page.backlinks.length > 0) {
      linksHtml += `<div class="links-section"><h3>Backlinks</h3><div>`;
      page.backlinks.forEach((bl) => {
        const blPage = findPage(bl);
        const label = blPage ? blPage.title : bl.split("/").pop();
        linksHtml += `<a data-slug="${bl}">${label}</a>`;
      });
      linksHtml += "</div></div>";
    }
    if (page.links && page.links.length > 0) {
      linksHtml += `<div class="links-section"><h3>Correlati</h3><div>`;
      page.links.forEach((link) => {
        const linkPage = findPage(link);
        const label = linkPage ? linkPage.title : link;
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
      .onNodeClick((node) => {
        navigateTo(node.id);
        const dist = 40;
        graph.cameraPosition(
          { x: node.x + dist, y: node.y + dist * 0.4, z: node.z + dist },
          node,
          800
        );
      });

    // Configure forces
    graph.d3Force("link").distance((link) => (link.__virtual ? 25 : 40));
    graph.d3Force("charge").strength(-30);
    graph.d3Force("center").strength(1.0);

    // Auto-zoom
    setTimeout(() => graph.zoomToFit(300, 50), 3500);
  }

  function buildNodeObject(node, connectionCounts) {
    const color = CATEGORY_COLORS[node.category] || "#64748b";
    const count = connectionCounts[node.id] || 0;
    const size = 3 + Math.min(count * 0.4, 4);
    const isActive = activeSlug === node.id;

    const group = new THREE.Group();

    // Core sphere
    const geo = new THREE.SphereGeometry(size, 24, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(isActive ? "#ffffff" : color),
      emissive: new THREE.Color(color),
      emissiveIntensity: isActive ? 1.0 : 0.3,
      roughness: 0.3,
      metalness: 0.4,
    });
    group.add(new THREE.Mesh(geo, mat));

    // Glow halo
    const glowGeo = new THREE.SphereGeometry(size * 1.6, 14, 14);
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: isActive ? 0.35 : 0.12,
    });
    group.add(new THREE.Mesh(glowGeo, glowMat));

    // Label
    const label = shortTitle(node.title || "");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const fontSize = 36;
    const font = `${isActive ? "bold " : ""}${fontSize}px Inter, Arial, sans-serif`;
    ctx.font = font;
    const measured = ctx.measureText(label);
    const textW = measured.width || label.length * fontSize * 0.5;

    canvas.width = Math.ceil(textW + 32);
    canvas.height = fontSize + 20;
    ctx.font = font;

    // Dark background pill
    ctx.fillStyle = isActive ? "rgba(255,255,255,0.18)" : "rgba(6,6,10,0.75)";
    const pw = canvas.width,
      ph = canvas.height,
      r = 8;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(pw - r, 0);
    ctx.quadraticCurveTo(pw, 0, pw, r);
    ctx.lineTo(pw, ph - r);
    ctx.quadraticCurveTo(pw, ph, pw - r, ph);
    ctx.lineTo(r, ph);
    ctx.quadraticCurveTo(0, ph, 0, ph - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    // Text
    ctx.fillStyle = isActive ? "#ffffff" : "#d4dae4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: isActive ? 1 : 0.85,
        sizeAttenuation: true,
      })
    );
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(aspect * 3, 3, 1);
    sprite.position.y = -(size + 3);
    group.add(sprite);

    return group;
  }

  function shortTitle(title, max) {
    max = max || 20;
    if (title.length <= max) return title;
    return title.slice(0, max - 1) + "\u2026";
  }

  // ── Events ─────────────────────────────────────────────────
  searchInput.addEventListener("input", () => {
    renderSidebar(searchInput.value);
  });

  backBtn.addEventListener("click", showGraph);

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
  });

  // ── Start ──────────────────────────────────────────────────
  init();
})();
