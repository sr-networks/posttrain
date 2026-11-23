(function () {
  const rootPrefix = document.documentElement.dataset.root || './';

  // ---- Theme toggle ----
  const storedTheme = localStorage.getItem('pt-theme');
  if (storedTheme) {
    document.documentElement.dataset.theme = storedTheme;
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.dataset.theme = 'dark';
  }

  const themeBtn = document.getElementById('theme-toggle');
  function syncThemeIcon() {
    if (!themeBtn) return;
    const isDark = document.documentElement.dataset.theme === 'dark';
    themeBtn.textContent = isDark ? '☀' : '☾';
    themeBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }
  syncThemeIcon();
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('pt-theme', next);
      syncThemeIcon();
    });
  }

  // ---- Mobile sidebar drawer ----
  const menuBtn = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // ---- Interactive Home Decision Matrix ----
  const decisionTabs = document.querySelectorAll('.decision-tab');
  const decisionPanels = document.querySelectorAll('.decision-panel');
  decisionTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      decisionTabs.forEach((t) => t.classList.toggle('active', t === tab));
      decisionPanels.forEach((p) => p.classList.toggle('active', p.id === target));
    });
  });

  // ---- Interactive Case Study Filters ----
  const csGrid = document.getElementById('case-study-grid');
  if (csGrid) {
    const cards = Array.from(csGrid.querySelectorAll('[data-cs-card]'));
    const countEl = document.getElementById('cs-count');
    const searchInput = document.getElementById('cs-search');
    const state = { method: 'all', tier: 'all', size: 'all', q: '' };

    function applyCsFilter() {
      let visible = 0;
      cards.forEach((card) => {
        const methods = (card.dataset.methods || '').split(',');
        const tier = card.dataset.tier || '';
        const size = card.dataset.size || '';
        const hay = (card.dataset.search || '').toLowerCase();
        const matchMethod = state.method === 'all' || methods.includes(state.method);
        const matchTier = state.tier === 'all' || tier === state.tier;
        const matchSize = state.size === 'all' || size === state.size;
        const matchQ = !state.q || hay.includes(state.q);
        const show = matchMethod && matchTier && matchSize && matchQ;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (countEl) countEl.textContent = `Showing ${visible} of ${cards.length} audited industry projects`;
    }

    document.querySelectorAll('[data-cs-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.csFilter;
        const val = btn.dataset.val;
        state[group] = val;
        document.querySelectorAll(`[data-cs-filter="${group}"]`).forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        applyCsFilter();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.q = e.target.value.trim().toLowerCase();
        applyCsFilter();
      });
    }
    applyCsFilter();
  }

  // ---- Interactive Reference Library Filters ----
  const refList = document.getElementById('ref-list');
  if (refList) {
    const items = Array.from(refList.querySelectorAll('[data-ref-item]'));
    const countEl = document.getElementById('ref-count');
    const searchInput = document.getElementById('ref-search');
    const state = { pillar: 'all', source: 'all', type: 'all', q: '' };

    function applyRefFilter() {
      let visible = 0;
      items.forEach((item) => {
        const matchPillar = state.pillar === 'all' || item.dataset.pillar === state.pillar;
        const matchSource = state.source === 'all' || item.dataset.source === state.source;
        const matchType = state.type === 'all' || item.dataset.type === state.type;
        const matchQ = !state.q || (item.dataset.search || '').toLowerCase().includes(state.q);
        const show = matchPillar && matchSource && matchType && matchQ;
        item.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (countEl) countEl.textContent = `Showing ${visible} of ${items.length} curated references`;
    }

    document.querySelectorAll('[data-ref-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.refFilter;
        const val = btn.dataset.val;
        state[group] = val;
        document.querySelectorAll(`[data-ref-filter="${group}"]`).forEach((b) =>
          b.classList.toggle('active', b === btn)
        );
        applyRefFilter();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.q = e.target.value.trim().toLowerCase();
        applyRefFilter();
      });
    }
    applyRefFilter();
  }

  // ---- Global Search Modal (Cmd+K or /) ----
  const modal = document.getElementById('search-modal');
  const openBtn = document.getElementById('open-search');
  const modalInput = document.getElementById('global-search-input');
  const resultsEl = document.getElementById('global-search-results');
  let searchIndex = null;

  async function loadSearchIndex() {
    if (searchIndex) return searchIndex;
    try {
      const res = await fetch(`${rootPrefix}search-index.json`);
      searchIndex = await res.json();
    } catch {
      searchIndex = [];
    }
    return searchIndex;
  }

  function renderGlobalHits(query) {
    if (!resultsEl || !searchIndex) return;
    const q = query.trim().toLowerCase();
    const hits = !q
      ? searchIndex.slice(0, 10)
      : searchIndex
          .filter((entry) =>
            `${entry.title} ${entry.category} ${entry.excerpt}`.toLowerCase().includes(q)
          )
          .slice(0, 14);

    if (!hits.length) {
      resultsEl.innerHTML = `<div style="padding:18px;color:var(--text-muted);font-size:0.88rem;">No matches found for "${query.replace(/</g, '&lt;')}".</div>`;
      return;
    }

    resultsEl.innerHTML = hits
      .map((hit) => {
        const href = hit.external ? hit.url : `${rootPrefix}${hit.url}`;
        const targetAttr = hit.external ? ' target="_blank" rel="noopener"' : '';
        return `<a class="search-hit" href="${href}"${targetAttr}>
          <div class="search-hit-title">${hit.title}</div>
          <div class="search-hit-meta">${hit.category} · ${hit.excerpt}</div>
        </a>`;
      })
      .join('');
  }

  async function openSearch() {
    if (!modal) return;
    modal.classList.add('open');
    await loadSearchIndex();
    if (modalInput) {
      modalInput.value = '';
      modalInput.focus();
    }
    renderGlobalHits('');
  }

  function closeSearch() {
    if (modal) modal.classList.remove('open');
  }

  if (openBtn) openBtn.addEventListener('click', openSearch);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSearch();
    });
  }
  if (modalInput) {
    modalInput.addEventListener('input', (e) => renderGlobalHits(e.target.value));
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      openSearch();
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  });
})();
