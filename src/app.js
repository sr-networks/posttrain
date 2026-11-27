(function () {
  const rootPrefix = document.documentElement.dataset.root || './';

  const chartFrame = document.querySelector('.blog-chart');
  if (chartFrame) {
    let observer;
    function fitChart() {
      const content = chartFrame.contentDocument?.querySelector('main');
      if (!content) return;
      observer?.disconnect();
      function resizeFrame() {
        const height = `${Math.ceil(content.getBoundingClientRect().height) + 2}px`;
        if (chartFrame.style.height !== height) chartFrame.style.height = height;
      }
      resizeFrame();
      observer = new ResizeObserver(resizeFrame);
      observer.observe(content);
    }
    chartFrame.addEventListener('load', fitChart);
    fitChart();
  }

  // ---- Theme toggle ----
  const storedTheme = localStorage.getItem('pt-theme');
  if (storedTheme) {
    document.documentElement.dataset.theme = storedTheme;
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.dataset.theme = 'dark';
  }

  const themeBtn = document.getElementById('theme-toggle');
  function syncThemeLabel() {
    if (!themeBtn) return;
    const isDark = document.documentElement.dataset.theme === 'dark';
    themeBtn.textContent = isDark ? 'Light' : 'Dark';
  }
  syncThemeLabel();
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('pt-theme', next);
      syncThemeLabel();
    });
  }

  // ---- Case Studies Table Filters ----
  const csBody = document.getElementById('case-study-rows');
  if (csBody) {
    const rows = Array.from(csBody.querySelectorAll('[data-cs-row]'));
    const countEl = document.getElementById('cs-count');
    const searchInput = document.getElementById('cs-search');
    const state = { method: 'all', tier: 'all', size: 'all', q: '' };

    function applyCsFilter() {
      let visible = 0;
      rows.forEach((row) => {
        const methods = (row.dataset.methods || '').split(',');
        const tier = row.dataset.tier || '';
        const size = row.dataset.size || '';
        const hay = (row.dataset.search || '').toLowerCase();
        const show =
          (state.method === 'all' || methods.includes(state.method)) &&
          (state.tier === 'all' || tier === state.tier) &&
          (state.size === 'all' || size === state.size) &&
          (!state.q || hay.includes(state.q));
        row.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (countEl) countEl.textContent = `${visible} of ${rows.length} documented studies`;
    }

    document.querySelectorAll('[data-cs-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.csFilter;
        state[group] = btn.dataset.val;
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

  // ---- Bibliography Filters ----
  const refList = document.getElementById('ref-list');
  if (refList) {
    const items = Array.from(refList.querySelectorAll('[data-ref-item]'));
    const countEl = document.getElementById('ref-count');
    const searchInput = document.getElementById('ref-search');
    const state = { pillar: 'all', type: 'all', q: '' };

    function applyRefFilter() {
      let visible = 0;
      items.forEach((item) => {
        const show =
          (state.pillar === 'all' || item.dataset.pillar === state.pillar) &&
          (state.type === 'all' || item.dataset.type === state.type) &&
          (!state.q || (item.dataset.search || '').toLowerCase().includes(state.q));
        item.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (countEl) countEl.textContent = `${visible} of ${items.length} entries`;
    }

    document.querySelectorAll('[data-ref-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.refFilter;
        state[group] = btn.dataset.val;
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
      ? searchIndex.slice(0, 8)
      : searchIndex
          .filter((entry) =>
            `${entry.title} ${entry.category} ${entry.excerpt}`.toLowerCase().includes(q)
          )
          .slice(0, 12);

    if (!hits.length) {
      resultsEl.innerHTML = `<div style="padding:12px 14px;color:var(--text-muted);font-size:0.8rem;">No matching entries.</div>`;
      return;
    }

    resultsEl.innerHTML = hits
      .map((hit) => {
        const href = hit.external ? hit.url : `${rootPrefix}${hit.url}`;
        const targetAttr = hit.external ? ' target="_blank" rel="noopener"' : '';
        return `<a class="search-hit" href="${href}"${targetAttr}>
          <div class="search-hit-title">${hit.title}</div>
          <div class="search-hit-meta">${hit.category} — ${hit.excerpt}</div>
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
