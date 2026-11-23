import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const caseStudies = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/case-studies.json'), 'utf8'));
const frameworksData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/frameworks.json'), 'utf8'));
const references = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/references.json'), 'utf8'));

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inlineMd(text) {
  let out = escapeHtml(text);
  // inline code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // clean simple LaTeX tokens for readable rendering without external JS
  out = out
    .replace(/\$\\pm\\text\{SE\}\$/g, '±SE')
    .replace(/\$\\pi_\\theta\$/g, '<em>π</em><sub>θ</sub>')
    .replace(/\$\\pi_\{\\text\{teacher\}\}\$/g, '<em>π</em><sub>teacher</sub>')
    .replace(/\$\(x \\to y\^\*\)\$/g, '(<em>x</em> → <em>y</em>*)')
    .replace(/\$G\$/g, '<em>G</em>');
  // links [label](url)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // bold & italic
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const toc = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Callout blocks :::insight / :::field / :::warning
    const calloutMatch = line.match(/^:::(insight|field|warning)\s*$/);
    if (calloutMatch) {
      const kind = calloutMatch[1];
      i++;
      const inner = [];
      while (i < lines.length && !lines[i].match(/^:::\s*$/)) {
        inner.push(lines[i]);
        i++;
      }
      i++; // skip closing :::
      const innerHtml = renderMarkdown(inner.join('\n')).html;
      html.push(`<div class="callout callout-${kind}">${innerHtml}</div>`);
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      html.push(`<pre><code class="lang-${escapeHtml(lang)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      html.push('<hr>');
      i++;
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const rawText = hMatch[2].trim();
      const id = slugify(rawText);
      if (level === 2 || level === 3) {
        toc.push({ level, id, text: rawText.replace(/\*\*/g, '').replace(/`/g, '') });
      }
      html.push(`<h${level} id="${id}">${inlineMd(rawText)}</h${level}>`);
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[i + 1])) {
      const parseRow = (row) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const headers = parseRow(line);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(parseRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${headers.map((h) => `<th>${inlineMd(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      html.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    // Unordered list (supports 2-space indented sub-bullets)
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        const indent = lines[i].match(/^(\s*)-\s+(.*)$/);
        const spaces = indent[1].length;
        const content = inlineMd(indent[2].trim());
        if (spaces >= 2 && items.length > 0) {
          items[items.length - 1].sub.push(content);
        } else {
          items.push({ text: content, sub: [] });
        }
        i++;
      }
      html.push(
        `<ul>${items
          .map(
            (it) =>
              `<li>${it.text}${it.sub.length ? `<ul>${it.sub.map((s) => `<li>${s}</li>`).join('')}</ul>` : ''}</li>`
          )
          .join('')}</ul>`
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(inlineMd(lines[i].replace(/^\d+\.\s+/, '').trim()));
        i++;
      }
      html.push(`<ol>${items.map((it) => `<li>${it}</li>`).join('')}</ol>`);
      continue;
    }

    // Paragraph
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^(#{1,3}\s|```|---+|:::|\s*-\s+|\d+\.\s+)/) &&
      !(lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[i + 1]))
    ) {
      para.push(lines[i].trim());
      i++;
    }
    html.push(`<p>${inlineMd(para.join(' '))}</p>`);
  }

  return { html: html.join('\n'), toc };
}

function methodBadges(methods) {
  return methods
    .map((m) => {
      const cls = m === 'SFT' ? 'badge-sft' : m === 'RL' ? 'badge-rl' : 'badge-distill';
      return `<span class="badge ${cls}">${escapeHtml(m)}</span>`;
    })
    .join('');
}

function tierBadge(tier, label) {
  const cls = tier === 'Tier 1' ? 'badge-tier1' : 'badge-tier2';
  return `<span class="badge ${cls}">${escapeHtml(tier)} · ${escapeHtml(label)}</span>`;
}

function lifecycleSvg() {
  return `
  <div class="diagram-card">
    <svg viewBox="0 0 920 215" width="100%" height="auto" role="img" aria-label="Industrial post-training pipeline for small and midsize models">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.55"/>
        </marker>
      </defs>
      <g font-family="Inter, system-ui, sans-serif" fill="currentColor">
        <!-- Box 1 -->
        <rect x="14" y="34" width="182" height="128" rx="12" fill="var(--bg-subtle)" stroke="var(--border-strong)" stroke-width="1.5"/>
        <text x="28" y="60" font-size="11" font-family="JetBrains Mono, monospace" font-weight="700" fill="var(--text-muted)">01 · FOUNDATION</text>
        <text x="28" y="83" font-size="14" font-weight="700">Open Small/Mid Base</text>
        <text x="28" y="105" font-size="11.5" fill="var(--text-secondary)">4B–35B dense or MoE</text>
        <text x="28" y="122" font-size="11.5" fill="var(--text-secondary)">Qwen3.x · Llama-3 · GLM</text>
        <text x="28" y="144" font-size="10.5" fill="var(--accent)">+ Stateful Harness First</text>

        <line x1="196" y1="98" x2="234" y2="98" stroke="currentColor" stroke-opacity="0.45" stroke-width="2" marker-end="url(#arrow)"/>

        <!-- Box 2 -->
        <rect x="242" y="34" width="196" height="128" rx="12" fill="var(--cyan-soft)" stroke="var(--cyan-border)" stroke-width="1.5"/>
        <text x="256" y="60" font-size="11" font-family="JetBrains Mono, monospace" font-weight="700" fill="var(--cyan)">02 · SFT / iSFT</text>
        <text x="256" y="83" font-size="14" font-weight="700">Format &amp; Repair</text>
        <text x="256" y="105" font-size="11.5" fill="var(--text-secondary)">LoRA SFT · Baseten iSFT</text>
        <text x="256" y="122" font-size="11.5" fill="var(--text-secondary)">500–25k clean/repaired</text>
        <text x="256" y="144" font-size="10.5" fill="var(--cyan)">Fixes schema &amp; cold start</text>

        <line x1="438" y1="98" x2="476" y2="98" stroke="currentColor" stroke-opacity="0.45" stroke-width="2" marker-end="url(#arrow)"/>

        <!-- Box 3 -->
        <rect x="484" y="22" width="214" height="152" rx="12" fill="var(--accent-soft)" stroke="var(--accent-border)" stroke-width="1.5"/>
        <text x="498" y="48" font-size="11" font-family="JetBrains Mono, monospace" font-weight="700" fill="var(--accent)">03 · RL OR ON-POLICY DISTILL</text>
        <text x="498" y="71" font-size="14" font-weight="700">On-Policy Optimization</text>
        <text x="498" y="95" font-size="11.5" fill="var(--text-secondary)">• RLVR / Rubric RL (GRPO/GSPO)</text>
        <text x="498" y="114" font-size="11.5" fill="var(--text-secondary)">• On-Policy Distillation (OPD)</text>
        <text x="498" y="133" font-size="11.5" fill="var(--text-secondary)">• Online Telemetry RL (Cursor)</text>
        <text x="498" y="156" font-size="10.5" fill="var(--accent)">Learns recovery &amp; tool efficiency</text>

        <line x1="698" y1="98" x2="734" y2="98" stroke="currentColor" stroke-opacity="0.45" stroke-width="2" marker-end="url(#arrow)"/>

        <!-- Box 4 -->
        <rect x="742" y="34" width="164" height="128" rx="12" fill="var(--emerald-soft)" stroke="var(--emerald-border)" stroke-width="1.5"/>
        <text x="756" y="60" font-size="11" font-family="JetBrains Mono, monospace" font-weight="700" fill="var(--emerald)">04 · PRODUCTION</text>
        <text x="756" y="83" font-size="14" font-weight="700">Sovereign SLM</text>
        <text x="756" y="105" font-size="11.5" fill="var(--text-secondary)">vLLM · FP8 · Multi-LoRA</text>
        <text x="756" y="122" font-size="11.5" fill="var(--text-secondary)">5×–64× lower cost</text>
        <text x="756" y="144" font-size="10.5" fill="var(--emerald)">Sub-sec · VPC-compliant</text>

        <!-- Feedback arc -->
        <path d="M 824 162 C 824 202, 590 204, 590 176" fill="none" stroke="var(--emerald)" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#arrow)"/>
        <text x="646" y="202" font-size="10.5" font-family="JetBrains Mono, monospace" fill="var(--emerald)">Production telemetry &amp; failure traces feed next cycle</text>
      </g>
    </svg>
    <div class="diagram-caption">The 2026 Enterprise Post-Training Loop: harness &amp; evals first → SFT/iSFT cold-start → on-policy RL or OPD → sovereign low-latency serving.</div>
  </div>`;
}

function distillationSvg() {
  return `
  <div class="diagram-card">
    <svg viewBox="0 0 900 200" width="100%" height="auto" role="img" aria-label="Comparison of Off-Policy Distillation, Outcome RL, and On-Policy Distillation">
      <g font-family="Inter, system-ui, sans-serif" fill="currentColor">
        <rect x="12" y="18" width="276" height="162" rx="12" fill="var(--bg-subtle)" stroke="var(--border-strong)" stroke-width="1.4"/>
        <text x="28" y="44" font-size="11" font-family="JetBrains Mono, monospace" font-weight="700" fill="var(--cyan)">OFF-POLICY DISTILLATION (SFT)</text>
        <text x="28" y="68" font-size="13.5" font-weight="700">Teacher Writes → Student Mimics</text>
        <text x="28" y="94" font-size="11.5" fill="var(--text-secondary)">✓ Dense per-token cross-entropy</text>
        <text x="28" y="114" font-size="11.5" fill="var(--text-secondary)">✓ Fast &amp; simple single-turn ROI</text>
        <text x="28" y="136" font-size="11.5" fill="var(--rose)">✗ Exposure bias (never fixes own drift)</text>
        <text x="28" y="158" font-size="11" fill="var(--text-muted)">Best for: Booking.com, Checkr, cold-start</text>

        <rect x="312" y="18" width="276" height="162" rx="12" fill="var(--bg-subtle)" stroke="var(--border-strong)" stroke-width="1.4"/>
        <text x="328" y="44" font-size="11" font-family="JetBrains Mono, monospace" font-weight="700" fill="var(--accent)">OUTCOME RL (GRPO / GSPO)</text>
        <text x="328" y="68" font-size="13.5" font-weight="700">Student Explores → End Score</text>
        <text x="328" y="94" font-size="11.5" fill="var(--text-secondary)">✓ On-policy (recovers from mistakes)</text>
        <text x="328" y="114" font-size="11.5" fill="var(--text-secondary)">✓ Can surpass any teacher model</text>
        <text x="328" y="136" font-size="11.5" fill="var(--amber)">△ Sparse reward = high compute cost</text>
        <text x="328" y="158" font-size="11" fill="var(--text-muted)">Best for: Coinbase, SWE-grep, ART·E</text>

        <rect x="612" y="18" width="276" height="162" rx="12" fill="var(--emerald-soft)" stroke="var(--emerald-border)" stroke-width="1.8"/>
        <text x="628" y="44" font-size="11" font-family="JetBrains Mono, monospace" font-weight="700" fill="var(--emerald)">ON-POLICY DISTILLATION (OPD)</text>
        <text x="628" y="68" font-size="13.5" font-weight="700">Student Rolls Out → Teacher Grades Token-by-Token</text>
        <text x="628" y="94" font-size="11.5" fill="var(--text-secondary)">✓ On-policy (fixes exposure bias)</text>
        <text x="628" y="114" font-size="11.5" fill="var(--text-secondary)">✓ Dense per-token reverse KL (9×–30× cheaper)</text>
        <text x="628" y="136" font-size="11.5" fill="var(--amber)">△ Needs open-weight teacher logprobs</text>
        <text x="628" y="158" font-size="11" fill="var(--emerald)">Best for: 235B/397B → 8B–32B compression</text>
      </g>
    </svg>
    <div class="diagram-caption">Why On-Policy Distillation (OPD) bridges SFT and RL when compressing a stronger open-weight teacher into a compact production student.</div>
  </div>`;
}

function pageShell({ title, description, activeNav, rootPrefix, bodyHtml }) {
  const navItems = [
    { key: 'home', label: 'Overview', href: '' },
    { key: 'cases', label: 'Case Studies', href: 'case-studies/', pill: `${caseStudies.length}` },
    { key: 'sft', label: 'SFT & iSFT', href: 'sft/' },
    { key: 'rl', label: 'Reinforcement Learning', href: 'rl/' },
    { key: 'distill', label: 'Distillation & OPD', href: 'distillation/' },
    { key: 'frameworks', label: 'Frameworks & Compute', href: 'frameworks/', pill: `${frameworksData.frameworks.length}` },
    { key: 'playbook', label: 'Best Practices', href: 'best-practices/' },
    { key: 'refs', label: 'Reference Library', href: 'references/', pill: `${references.length}` }
  ];

  const topbarNav = navItems
    .slice(0, 6)
    .map(
      (n) =>
        `<a href="${rootPrefix}${n.href}" class="${activeNav === n.key ? 'active' : ''}">${n.label}</a>`
    )
    .join('');

  const sidebarCases = caseStudies
    .slice(0, 8)
    .map(
      (cs) =>
        `<li><a href="${rootPrefix}case-studies/${cs.slug}/" class="${
          activeNav === `cs:${cs.slug}` ? 'active' : ''
        }"><span>${escapeHtml(cs.company.split(' ')[0])}: ${escapeHtml(
          cs.title.replace(cs.company, '').replace(/^[\s×·-]+/, '').slice(0, 22)
        )}</span><span class="sidebar-pill">${escapeHtml(cs.modelSize.split(' ')[0])}</span></a></li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en" data-root="${rootPrefix}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Industrial Post-Training Hub</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${rootPrefix}assets/styles.css">
</head>
<body>
  <header class="topbar">
    <div class="topbar-left">
      <button id="menu-toggle" class="menu-btn" aria-label="Toggle navigation">☰</button>
      <a class="brand" href="${rootPrefix}">
        <span class="brand-mark">PT</span>
        <span>Post-Training Industry Hub</span>
      </a>
    </div>
    <nav class="topbar-nav" aria-label="Primary">${topbarNav}</nav>
    <div class="topbar-actions">
      <button id="open-search" class="search-trigger" type="button">
        <span>Search hub…</span>
        <kbd>/</kbd>
      </button>
      <button id="theme-toggle" class="theme-btn" type="button" aria-label="Toggle color theme">☾</button>
    </div>
  </header>

  <div class="layout">
    <aside id="sidebar" class="sidebar" aria-label="Sidebar navigation">
      <div class="sidebar-group">
        <div class="sidebar-label">Start Here</div>
        <ul class="sidebar-links">
          <li><a href="${rootPrefix}" class="${activeNav === 'home' ? 'active' : ''}"><span>Executive Overview</span></a></li>
          <li><a href="${rootPrefix}case-studies/" class="${activeNav === 'cases' ? 'active' : ''}"><span>Audited Case Studies</span><span class="sidebar-pill">${caseStudies.length}</span></a></li>
          <li><a href="${rootPrefix}best-practices/" class="${activeNav === 'playbook' ? 'active' : ''}"><span>Field Playbook (10 Rules)</span></a></li>
        </ul>
      </div>
      <div class="sidebar-group">
        <div class="sidebar-label">Core Methods</div>
        <ul class="sidebar-links">
          <li><a href="${rootPrefix}sft/" class="${activeNav === 'sft' ? 'active' : ''}"><span>SFT &amp; Iterative SFT</span></a></li>
          <li><a href="${rootPrefix}rl/" class="${activeNav === 'rl' ? 'active' : ''}"><span>RL (GRPO · GSPO · Online)</span></a></li>
          <li><a href="${rootPrefix}distillation/" class="${activeNav === 'distill' ? 'active' : ''}"><span>Distillation &amp; OPD</span></a></li>
        </ul>
      </div>
      <div class="sidebar-group">
        <div class="sidebar-label">Stack &amp; Sources</div>
        <ul class="sidebar-links">
          <li><a href="${rootPrefix}frameworks/" class="${activeNav === 'frameworks' ? 'active' : ''}"><span>Frameworks &amp; Compute</span><span class="sidebar-pill">${frameworksData.frameworks.length}</span></a></li>
          <li><a href="${rootPrefix}references/" class="${activeNav === 'refs' ? 'active' : ''}"><span>Reference Library</span><span class="sidebar-pill">${references.length}</span></a></li>
        </ul>
      </div>
      <div class="sidebar-group">
        <div class="sidebar-label">Top Tier-1 Deep Dives</div>
        <ul class="sidebar-links">${sidebarCases}</ul>
      </div>
    </aside>

    <main class="main-wrap">
      ${bodyHtml}
      <footer class="site-footer">
        <span>Industrial Post-Training of Small &amp; Midsize Models (4B–35B) · SFT, RL &amp; Distillation</span>
        <span>Synthesized from Curated Notes &amp; 2025–2026 Industry Engineering Reports · GitHub &amp; GitLab Pages</span>
      </footer>
    </main>
  </div>

  <div id="search-modal" class="search-modal" role="dialog" aria-modal="true" aria-label="Search site">
    <div class="search-dialog">
      <div class="search-head">
        <span style="color:var(--text-muted)">⌕</span>
        <input id="global-search-input" type="search" placeholder="Search case studies, methods (GRPO, iSFT, OPD), frameworks, papers…" autocomplete="off">
        <kbd style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted)">ESC</kbd>
      </div>
      <div id="global-search-results" class="search-results"></div>
    </div>
  </div>

  <script src="${rootPrefix}assets/app.js"></script>
</body>
</html>`;
}

function buildHomePage() {
  const tier1Count = caseStudies.filter((c) => c.businessValueTier === 'Tier 1').length;
  const obsidianRefs = references.filter((r) => r.source === 'Obsidian Vault' || r.source === 'Apple Notes').length;

  const scorecardRows = caseStudies
    .map(
      (cs) => `<tr>
        <td><a href="./case-studies/${cs.slug}/"><strong>${escapeHtml(cs.title)}</strong></a><br><span style="font-size:0.78rem;color:var(--text-muted)">${escapeHtml(cs.industry)}</span></td>
        <td><code>${escapeHtml(cs.modelSize)}</code></td>
        <td><div class="badge-row" style="margin:0">${methodBadges(cs.methods)}</div><span style="font-size:0.77rem;color:var(--text-muted)">${escapeHtml(cs.methodLabel)}</span></td>
        <td><strong>${escapeHtml(cs.headlineMetrics[0].value)}</strong> ${escapeHtml(cs.headlineMetrics[0].label)} · ${escapeHtml(cs.headlineMetrics[1].value)} ${escapeHtml(cs.headlineMetrics[1].label)}</td>
        <td>${tierBadge(cs.businessValueTier, cs.businessValueTag)}</td>
      </tr>`
    )
    .join('');

  const bodyHtml = `
    <section class="hero">
      <div class="eyebrow">Industrial Post-Training Knowledge Hub · Updated Nov 2026</div>
      <h1>Post-Training Small &amp; Midsize Models for Real Industry Value</h1>
      <p class="hero-lead">
        A practitioner's guide to <strong>SFT</strong>, <strong>Reinforcement Learning</strong>, and <strong>Distillation</strong> for compact models (4B–35B dense &amp; small-active MoEs). Built by auditing real 2025–2026 production deployments, evaluating genuine business ROI, and consolidating curated practitioner notes and primary engineering reports.
      </p>
      <div class="hero-cta-row">
        <a class="btn btn-primary" href="./case-studies/">Explore ${caseStudies.length} Audited Case Studies →</a>
        <a class="btn btn-secondary" href="./best-practices/">Read the 10-Rule Field Playbook</a>
        <a class="btn btn-secondary" href="./references/">Browse ${references.length} Curated Links</a>
      </div>
      <div class="hero-stats">
        <div class="stat-box">
          <div class="stat-val">${tier1Count} / ${caseStudies.length}</div>
          <div class="stat-lbl">Tier-1 Proven Production ROI Cases</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">5× – 64×</div>
          <div class="stat-lbl">Documented Cost Savings vs. Frontier APIs</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">4B – 35B</div>
          <div class="stat-lbl">Sweet-Spot Production Parameter Range</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${obsidianRefs}+</div>
          <div class="stat-lbl">Curated Vault &amp; Notes Links Indexed</div>
        </div>
      </div>
    </section>

    <h2 class="section-heading">The Three Core Pillars</h2>
    <p class="section-sub">Deep technical guides covering when each method creates real business value, which algorithms work in 2026, and where teams burn compute.</p>
    <div class="card-grid-3">
      <a class="card card-link" href="./sft/">
        <div class="badge-row"><span class="badge badge-sft">Pillar 01 · SFT</span><span class="badge">LoRA · iSFT · Shadow-FT</span></div>
        <h3>Supervised Fine-Tuning &amp; Iterative SFT</h3>
        <p>Why clean LoRA SFT still dominates bounded high-volume tasks, how Baseten's <strong>iSFT</strong> jumped clinical accuracy from 52% to 78%, and how to avoid the hallucination &amp; forgetting tax.</p>
        <span style="margin-top:auto;font-size:0.84rem;font-weight:600;color:var(--accent)">Read SFT deep dive →</span>
      </a>
      <a class="card card-link" href="./rl/">
        <div class="badge-row"><span class="badge badge-rl">Pillar 02 · RL</span><span class="badge">GRPO · GSPO · DAPO · GDPO</span></div>
        <h3>Reinforcement Learning (RLVR &amp; Agentic RL)</h3>
        <p>How Coinbase (9B), Harvey (9B/35B-A3B), Cursor, and OpenPipe (14B) beat frontier APIs—plus reward engineering, Rubric Dropout, and critical multi-turn logprob &amp; token-ID fixes.</p>
        <span style="margin-top:auto;font-size:0.84rem;font-weight:600;color:var(--accent)">Read RL deep dive →</span>
      </a>
      <a class="card card-link" href="./distillation/">
        <div class="badge-row"><span class="badge badge-distill">Pillar 03 · Distillation</span><span class="badge">KD · OPD · SDFT · PivotOPD</span></div>
        <h3>Distillation &amp; On-Policy Distillation</h3>
        <p>From Booking.com off-policy KD to Thinking Machines' <strong>OPD</strong> (9×–30× cheaper than sparse RL)—plus late-2026 empirical caveats on when self-distillation fails out-of-distribution.</p>
        <span style="margin-top:auto;font-size:0.84rem;font-weight:600;color:var(--accent)">Read Distillation deep dive →</span>
      </a>
    </div>

    ${lifecycleSvg()}

    <h2 class="section-heading">Interactive Method Selector: When Should You Use What?</h2>
    <p class="section-sub">Click the enterprise workload that closest matches your problem to see the highest-ROI post-training method, model tier, and starter stack.</p>
    <div class="decision-box">
      <div class="decision-tabs" role="tablist">
        <button class="decision-tab active" data-target="dec-classify" type="button">High-Volume Tagging / Extraction</button>
        <button class="decision-tab" data-target="dec-docs" type="button">Long-Context Structured Docs</button>
        <button class="decision-tab" data-target="dec-agent" type="button">Multi-Turn Search / Tool Agent</button>
        <button class="decision-tab" data-target="dec-opd" type="button">Compress Strong Open Teacher</button>
        <button class="decision-tab" data-target="dec-telemetry" type="button">Live User Accept/Reject Loop</button>
        <button class="decision-tab" data-target="dec-regulated" type="button">Regulated / Zero-Hallucination CX</button>
      </div>

      <div id="dec-classify" class="decision-panel active">
        <div>
          <div class="badge-row"><span class="badge badge-sft">Recommended: Off-Policy Teacher KD + LoRA SFT</span></div>
          <h3 style="margin:6px 0 8px;">Skip RL — Clean Distillation + LoRA SFT Wins Immediately</h3>
          <p style="font-size:0.9rem;color:var(--text-secondary);">For millions of daily classification, routing, JSON extraction, or taxonomy tagging calls, RL adds engineering overhead without beating clean supervised distillation. Pair with vLLM multi-LoRA or Medusa speculative decoding.</p>
          <p style="font-size:0.86rem;"><strong>Proof points:</strong> <a href="./case-studies/marketplace-slms-booking-checkr-uber/">Checkr (30× faster, 5× cheaper) · Booking.com · Uber · DoorDash</a></p>
        </div>
        <dl class="decision-meta">
          <dt>Target Model Size</dt><dd>3.8B – 8B (Llama-3.1-8B, Qwen3-4B/8B)</dd>
          <dt>Data Needed</dt><dd>2,000 – 50,000 consensus-filtered examples</dd>
          <dt>Starter Stack</dt><dd>Unsloth or HF TRL + vLLM (1× RTX 4090 / H100)</dd>
          <dt>Expected ROI</dt><dd>5×–30× lower cost, sub-50ms latency</dd>
        </dl>
      </div>

      <div id="dec-docs" class="decision-panel">
        <div>
          <div class="badge-row"><span class="badge badge-sft">Recommended: Iterative SFT (iSFT)</span><span class="badge badge-rl">Optional Rubric RL</span></div>
          <h3 style="margin:6px 0 8px;">Use a Frontier Model as Rubric Grader &amp; Draft Repairer</h3>
          <p style="font-size:0.9rem;color:var(--text-secondary);">Standard distilled SFT plateaus around ~55% on 15K–25K token clinical notes, legal memos, or compaction tasks. Have a strong frontier model grade drafts against clinician/lawyer rubrics, repair failures (1–2 rounds), and run SFT strictly on 100%-passing outputs.</p>
          <p style="font-size:0.86rem;"><strong>Proof points:</strong> <a href="./case-studies/baseten-medical-scribes-isft/">Baseten Medical Scribes (66–78% acc)</a> · <a href="./case-studies/harvey-legal-agent-suite/">Harvey Compaction Agent</a></p>
        </div>
        <dl class="decision-meta">
          <dt>Target Model Size</dt><dd>27B – 32B (Qwen3-32B, Qwen3.5-27B)</dd>
          <dt>Data Needed</dt><dd>1,000 – 25,000 rubric-repaired traces (high-rank LoRA r=128–256)</dd>
          <dt>Starter Stack</dt><dd>HF TRL / Unsloth / Baseten Loops</dd>
          <dt>Expected ROI</dt><dd>+14–22 pts over standard SFT, HIPAA/VPC compliant</dd>
        </dl>
      </div>

      <div id="dec-agent" class="decision-panel">
        <div>
          <div class="badge-row"><span class="badge badge-rl">Recommended: Multi-Turn GRPO / DAPO / GSPO</span></div>
          <h3 style="margin:6px 0 8px;">Fix the Stateful Harness First, Then Run Multi-Turn RL</h3>
          <p style="font-size:0.9rem;color:var(--text-secondary);">Offload deduplication and bookkeeping to code (Harness-1). If you have verifiable outcomes (fraud labels, SQL execution, file/line F1, unit tests) or calibrated rubrics, multi-turn RL cuts redundant tool calls by 50%–67% and beats frontier APIs at a fraction of cost.</p>
          <p style="font-size:0.86rem;"><strong>Proof points:</strong> <a href="./case-studies/coinbase-fraud-agent/">Coinbase 9B</a> · <a href="./case-studies/openpipe-art-e/">OpenPipe ART·E 14B</a> · <a href="./case-studies/cognition-swe-grep/">Cognition SWE-grep</a> · <a href="./case-studies/harvey-legal-agent-suite/">Harvey 35B-A3B</a></p>
        </div>
        <dl class="decision-meta">
          <dt>Target Model Size</dt><dd>8B – 14B dense or 35B-A3B MoE</dd>
          <dt>Data Needed</dt><dd>500 – 2,000 realistic task environments + verifier</dd>
          <dt>Starter Stack</dt><dd>OpenPipe ART (1× H100), SkyRL, verl, or PrimeRL</dd>
          <dt>Expected ROI</dt><dd>5×–64× cheaper, -50% tokens/latency, higher F1</dd>
        </dl>
      </div>

      <div id="dec-opd" class="decision-panel">
        <div>
          <div class="badge-row"><span class="badge badge-distill">Recommended: Cross-Model On-Policy Distillation (OPD)</span></div>
          <h3 style="margin:6px 0 8px;">Dense Token-Level Feedback Without Exposure Bias</h3>
          <p style="font-size:0.9rem;color:var(--text-secondary);">When a large open-weight model (e.g., Qwen3-235B or GLM-5.3) already nails your task but is too slow/expensive to serve, sample rollouts from your 8B–32B student and train on per-token reverse KL from the teacher. Gets 9×–30× better compute efficiency than sparse RL.</p>
          <p style="font-size:0.86rem;"><strong>Proof points:</strong> <a href="./case-studies/thinking-machines-bridgewater-opd/">Thinking Machines × Bridgewater (1/14th cost, 9×–30× compute efficiency)</a></p>
        </div>
        <dl class="decision-meta">
          <dt>Target Model Size</dt><dd>4B – 32B student from 100B+ same-tokenizer open teacher</dd>
          <dt>Data Needed</dt><dd>Unlabeled domain prompts + open teacher logprob endpoint</dd>
          <dt>Starter Stack</dt><dd>verl (OPD), PrimeRL (OPD), HF TRL DistillationTrainer, Tinker</dd>
          <dt>Expected ROI</dt><dd>10×–14× serving savings, 9×–30× cheaper training than RL</dd>
        </dl>
      </div>

      <div id="dec-telemetry" class="decision-panel">
        <div>
          <div class="badge-row"><span class="badge badge-rl">Recommended: Online Policy-Gradient RL</span></div>
          <h3 style="margin:6px 0 8px;">Turn Product Interactions Into a Self-Improving Moat</h3>
          <p style="font-size:0.9rem;color:var(--text-secondary);">If your product generates hundreds of thousands of daily accept / dismiss / edit / escalate signals, tie each trace strictly to its serving checkpoint ID and run continuous on-policy policy-gradient updates—teaching the model both what to generate and when to stay silent.</p>
          <p style="font-size:0.86rem;"><strong>Proof points:</strong> <a href="./case-studies/cursor-tab-online-rl/">Cursor Tab Online RL (-21% noise, +28% accept rate, 1.5–2h deploys)</a></p>
        </div>
        <dl class="decision-meta">
          <dt>Target Model Size</dt><dd>Small ultra-low-latency model (≤10B)</dd>
          <dt>Data Needed</dt><dd>High-frequency logged checkpoint IDs + logprobs + user actions</dd>
          <dt>Starter Stack</dt><dd>Custom async Ray/vLLM pipeline + automated shadow eval gates</dd>
          <dt>Expected ROI</dt><dd>Compounding daily UX &amp; retention moat</dd>
        </dl>
      </div>

      <div id="dec-regulated" class="decision-panel">
        <div>
          <div class="badge-row"><span class="badge badge-sft">Abstention SFT + Grounding RL</span><span class="badge badge-tier1">VPC / Sovereign</span></div>
          <h3 style="margin:6px 0 8px;">Train Calibrated Abstention &amp; Disambiguation Explicitly</h3>
          <p style="font-size:0.9rem;color:var(--text-secondary);">In customer support, banking, legal, and healthcare, confident guessing kills adoption. Train explicitly on unanswerable/ambiguous cases so the model asks clarifying questions or escalates cleanly—and blend static domain corpora earlier (mid-training) if needed to prevent forgetting.</p>
          <p style="font-size:0.86rem;"><strong>Proof points:</strong> <a href="./case-studies/intercom-fin-apex/">Intercom Fin Apex (~76% resolution)</a> · <a href="./case-studies/mercor-apex-and-nova-forge/">Amazon Nova Forge &amp; Artificial Genius</a></p>
        </div>
        <dl class="decision-meta">
          <dt>Target Model Size</dt><dd>8B – 32B deployed in private VPC / on-prem</dd>
          <dt>Data Needed</dt><dd>Paired answerable + unanswerable + ambiguous scenarios</dd>
          <dt>Starter Stack</dt><dd>HF TRL / verl / AWS Nova Forge + strict TPR/FPR evals</dd>
          <dt>Expected ROI</dt><dd>Double-digit hallucination drop, auditability &amp; compliance sign-off</dd>
        </dl>
      </div>
    </div>

    <h2 class="section-heading">Audited Industry Scorecard (2024–2026)</h2>
    <p class="section-sub">Every project found online and in the vault was audited for concrete business value before deep-diving. Click any project for full recipe, ROI analysis, and lessons learned.</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Project &amp; Vertical</th>
            <th>Model Size</th>
            <th>Post-Training Method</th>
            <th>Verified Business &amp; Eval Impact</th>
            <th>Business Value</th>
          </tr>
        </thead>
        <tbody>${scorecardRows}</tbody>
      </table>
    </div>
  `;

  return pageShell({
    title: 'Overview',
    description: 'Practical industry post-training (SFT, RL, Distillation) for small and midsize models.',
    activeNav: 'home',
    rootPrefix: './',
    bodyHtml
  });
}

function buildCaseStudiesIndex() {
  const cards = caseStudies
    .map((cs) => {
      const searchBlob = `${cs.title} ${cs.company} ${cs.industry} ${cs.baseModel} ${cs.methodLabel} ${cs.summary} ${cs.keyLearnings.join(' ')}`;
      return `
      <a class="card card-link" href="./${cs.slug}/"
         data-cs-card
         data-methods="${escapeHtml(cs.methods.join(','))}"
         data-tier="${escapeHtml(cs.businessValueTier)}"
         data-size="${escapeHtml(cs.sizeCategory)}"
         data-search="${escapeHtml(searchBlob)}">
        <div class="badge-row">
          ${tierBadge(cs.businessValueTier, cs.businessValueTag)}
          ${methodBadges(cs.methods)}
          <span class="badge">${escapeHtml(cs.modelSize)}</span>
        </div>
        <h3>${escapeHtml(cs.title)}</h3>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">${escapeHtml(cs.company)} · ${escapeHtml(cs.industry)} · ${escapeHtml(cs.year)}</p>
        <p>${escapeHtml(cs.summary)}</p>
        <div class="kpi-mini">
          ${cs.headlineMetrics
            .slice(0, 2)
            .map((m) => `<div class="kpi-cell"><strong>${escapeHtml(m.value)}</strong><span>${escapeHtml(m.label)}</span></div>`)
            .join('')}
        </div>
        <span style="font-size:0.83rem;font-weight:600;color:var(--accent)">Open business value &amp; technical deep dive →</span>
      </a>`;
    })
    .join('');

  const bodyHtml = `
    <div class="prose">
      <h1>Audited Industry Case Studies</h1>
      <p>Real-world small and midsize post-training projects discovered across 2024–2026 engineering reports and curated practitioner archives—screened for <strong>genuine business value</strong> (unit economics, latency, accuracy vs. frontier, compliance) and unpacked into transferable technical recipes.</p>
    </div>

    <div class="filter-bar">
      <input id="cs-search" class="filter-input" type="search" placeholder="Filter by company, model (Qwen3.5-9B, Qwen3-32B, Llama), industry, or method…">
      <div class="filter-row">
        <span class="filter-label">Method</span>
        <button class="filter-pill active" data-cs-filter="method" data-val="all" type="button">All</button>
        <button class="filter-pill" data-cs-filter="method" data-val="SFT" type="button">SFT / iSFT</button>
        <button class="filter-pill" data-cs-filter="method" data-val="RL" type="button">RL</button>
        <button class="filter-pill" data-cs-filter="method" data-val="Distillation" type="button">Distillation / OPD</button>
      </div>
      <div class="filter-row">
        <span class="filter-label">ROI Tier</span>
        <button class="filter-pill active" data-cs-filter="tier" data-val="all" type="button">All Tiers</button>
        <button class="filter-pill" data-cs-filter="tier" data-val="Tier 1" type="button">Tier 1 · Proven Production ROI</button>
        <button class="filter-pill" data-cs-filter="tier" data-val="Tier 2" type="button">Tier 2 · Validated High-Potential</button>
      </div>
      <div class="filter-row">
        <span class="filter-label">Model Size</span>
        <button class="filter-pill active" data-cs-filter="size" data-val="all" type="button">All Sizes</button>
        <button class="filter-pill" data-cs-filter="size" data-val="Small (≤10B)" type="button">Small (≤10B)</button>
        <button class="filter-pill" data-cs-filter="size" data-val="Midsize (11B–35B)" type="button">Midsize (11B–35B)</button>
      </div>
    </div>

    <div id="cs-count" class="results-count"></div>
    <div id="case-study-grid" class="card-grid-2">${cards}</div>
  `;

  return pageShell({
    title: 'Audited Industry Case Studies',
    description: 'Real-world production post-training case studies audited for business value and technical learnings.',
    activeNav: 'cases',
    rootPrefix: '../',
    bodyHtml
  });
}

function buildCaseStudyDetail(cs, idx) {
  const prev = idx > 0 ? caseStudies[idx - 1] : null;
  const next = idx < caseStudies.length - 1 ? caseStudies[idx + 1] : null;

  const bodyHtml = `
    <div class="breadcrumb"><a href="../../">Overview</a> / <a href="../">Case Studies</a> / ${escapeHtml(cs.title)}</div>

    <div class="prose">
      <div class="badge-row">
        ${tierBadge(cs.businessValueTier, cs.businessValueTag)}
        ${methodBadges(cs.methods)}
        <span class="badge">${escapeHtml(cs.modelSize)}</span>
        <span class="badge">${escapeHtml(cs.industry)}</span>
        <span class="badge">${escapeHtml(cs.year)}</span>
      </div>
      <h1>${escapeHtml(cs.title)}</h1>
      <p style="font-size:1.04rem;color:var(--text);">${escapeHtml(cs.summary)}</p>
    </div>

    <div class="kpi-strip">
      ${cs.headlineMetrics
        .map((m) => `<div class="stat-box"><div class="stat-val">${escapeHtml(m.value)}</div><div class="stat-lbl">${escapeHtml(m.label)}</div></div>`)
        .join('')}
    </div>

    <div class="callout callout-field">
      <p><strong>Business Value Audit (${escapeHtml(cs.businessValueTier)} — ${escapeHtml(cs.businessValueTag)}):</strong> ${escapeHtml(cs.businessValueAnalysis)}</p>
    </div>

    <div class="prose">
      <h2>Operational Problem Context</h2>
      <p>${escapeHtml(cs.problemContext)}</p>

      <h2>Technical Post-Training Recipe</h2>
      <div class="table-wrap">
        <table>
          <tbody>
            <tr><th style="width:210px;">Base Model &amp; Serving</th><td>${escapeHtml(cs.baseModel)} — ${escapeHtml(cs.technicalRecipe.architecture)}</td></tr>
            <tr><th>Post-Training Method</th><td><strong>${escapeHtml(cs.methodLabel)}</strong></td></tr>
            <tr><th>Training Stack</th><td>${escapeHtml(cs.technicalRecipe.trainingStack)}</td></tr>
            <tr><th>Data &amp; Harness</th><td>${escapeHtml(cs.technicalRecipe.dataAndHarness)}</td></tr>
            <tr><th>Reward / Supervision</th><td>${escapeHtml(cs.technicalRecipe.rewardDesign)}</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Quantified Results</h2>
      <ul>${cs.quantifiedResults.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
    </div>

    <div class="detail-grid">
      <div class="detail-box" style="border-top:3px solid var(--emerald);">
        <h3>What We Can Learn &amp; Reuse</h3>
        <ul>${cs.keyLearnings.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
      </div>
      <div class="detail-box" style="border-top:3px solid var(--rose);">
        <h3>Watchouts &amp; Constraints</h3>
        <ul>${cs.watchouts.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
      </div>
    </div>

    <div class="prose">
      <h2>Primary Sources</h2>
      <ul>
        ${cs.links
          .map((l) => `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a></li>`)
          .join('')}
      </ul>
      <p style="font-size:0.82rem;color:var(--text-muted);">Discovered via: ${escapeHtml(cs.sourceOrigin.join(' · '))}</p>
    </div>

    <div style="display:flex;justify-content:space-between;gap:12px;margin-top:32px;flex-wrap:wrap;">
      ${prev ? `<a class="btn btn-secondary" href="../${prev.slug}/">← ${escapeHtml(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a class="btn btn-secondary" href="../${next.slug}/">${escapeHtml(next.title)} →</a>` : ''}
    </div>
  `;

  return pageShell({
    title: cs.title,
    description: cs.summary,
    activeNav: `cs:${cs.slug}`,
    rootPrefix: '../../',
    bodyHtml
  });
}

function buildMarkdownPage({ mdFile, activeNav, title, description, extraBlockAfterFirstH2 = '' }) {
  const raw = fs.readFileSync(path.join(ROOT, 'docs', mdFile), 'utf8');
  let { html, toc } = renderMarkdown(raw);
  if (extraBlockAfterFirstH2) {
    html = html.replace(/<h2 /, `${extraBlockAfterFirstH2}\n<h2 `);
  }
  const tocHtml = toc.length
    ? `<aside class="toc" aria-label="On this page">
         <div class="toc-title">On this page</div>
         <ul>${toc
           .map((t) => `<li class="toc-h${t.level}"><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`)
           .join('')}</ul>
       </aside>`
    : '';

  const bodyHtml = `
    <div class="doc-grid">
      <article class="prose">${html}</article>
      ${tocHtml}
    </div>
  `;

  return pageShell({
    title,
    description,
    activeNav,
    rootPrefix: '../',
    bodyHtml
  });
}

function buildFrameworksPage() {
  const fwRows = frameworksData.frameworks
    .map(
      (fw) => `<tr>
        <td><a href="${escapeHtml(fw.url)}" target="_blank" rel="noopener"><strong>${escapeHtml(fw.name)}</strong></a><br><a href="${escapeHtml(fw.docsUrl)}" target="_blank" rel="noopener" style="font-size:0.77rem;">Docs / Recipe ↗</a></td>
        <td>${escapeHtml(fw.bestFor)}<br><span style="font-size:0.78rem;color:var(--accent);"><strong>Sweet spot:</strong> ${escapeHtml(fw.sweetSpot)}</span></td>
        <td><code>${escapeHtml(fw.rlAlgorithms)}</code></td>
        <td>${escapeHtml(fw.distillation)}</td>
        <td>${escapeHtml(fw.multiStep)}</td>
        <td>${escapeHtml(fw.hardware)}</td>
      </tr>`
    )
    .join('');

  const hwRows = frameworksData.hardwareSizing
    .map(
      (hw) => `<tr>
        <td><strong>${escapeHtml(hw.tier)}</strong><br><span style="font-size:0.79rem;color:var(--text-muted)">${escapeHtml(hw.models)}</span></td>
        <td>${escapeHtml(hw.sftHardware)}</td>
        <td>${escapeHtml(hw.rlHardware)}</td>
        <td>${escapeHtml(hw.servingProfile)}</td>
        <td><code>${escapeHtml(hw.typicalBudget)}</code></td>
      </tr>`
    )
    .join('');

  const bodyHtml = `
    <div class="prose">
      <h1>Post-Training Frameworks, Compute &amp; Hardware Stack</h1>
      <p>Do not vibe-code custom RL trainers from scratch. Below is the battle-tested 2026 tooling landscape for SFT, multi-turn RL, rubric judges, and On-Policy Distillation—audited from live production deployments and practitioner benchmarks.</p>

      <h2>1. Framework Comparison Matrix</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Framework</th>
              <th>Best For &amp; Sweet Spot</th>
              <th>RL Algorithms</th>
              <th>Distillation / OPD</th>
              <th>Multi-Step Agents</th>
              <th>Hardware &amp; Deployment</th>
            </tr>
          </thead>
          <tbody>${fwRows}</tbody>
        </table>
      </div>

      <h2>2. Practical Hardware &amp; Budget Sizing (4B–35B)</h2>
      <p>VRAM requirements depend heavily on sequence length, LoRA vs. full-parameter updates, FP8 kernels, and parallel rollout group size. Memory-saving kernels such as <strong>Unsloth's chunked GRPO kernels</strong> and <strong>Liger-Kernel</strong> (<code>use_liger_kernel=True</code> in TRL) compute logits and loss block-by-block so full vocabulary logits never materialize in backward VRAM.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Model Tier</th>
              <th>SFT / iSFT Hardware</th>
              <th>RL / OPD Hardware</th>
              <th>Production Serving Profile</th>
              <th>Typical Run Budget</th>
            </tr>
          </thead>
          <tbody>${hwRows}</tbody>
        </table>
      </div>

      <h2>3. Quick Stack Selection Guide</h2>
      <ul>
        <li><strong>Single GPU (1× RTX 4090 / RTX PRO 6000 / 1× H100):</strong> Use <strong>Unsloth</strong> for SFT &amp; 1.5B–9B GRPO, or <strong>OpenPipe ART</strong> for multi-turn agentic GRPO (proven by ART·E 14B in &lt;24h on 1× H100).</li>
        <li><strong>Multi-GPU / Cluster Production RL &amp; OPD:</strong> Use <strong>verl</strong>, <strong>SkyRL</strong> (Coinbase &amp; Mercor), or <strong>PrimeRL + Verifiers</strong> (async FSDP2 + vLLM).</li>
        <li><strong>Zero GPU Ops / API-First Training:</strong> Use <strong>Tinker (Thinking Machines)</strong> for full algorithmic control over SFT, RL, Rubric Grading, and OPD from a local Python client.</li>
        <li><strong>Existing Production Agent Frameworks:</strong> Use <strong>Microsoft Agent Lightning</strong> to bolt RL onto existing LangChain/AutoGen/ServiceNow workflows without rewriting business logic.</li>
      </ul>
    </div>
  `;

  return pageShell({
    title: 'Frameworks & Compute',
    description: 'Comparison of 2026 post-training frameworks (verl, SkyRL, PrimeRL, ART, Unsloth, TRL, Tinker) and GPU sizing.',
    activeNav: 'frameworks',
    rootPrefix: '../',
    bodyHtml
  });
}

function buildReferencesPage() {
  const pillars = ['Industry Case Study', 'SFT', 'RL', 'Distillation', 'Evals & Rewards', 'Frameworks & Infra', 'Continual Learning & Memory'];
  const sources = ['Obsidian Vault', 'Apple Notes'];
  const types = ['Blog / Case Study', 'Paper', 'Repo / Tool', 'Video / Talk'];

  const refItemsHtml = references
    .map((r) => {
      const pillarCls =
        r.pillar === 'SFT'
          ? 'badge-sft'
          : r.pillar === 'RL'
          ? 'badge-rl'
          : r.pillar === 'Distillation'
          ? 'badge-distill'
          : r.pillar === 'Industry Case Study'
          ? 'badge-tier1'
          : '';
      const searchBlob = `${r.title} ${r.pillar} ${r.type} ${r.source} ${r.year} ${r.takeaway}`;
      return `
      <div class="ref-item"
           data-ref-item
           data-pillar="${escapeHtml(r.pillar)}"
           data-source="${escapeHtml(r.source)}"
           data-type="${escapeHtml(r.type)}"
           data-search="${escapeHtml(searchBlob)}">
        <div class="ref-item-head">
          <a class="ref-title" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title)} ↗</a>
          <span class="badge">${r.year}</span>
        </div>
        <p class="ref-takeaway">${escapeHtml(r.takeaway)}</p>
        <div class="badge-row" style="margin:2px 0 0;">
          <span class="badge ${pillarCls}">${escapeHtml(r.pillar)}</span>
          <span class="badge">${escapeHtml(r.type)}</span>
          <span class="badge">${escapeHtml(r.source)}</span>
        </div>
      </div>`;
    })
    .join('');

  const bodyHtml = `
    <div class="prose">
      <h1>Curated Reference Library</h1>
      <p>The highest-signal papers, production engineering writeups, open-source repos, and talks synthesized from curated research notes and live 2024–2026 industry publications.</p>
    </div>

    <div class="filter-bar">
      <input id="ref-search" class="filter-input" type="search" placeholder="Search papers, authors, algorithms (GDPO, GSPO, OPD, iSFT, Harness-1, Coinbase)…">
      <div class="filter-row">
        <span class="filter-label">Pillar</span>
        <button class="filter-pill active" data-ref-filter="pillar" data-val="all" type="button">All</button>
        ${pillars.map((p) => `<button class="filter-pill" data-ref-filter="pillar" data-val="${escapeHtml(p)}" type="button">${escapeHtml(p)}</button>`).join('')}
      </div>
      <div class="filter-row">
        <span class="filter-label">Type</span>
        <button class="filter-pill active" data-ref-filter="type" data-val="all" type="button">All Types</button>
        ${types.map((t) => `<button class="filter-pill" data-ref-filter="type" data-val="${escapeHtml(t)}" type="button">${escapeHtml(t)}</button>`).join('')}
      </div>
      <div class="filter-row">
        <span class="filter-label">Origin</span>
        <button class="filter-pill active" data-ref-filter="source" data-val="all" type="button">All Origins</button>
        ${sources.map((s) => `<button class="filter-pill" data-ref-filter="source" data-val="${escapeHtml(s)}" type="button">${escapeHtml(s)}</button>`).join('')}
      </div>
    </div>

    <div id="ref-count" class="results-count"></div>
    <div id="ref-list" class="ref-list">${refItemsHtml}</div>
  `;

  return pageShell({
    title: 'Curated Reference Library',
    description: 'Searchable archive of post-training papers, industry case studies, repos, and talks from Obsidian, Apple Notes, and web research.',
    activeNav: 'refs',
    rootPrefix: '../',
    bodyHtml
  });
}

function buildSearchIndex() {
  const index = [
    { title: 'Executive Overview & Interactive Method Selector', category: 'Guide', url: '', excerpt: 'When to use SFT, iSFT, GRPO, OPD, Online RL + full industry ROI scorecard.', external: false },
    { title: 'Supervised Fine-Tuning (SFT) & Iterative SFT', category: 'Core Pillar', url: 'sft/', excerpt: 'LoRA without regret, Baseten iSFT, Shadow-FT, Base+merge, abstention & avoiding hallucination tax.', external: false },
    { title: 'Reinforcement Learning (GRPO, DAPO, GSPO, GDPO, Online RL)', category: 'Core Pillar', url: 'rl/', excerpt: 'RLVR, Rubrics-as-Rewards, Rubric Dropout, logprob mismatch, token-in-token-out, multi-reward balance.', external: false },
    { title: 'Distillation (Off-Policy KD, On-Policy Distillation / OPD, Self-Distillation)', category: 'Core Pillar', url: 'distillation/', excerpt: 'OPD 9x-30x compute savings, PivotOPD, SDFT/SDPO, late-2026 self-distillation OOD caveats.', external: false },
    { title: 'Frameworks, Compute & Hardware Sizing', category: 'Stack', url: 'frameworks/', excerpt: 'verl, SkyRL, PrimeRL, OpenPipe ART, Unsloth, HF TRL, Tinker, Agent Lightning, GPU budgets.', external: false },
    { title: 'Production Post-Training Playbook (10 Rules)', category: 'Best Practices', url: 'best-practices/', excerpt: 'Harness first, overfit smoke test, token-in-token-out, judge variance, FP8 controls, sampling bounds.', external: false },
    { title: 'Curated Reference Library', category: 'Archive', url: 'references/', excerpt: 'Filterable archive of Obsidian Vault, Apple Notes, and 2025-2026 web links.', external: false }
  ];

  for (const cs of caseStudies) {
    index.push({
      title: `${cs.title} (${cs.modelSize})`,
      category: `Case Study · ${cs.businessValueTier}`,
      url: `case-studies/${cs.slug}/`,
      excerpt: `${cs.methodLabel} — ${cs.summary}`,
      external: false
    });
  }

  for (const fw of frameworksData.frameworks) {
    index.push({
      title: fw.name,
      category: 'Framework',
      url: 'frameworks/',
      excerpt: `${fw.rlAlgorithms} · ${fw.bestFor}`,
      external: false
    });
  }

  for (const ref of references) {
    index.push({
      title: ref.title,
      category: `${ref.pillar} · ${ref.year}`,
      url: ref.url,
      excerpt: ref.takeaway,
      external: true
    });
  }

  return index;
}

function writeOut(relPath, content) {
  const full = path.join(PUBLIC_DIR, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

// Clean & rebuild public/
fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(PUBLIC_DIR, 'assets'), { recursive: true });

// Copy static assets
fs.copyFileSync(path.join(ROOT, 'src/styles.css'), path.join(PUBLIC_DIR, 'assets/styles.css'));
fs.copyFileSync(path.join(ROOT, 'src/app.js'), path.join(PUBLIC_DIR, 'assets/app.js'));

// Render pages
writeOut('index.html', buildHomePage());
writeOut('case-studies/index.html', buildCaseStudiesIndex());
caseStudies.forEach((cs, idx) => {
  writeOut(`case-studies/${cs.slug}/index.html`, buildCaseStudyDetail(cs, idx));
});

writeOut(
  'sft/index.html',
  buildMarkdownPage({
    mdFile: 'sft.md',
    activeNav: 'sft',
    title: 'SFT & Iterative SFT',
    description: 'Supervised Fine-Tuning, LoRA, iSFT, Shadow-FT, and hallucination control for small/midsize industry models.'
  })
);
writeOut(
  'rl/index.html',
  buildMarkdownPage({
    mdFile: 'rl.md',
    activeNav: 'rl',
    title: 'Reinforcement Learning',
    description: 'RLVR, GRPO, DAPO, GSPO, GDPO, Rubric Rewards, and multi-turn engineering stability.'
  })
);
writeOut(
  'distillation/index.html',
  buildMarkdownPage({
    mdFile: 'distillation.md',
    activeNav: 'distill',
    title: 'Distillation & On-Policy Distillation',
    description: 'Off-policy KD, On-Policy Distillation (OPD), Self-Distillation, and late-2026 empirical caveats.',
    extraBlockAfterFirstH2: distillationSvg()
  })
);
writeOut(
  'best-practices/index.html',
  buildMarkdownPage({
    mdFile: 'best-practices.md',
    activeNav: 'playbook',
    title: 'Production Post-Training Playbook',
    description: '10 field-tested rules for post-training small and midsize models in industry.'
  })
);

writeOut('frameworks/index.html', buildFrameworksPage());
writeOut('references/index.html', buildReferencesPage());
writeOut('search-index.json', JSON.stringify(buildSearchIndex(), null, 2));
writeOut('.nojekyll', '');

// Clean 404 page for GitLab Pages
writeOut(
  '404.html',
  pageShell({
    title: 'Page Not Found',
    description: '404 Not Found',
    activeNav: '',
    rootPrefix: './',
    bodyHtml: `<div class="prose"><h1>404 — Page Not Found</h1><p>Return to the <a href="./">Industrial Post-Training Hub overview</a> or press <code>/</code> to search.</p></div>`
  })
);

console.log(`Built GitLab Pages site to ${PUBLIC_DIR}:`);
console.log(`  - ${caseStudies.length} audited case study deep-dive pages`);
console.log(`  - 4 deep-dive Markdown chapters (SFT, RL, Distillation, Best Practices)`);
console.log(`  - Frameworks & Compute matrix (${frameworksData.frameworks.length} frameworks)`);
console.log(`  - Curated Reference Library (${references.length} links)`);
