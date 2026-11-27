import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const caseStudies = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/case-studies.json'), 'utf8'));
const frameworksData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/frameworks.json'), 'utf8'));
const references = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/references.json'), 'utf8'));
const toolAlpacaPost = {
  title: 'Mapping the accuracy–retention trade-off in ToolAlpaca fine-tuning',
  description: 'How adapter rank affects learning and forgetting, and how MiCA compares with LoRA on Qwen2.5-7B-Instruct.',
  path: 'blog/toolalpaca-accuracy-retention/',
  date: '2026-11-27'
};

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

function renderMathToken(expr) {
  let s = expr.trim();
  // Common scientific tokens used in docs/*.md
  const exact = {
    '\\pm\\mathrm{SE}': '±SE',
    '\\pm\\text{SE}': '±SE',
    '\\pm 0.10': '±0.10',
    '-0.27': '−0.27',
    '+2.0 \\pm 1.1': '+2.0 ± 1.1',
    '\\pi_\\theta': '<em>π</em><sub>θ</sub>',
    '\\pi_T': '<em>π</em><sub><em>T</em></sub>',
    '\\pi_\\theta(\\cdot \\mid x, c)': '<em>π</em><sub>θ</sub>(· | <em>x</em>, <em>c</em>)',
    'y \\sim \\pi_\\theta(\\cdot \\mid x)': '<em>y</em> ~ <em>π</em><sub>θ</sub>(· | <em>x</em>)',
    '\\pi_T(y_t \\mid x, y_{<t})': '<em>π</em><sub><em>T</em></sub>(<em>y</em><sub><em>t</em></sub> | <em>x</em>, <em>y</em><sub>&lt;<em>t</em></sub>)',
    'D_{\\mathrm{KL}}(\\pi_\\theta \\,\\|\\, \\pi_T)': '<em>D</em><sub>KL</sub>(<em>π</em><sub>θ</sub> ∥ <em>π</em><sub><em>T</em></sub>)',
    '\\mathcal{O}(1)': '<em>O</em>(1)',
    '(x, y)': '(<em>x</em>, <em>y</em>)',
    '(x, y^*)': '(<em>x</em>, <em>y</em>*)',
    'y^*': '<em>y</em>*',
    'x': '<em>x</em>',
    'c': '<em>c</em>',
    'G': '<em>G</em>',
    'F_1': '<em>F</em><sub>1</sub>',
    'N = 25{,}000': '<em>N</em> = 25,000',
    'r \\in [16, 64]': '<em>r</em> ∈ [16, 64]',
    'r = 256, \\alpha = 32': '<em>r</em> = 256, α = 32',
    '5\\times': '5×',
    '10\\times': '10×',
    '2\\times': '2×',
    '1.8\\times': '1.8×',
    '2.5\\times': '2.5×',
    '4\\times': '4×',
    '9\\times': '9×',
    '30\\times': '30×',
    '>95\\%': '&gt;95%',
    '\\to': '→'
  };
  if (exact[s]) return exact[s];

  // Exponents like 10^3, 10^{-6}, 5 \times 10^{-5}
  s = s
    .replace(/\\log/g, 'log')
    .replace(/\\pi_\\theta/g, '<em>π</em><sub>θ</sub>')
    .replace(/\\pi_T/g, '<em>π</em><sub><em>T</em></sub>')
    .replace(/\\times/g, '×')
    .replace(/\\to/g, '→')
    .replace(/\\pm/g, '±')
    .replace(/\\mid/g, '|')
    .replace(/\\%/g, '%')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/10\^\{([^}]+)\}/g, '10<sup>$1</sup>')
    .replace(/10\^(\d+)/g, '10<sup>$1</sup>')
    .replace(/_\{([^}]+)\}/g, '<sub>$1</sub>')
    .replace(/_([a-zA-Z0-9])/g, '<sub>$1</sub>');
  return s;
}

function inlineMd(text) {
  // Split out inline code first so math/markdown doesn't touch code spans
  const parts = String(text).split(/(`[^`]+`)/g);
  return parts
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }
      // Split math $...$
      const mathSplit = part.split(/(\$[^$]+\$)/g);
      return mathSplit
        .map((seg) => {
          if (seg.startsWith('$') && seg.endsWith('$')) {
            return renderMathToken(seg.slice(1, -1));
          }
          let out = escapeHtml(seg);
          out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
          out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
          out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
          return out;
        })
        .join('');
    })
    .join('');
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const toc = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Academic remark blocks :::insight / :::field / :::warning
    const calloutMatch = line.match(/^:::(insight|field|warning)\s*$/);
    if (calloutMatch) {
      i++;
      const inner = [];
      while (i < lines.length && !lines[i].match(/^:::\s*$/)) {
        inner.push(lines[i]);
        i++;
      }
      i++;
      const innerHtml = renderMarkdown(inner.join('\n')).html;
      html.push(`<div class="remark">${innerHtml}</div>`);
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

    // Blockquote
    if (/^>\s?/.test(line)) {
      const qLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qLines.push(lines[i].replace(/^>\s?/, '').trim());
        i++;
      }
      html.push(`<blockquote class="remark"><p>${inlineMd(qLines.join(' '))}</p></blockquote>`);
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
      if (level === 2) {
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
      i += 2;
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

    // Unordered list
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
      !lines[i].match(/^(#{1,3}\s|```|---+|:::|>\s?|\s*-\s+|\d+\.\s+)/) &&
      !(lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[i + 1]))
    ) {
      para.push(lines[i].trim());
      i++;
    }
    html.push(`<p>${inlineMd(para.join(' '))}</p>`);
  }

  return { html: html.join('\n'), toc };
}

function pipelineFigureSvg() {
  return `
  <figure class="tech-figure">
    <svg viewBox="0 0 840 148" width="100%" height="auto" role="img" aria-label="Four-stage industrial post-training architecture">
      <defs>
        <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 7 4 L 0 7 z" fill="currentColor"/>
        </marker>
      </defs>
      <g fill="none" stroke="currentColor" stroke-width="1">
        <rect x="6" y="16" width="178" height="86"/>
        <rect x="222" y="16" width="178" height="86"/>
        <rect x="438" y="16" width="186" height="86"/>
        <rect x="662" y="16" width="172" height="86"/>
        <line x1="184" y1="59" x2="218" y2="59" marker-end="url(#arr)"/>
        <line x1="400" y1="59" x2="434" y2="59" marker-end="url(#arr)"/>
        <line x1="624" y1="59" x2="658" y2="59" marker-end="url(#arr)"/>
        <path d="M 748 102 L 748 130 L 531 130 L 531 106" stroke-dasharray="3 3" marker-end="url(#arr)"/>
      </g>
      <g fill="currentColor" font-family="Inter, sans-serif">
        <text x="16" y="34" font-size="9.5" opacity="0.65">I. PRETRAINED BASE &amp; HARNESS</text>
        <text x="16" y="53" font-size="11.5" font-weight="600">Compact Open Checkpoint</text>
        <text x="16" y="71" font-size="10.5" opacity="0.8">4B–35B dense or 35B-A3B MoE</text>
        <text x="16" y="87" font-size="10" opacity="0.65">Externalized state &amp; eval suite</text>

        <text x="232" y="34" font-size="9.5" opacity="0.65">II. SUPERVISED INITIALIZATION</text>
        <text x="232" y="53" font-size="11.5" font-weight="600">LoRA SFT / Iterative SFT</text>
        <text x="232" y="71" font-size="10.5" opacity="0.8">Schema &amp; protocol alignment</text>
        <text x="232" y="87" font-size="10" opacity="0.65">Rubric-repaired drafts (x, y*)</text>

        <text x="448" y="34" font-size="9.5" opacity="0.65">III. ON-POLICY OPTIMIZATION</text>
        <text x="448" y="53" font-size="11.5" font-weight="600">RLVR / Rubric RL / OPD</text>
        <text x="448" y="71" font-size="10.5" opacity="0.8">GRPO, DAPO, GSPO, or reverse KL</text>
        <text x="448" y="87" font-size="10" opacity="0.65">Error recovery &amp; token efficiency</text>

        <text x="672" y="34" font-size="9.5" opacity="0.65">IV. DEPLOYMENT</text>
        <text x="672" y="53" font-size="11.5" font-weight="600">VPC Serving Fleet</text>
        <text x="672" y="71" font-size="10.5" opacity="0.8">vLLM / SGLang · FP8 · Multi-LoRA</text>
        <text x="672" y="87" font-size="10" opacity="0.65">5×–64× lower inference cost</text>

        <text x="556" y="142" font-size="9.5" opacity="0.7">Logged trajectories &amp; failure slices</text>
      </g>
    </svg>
    <figcaption><strong>Figure 1.</strong> Canonical post-training pipeline for industrial small and midsize language models. Deterministic state management and evaluation design precede supervised initialization (SFT/iSFT) and on-policy optimization (RL or On-Policy Distillation).</figcaption>
  </figure>`;
}

function pageShell({ title, description, activeNav, rootPrefix, bodyHtml }) {
  const navItems = [
    { key: 'home', label: 'Overview', href: '' },
    { key: 'sft', label: 'SFT', href: 'sft/' },
    { key: 'rl', label: 'Reinforcement Learning', href: 'rl/' },
    { key: 'distill', label: 'Distillation', href: 'distillation/' },
    { key: 'cases', label: 'Case Studies', href: 'case-studies/' },
    { key: 'frameworks', label: 'Frameworks', href: 'frameworks/' },
    { key: 'playbook', label: 'Protocol', href: 'best-practices/' },
    { key: 'guide', label: 'Pipeline Guide', href: 'post-training-guide/' },
    { key: 'blueprint', label: 'Industrial Sequence', href: 'company-blueprint/' },
    { key: 'blog', label: 'Blog', href: 'blog/' },
    { key: 'refs', label: 'Bibliography', href: 'references/' }
  ];

  const navLinks = navItems
    .map(
      (n) =>
        `<a href="${rootPrefix}${n.href}" class="${activeNav === n.key || (n.key === 'cases' && activeNav.startsWith('cs:')) ? 'active' : ''}">${n.label}</a>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en" data-root="${rootPrefix}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — Post-Training Compendium</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${rootPrefix}assets/styles.css">
</head>
<body>
  <header class="site-header">
    <div class="header-top">
      <a class="site-title" href="${rootPrefix}">Post-Training of Small &amp; Midsize Models</a>
      <div class="header-controls">
        <button id="open-search" class="text-btn" type="button">Search [/]</button>
        <span>·</span>
        <button id="theme-toggle" class="text-btn" type="button">Dark</button>
      </div>
    </div>
    <nav class="site-nav" aria-label="Primary navigation">${navLinks}</nav>
  </header>

  <main class="page-container">
    ${bodyHtml}
    <footer class="site-footer">
      <span>Technical Compendium on SFT, Reinforcement Learning, and Distillation (4B–35B Models)</span>
      <span>Updated November 2026 · <a href="https://github.com/sr-networks/posttrain" target="_blank" rel="noopener">Source Repository</a></span>
    </footer>
  </main>

  <div id="search-modal" class="search-modal" role="dialog" aria-modal="true" aria-label="Search compendium">
    <div class="search-dialog">
      <div class="search-head">
        <input id="global-search-input" type="search" placeholder="Search chapters, studies, algorithms, or references…" autocomplete="off">
        <span style="font-size:0.72rem;color:var(--text-muted)">ESC</span>
      </div>
      <div id="global-search-results" class="search-results"></div>
    </div>
  </div>

  <script src="${rootPrefix}assets/app.js"></script>
</body>
</html>`;
}

function buildHomePage() {
  const studyRows = caseStudies
    .map(
      (cs) => `<tr>
        <td><a href="./case-studies/${cs.slug}/">${escapeHtml(cs.title)}</a></td>
        <td>${escapeHtml(cs.industry)}</td>
        <td><code>${escapeHtml(cs.modelSize)}</code></td>
        <td>${escapeHtml(cs.methodLabel)}</td>
        <td>${escapeHtml(cs.headlineMetrics[0].value)} ${escapeHtml(cs.headlineMetrics[0].label)}; ${escapeHtml(cs.headlineMetrics[1].value)} ${escapeHtml(cs.headlineMetrics[1].label)}</td>
        <td>${escapeHtml(cs.businessValueTier)}</td>
      </tr>`
    )
    .join('');

  const bodyHtml = `
    <div class="prose">
      <h1>Post-Training of Small and Midsize Language Models in Industry</h1>
      <p class="doc-subtitle">A technical synthesis of supervised fine-tuning, reinforcement learning, and knowledge distillation for 4B–35B parameter models across production deployments.</p>
      <p class="doc-meta">Technical Compendium · November 2026 · ${caseStudies.length} Empirical Case Studies · ${references.length} Annotated References</p>
    </div>

    <div class="abstract">
      <div class="abstract-label">Abstract</div>
      <p>
        General-purpose frontier models incur substantial latency, per-token expenditure, and data-governance constraints when applied to bounded, high-volume enterprise workloads. Empirical deployments from 2024–2026 demonstrate that small and midsize open-weight models (4B–35B dense checkpoints and sparse Mixture-of-Experts architectures with ~3B active parameters) frequently match or exceed frontier model performance on specialized tasks when adapted via domain-specific post-training. This compendium examines the methodological conditions under which supervised fine-tuning (SFT and iterative SFT), on-policy reinforcement learning (GRPO, DAPO, GSPO, GDPO), and knowledge distillation (off-policy sequence distillation and on-policy reverse-KL distillation) yield measurable operational and economic gains, alongside failure modes in evaluation, reward specification, and numerical stability.
      </p>
    </div>

    <div class="prose">
      <h2>1. Motivation and Scope</h2>
      <p>
        Industrial post-training is warranted when routing requests to a general-purpose frontier API violates at least one operational constraint: (i) unit inference cost at scale, (ii) tail-latency requirements, (iii) VPC or on-premise data residency, or (iv) task accuracy ceilings caused by domain-specific conventions or version regressions across closed API updates. Conversely, open-ended, low-volume workflows with rapidly shifting specifications rarely justify weight adaptation.
      </p>
      <p>
        Across the ${caseStudies.length} documented engineering studies compiled here, adapted 2B–35B models report 5×–100× reductions in serving cost and 2×–30× reductions in latency relative to frontier baselines, while improving task-specific <em>F</em><sub>1</sub>, recall, or rubric compliance when trained against verified outcomes or calibrated domain rubrics.
      </p>
    </div>

    ${pipelineFigureSvg()}

    <div class="prose-wide">
      <h2>2. Method Selection by Operational Regime</h2>
      <div class="table-wrap">
        <table>
          <caption>Table 1. Mapping from task structure and supervision availability to post-training formulation.</caption>
          <thead>
            <tr>
              <th>Workload Regime</th>
              <th>Primary Formulation</th>
              <th>Typical Scale</th>
              <th>Supervision Signal</th>
              <th>Documented Examples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>High-volume single-turn classification, routing, or schema extraction</td>
              <td>Off-policy sequence distillation or domain SFT (LoRA / full)</td>
              <td>2B – 8B</td>
              <td>De-identified production labels or consensus teacher outputs</td>
              <td><a href="./case-studies/airbnb-2b-policy-classifier/">Airbnb (2B)</a>, <a href="./case-studies/marketplace-slms-booking-checkr-uber/">Checkr, Booking.com, Uber</a></td>
            </tr>
            <tr>
              <td>Long-context structured document generation (clinical, legal)</td>
              <td>Iterative SFT (iSFT)</td>
              <td>27B – 32B</td>
              <td>Frontier rubric evaluation + targeted draft repair</td>
              <td><a href="./case-studies/baseten-medical-scribes-isft/">Baseten Scribes</a>, <a href="./case-studies/harvey-legal-agent-suite/">Harvey Compaction</a></td>
            </tr>
            <tr>
              <td>Multi-turn search, coding, security, or risk subagents with objective outcomes</td>
              <td>Multi-turn RLVR (GRPO / DAPO / GSPO) &amp; specialist split</td>
              <td>1B – 32B, 35B-A3B</td>
              <td>Execution tests, retrieval <em>F</em><sub>1</sub>, confirmed outcomes</td>
              <td><a href="./case-studies/shopify-sidekick-task-experts/">Shopify Sidekick</a>, <a href="./case-studies/coinbase-fraud-agent/">Coinbase (9B)</a>, <a href="./case-studies/cisco-antares-security-slms/">Cisco Antares (1B–3B)</a></td>
            </tr>
            <tr>
              <td>Compression of a high-capacity open-weight teacher into a fast student</td>
              <td>On-Policy Distillation (OPD)</td>
              <td>4B – 32B student</td>
              <td>Per-token reverse KL against teacher log-probabilities</td>
              <td><a href="./case-studies/thinking-machines-bridgewater-opd/">Thinking Machines × Bridgewater</a></td>
            </tr>
            <tr>
              <td>High-frequency interactive product telemetry (&gt;10<sup>6</sup> events/day)</td>
              <td>Continuous online policy-gradient RL</td>
              <td>≤10B low-latency</td>
              <td>Implicit accept / reject / silence events</td>
              <td><a href="./case-studies/cursor-tab-online-rl/">Cursor Tab</a></td>
            </tr>
            <tr>
              <td>Unlabeled enterprise query logs with automated verifiers</td>
              <td>Test-time compute exploration + RL (TAO)</td>
              <td>8B – 70B</td>
              <td>SQL/code verifiers or calibrated reward model</td>
              <td><a href="./case-studies/databricks-tao/">Databricks TAO</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="prose">
      <h2>3. Chapters</h2>
      <ol>
        <li><a href="./sft/"><strong>Supervised Fine-Tuning and Iterative Refinement</strong></a> — Generalization boundaries, Iterative SFT (iSFT), LoRA rank and learning-rate scaling, Base-model delta grafting (<code>Shadow-FT</code>), and hallucination amplification on unfamiliar facts.</li>
        <li><a href="./rl/"><strong>Reinforcement Learning for Small and Midsize Models</strong></a> — Comparison of GRPO, DAPO, GSPO, CISPO, and GDPO; verifiable vs. rubric-based reward specification (<code>ProRubric</code>, <code>POW3R</code>, <code>Tournament-GRPO</code>, verbatim evidence schemas); and multi-turn numerical stability.</li>
        <li><a href="./distillation/"><strong>Knowledge Distillation</strong></a> — Exposure bias in off-policy distillation, sample efficiency of On-Policy Distillation (OPD), context-conditioned self-distillation (<code>SDFT</code>, <code>SDPO</code>, <code>RGSD</code>), and empirical OOD limitations.</li>
        <li><a href="./best-practices/"><strong>Experimental Protocol and Engineering Guidelines</strong></a> — Ten methodological practices covering harness state externalization, split hygiene, small-batch overfit smoke tests, token-ID preservation, and precision parity.</li>
        <li><a href="./post-training-guide/"><strong>Modern Post-Training Pipeline Guide (Labonne, 2026)</strong></a> — Distilled end-to-end guide covering stage ordering, <code>pass@k</code> vs. <code>pass@1</code> dynamics, length-normalized preference tuning, harness-native small-model RL, and Multi-Domain On-Policy Distillation (MOPD).</li>
        <li><a href="./company-blueprint/"><strong>Industrial Post-Training Sequence</strong></a> — Seven-stage organizational decision process synthesized from Shwartz Ziv (2026), including pre-training verification via in-context skill extraction.</li>
        <li><a href="./frameworks/"><strong>Frameworks and Compute Sizing</strong></a> — Comparative specification of 11 open-source and managed training stacks (<code>verl</code>, <code>SkyRL</code>, <code>PrimeRL</code>, <code>ART</code>, <code>Unsloth</code>, <code>TRL</code>, <code>Tinker</code>) and single- vs. multi-GPU memory profiles.</li>
        <li><a href="./references/"><strong>Annotated Bibliography</strong></a> — Filterable index of ${references.length} primary research papers, engineering postmortems, and open-source repositories.</li>
      </ol>
    </div>

    <div class="prose-wide">
      <h2>4. Summary of Empirical Industrial Studies</h2>
      <div class="table-wrap">
        <table>
          <caption>Table 2. Overview of ${caseStudies.length} documented post-training systems evaluated in this compendium. Select any study for full architectural specification, economic rationale, and methodological limitations.</caption>
          <thead>
            <tr>
              <th>System</th>
              <th>Domain</th>
              <th>Scale</th>
              <th>Method</th>
              <th>Primary Reported Outcome</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>${studyRows}</tbody>
        </table>
      </div>
    </div>
  `;

  return pageShell({
    title: 'Overview',
    description: 'Technical compendium on supervised fine-tuning, reinforcement learning, and distillation for small and midsize models.',
    activeNav: 'home',
    rootPrefix: './',
    bodyHtml
  });
}

function buildCaseStudiesIndex() {
  const rows = caseStudies
    .map((cs) => {
      const searchBlob = `${cs.title} ${cs.company} ${cs.industry} ${cs.baseModel} ${cs.methodLabel} ${cs.summary}`;
      return `<tr data-cs-row
                  data-methods="${escapeHtml(cs.methods.join(','))}"
                  data-tier="${escapeHtml(cs.businessValueTier)}"
                  data-size="${escapeHtml(cs.sizeCategory)}"
                  data-search="${escapeHtml(searchBlob)}">
        <td>
          <a href="./${cs.slug}/"><strong>${escapeHtml(cs.title)}</strong></a>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${escapeHtml(cs.company)} · ${escapeHtml(cs.industry)} (${escapeHtml(cs.year)})</div>
        </td>
        <td><code>${escapeHtml(cs.modelSize)}</code></td>
        <td>${escapeHtml(cs.methodLabel)}</td>
        <td>${escapeHtml(cs.summary)}</td>
        <td>${escapeHtml(cs.businessValueTier)}</td>
      </tr>`;
    })
    .join('');

  const bodyHtml = `
    <div class="prose">
      <h1>Empirical Industrial Case Studies</h1>
      <p class="doc-subtitle">Structured analyses of ${caseStudies.length} small and midsize post-training deployments and controlled domain benchmarks (2024–2026), examining model scale, supervision design, quantitative outcomes, and methodological limitations.</p>
    </div>

    <div class="filter-controls">
      <input id="cs-search" class="filter-search" type="search" placeholder="Filter by organization, base model, domain, or algorithm…">
      <div class="filter-line">
        <span class="filter-key">Method</span>
        <button class="filter-btn active" data-cs-filter="method" data-val="all" type="button">All</button>
        <button class="filter-btn" data-cs-filter="method" data-val="SFT" type="button">SFT / iSFT</button>
        <button class="filter-btn" data-cs-filter="method" data-val="RL" type="button">RL</button>
        <button class="filter-btn" data-cs-filter="method" data-val="Distillation" type="button">Distillation</button>
      </div>
      <div class="filter-line">
        <span class="filter-key">Evidence</span>
        <button class="filter-btn active" data-cs-filter="tier" data-val="all" type="button">All</button>
        <button class="filter-btn" data-cs-filter="tier" data-val="Deployment" type="button">Production Deployment</button>
        <button class="filter-btn" data-cs-filter="tier" data-val="Benchmark" type="button">Controlled Evaluation</button>
      </div>
      <div class="filter-line">
        <span class="filter-key">Scale</span>
        <button class="filter-btn active" data-cs-filter="size" data-val="all" type="button">All</button>
        <button class="filter-btn" data-cs-filter="size" data-val="Small (≤10B)" type="button">≤10B</button>
        <button class="filter-btn" data-cs-filter="size" data-val="Midsize (11B–35B)" type="button">11B–35B</button>
      </div>
    </div>

    <div id="cs-count" class="count-note"></div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:23%">Study</th>
            <th style="width:10%">Scale</th>
            <th style="width:19%">Formulation</th>
            <th>Summary of Findings</th>
            <th style="width:11%">Evidence</th>
          </tr>
        </thead>
        <tbody id="case-study-rows">${rows}</tbody>
      </table>
    </div>
  `;

  return pageShell({
    title: 'Case Studies',
    description: 'Empirical analyses of industrial post-training deployments and domain benchmarks.',
    activeNav: 'cases',
    rootPrefix: '../',
    bodyHtml
  });
}

function buildCaseStudyDetail(cs, idx) {
  const prev = idx > 0 ? caseStudies[idx - 1] : null;
  const next = idx < caseStudies.length - 1 ? caseStudies[idx + 1] : null;
  const metricsInline = cs.headlineMetrics
    .map((m) => `<strong>${escapeHtml(m.value)}</strong> (${escapeHtml(m.label)})`)
    .join('; ');

  const bodyHtml = `
    <div class="breadcrumb"><a href="../../">Overview</a> / <a href="../">Case Studies</a> / ${escapeHtml(cs.title)}</div>

    <article class="prose">
      <h1>${escapeHtml(cs.title)}</h1>
      <p class="doc-meta">${escapeHtml(cs.company)} · ${escapeHtml(cs.industry)} · ${escapeHtml(cs.year)} · Scale: ${escapeHtml(cs.modelSize)} · Evidence: ${escapeHtml(cs.businessValueTier)} (${escapeHtml(cs.businessValueTag)})</p>

      <div class="abstract">
        <div class="abstract-label">Summary</div>
        <p>${escapeHtml(cs.summary)}</p>
      </div>

      <h2>1. System and Training Specification</h2>
      <div class="table-wrap">
        <table>
          <tbody>
            <tr><th style="width:200px">Base Checkpoint &amp; Serving</th><td>${escapeHtml(cs.baseModel)} — ${escapeHtml(cs.technicalRecipe.architecture)}</td></tr>
            <tr><th>Optimization Formulation</th><td>${escapeHtml(cs.methodLabel)} (${escapeHtml(cs.methods.join(', '))})</td></tr>
            <tr><th>Training Infrastructure</th><td>${escapeHtml(cs.technicalRecipe.trainingStack)}</td></tr>
            <tr><th>Dataset &amp; Harness</th><td>${escapeHtml(cs.technicalRecipe.dataAndHarness)}</td></tr>
            <tr><th>Supervision / Reward</th><td>${escapeHtml(cs.technicalRecipe.rewardDesign)}</td></tr>
            <tr><th>Key Reported Metrics</th><td>${metricsInline}</td></tr>
          </tbody>
        </table>
      </div>

      <h2>2. Operational Setting</h2>
      <p>${escapeHtml(cs.problemContext)}</p>

      <h2>3. Economic and Deployment Rationale</h2>
      <p>${escapeHtml(cs.businessValueAnalysis)}</p>

      <h2>4. Quantitative Findings</h2>
      <ul>${cs.quantifiedResults.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>

      <h2>5. Methodological Takeaways</h2>
      <ul>${cs.keyLearnings.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>

      <h2>6. Limitations and Confounds</h2>
      <ul>${cs.watchouts.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>

      <h2>References</h2>
      <ol>
        ${cs.links
          .map((l) => `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a></li>`)
          .join('')}
      </ol>
    </article>

    <nav class="pager" aria-label="Case study pagination">
      ${prev ? `<a href="../${prev.slug}/">← ${escapeHtml(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a href="../${next.slug}/">${escapeHtml(next.title)} →</a>` : ''}
    </nav>
  `;

  return pageShell({
    title: cs.title,
    description: cs.summary,
    activeNav: `cs:${cs.slug}`,
    rootPrefix: '../../',
    bodyHtml
  });
}

function buildMarkdownPage({ mdFile, activeNav, title, description }) {
  const raw = fs.readFileSync(path.join(ROOT, 'docs', mdFile), 'utf8');
  const { html, toc } = renderMarkdown(raw);

  const tocBlock = toc.length
    ? `<nav class="inline-toc" aria-label="Table of contents">
         <div class="inline-toc-label">Contents</div>
         <ol>${toc.map((t) => `<li><a href="#${t.id}">${escapeHtml(t.text.replace(/^\d+\.\s*/, ''))}</a></li>`).join('')}</ol>
       </nav>`
    : '';

  // Insert inline TOC after the first <hr> (or after first paragraph if no <hr>)
  let finalHtml = html;
  if (tocBlock) {
    if (finalHtml.includes('<hr>')) {
      finalHtml = finalHtml.replace('<hr>', tocBlock);
    } else {
      finalHtml = `${tocBlock}\n${finalHtml}`;
    }
  }

  return pageShell({
    title,
    description,
    activeNav,
    rootPrefix: '../',
    bodyHtml: `<article class="prose">${finalHtml}</article>`
  });
}

function buildBlogIndex() {
  return pageShell({
    title: 'Blog',
    description: 'Experiments and practical notes on post-training.',
    activeNav: 'blog',
    rootPrefix: '../',
    bodyHtml: `<section class="prose">
      <h1>Blog</h1>
      <article>
        <h2><a href="../${toolAlpacaPost.path}">${escapeHtml(toolAlpacaPost.title)}</a></h2>
        <p class="doc-meta"><time datetime="${toolAlpacaPost.date}">November 27, 2026</time> · Sten Rüdiger</p>
        <p>${escapeHtml(toolAlpacaPost.description)}</p>
      </article>
    </section>`
  });
}

function buildToolAlpacaPost() {
  const { html } = renderMarkdown(fs.readFileSync(path.join(ROOT, 'docs/toolalpaca-accuracy-retention.md'), 'utf8'));
  return pageShell({
    ...toolAlpacaPost,
    activeNav: 'blog',
    rootPrefix: '../../',
    bodyHtml: `<article class="prose-wide">
      <h1>${escapeHtml(toolAlpacaPost.title)}</h1>
      <p class="doc-subtitle">${escapeHtml(toolAlpacaPost.description)}</p>
      <p class="doc-meta"><time datetime="${toolAlpacaPost.date}">November 27, 2026</time> · Sten Rüdiger</p>
      <iframe class="blog-chart" src="explorer.html" title="Interactive ToolAlpaca accuracy and retention chart" scrolling="no"></iframe>
      <p><a href="explorer.html">Open the full-width chart</a></p>
      <div class="prose">${html}</div>
    </article>`
  });
}

function buildFrameworksPage() {
  const fwRows = frameworksData.frameworks
    .map(
      (fw) => `<tr>
        <td><a href="${escapeHtml(fw.url)}" target="_blank" rel="noopener"><strong>${escapeHtml(fw.name)}</strong></a><br><a href="${escapeHtml(fw.docsUrl)}" target="_blank" rel="noopener" style="font-size:0.74rem;color:var(--text-muted)">Documentation</a></td>
        <td>${escapeHtml(fw.bestFor)}</td>
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
        <td><strong>${escapeHtml(hw.tier)}</strong><br><span style="font-size:0.75rem;color:var(--text-muted)">${escapeHtml(hw.models)}</span></td>
        <td>${escapeHtml(hw.sftHardware)}</td>
        <td>${escapeHtml(hw.rlHardware)}</td>
        <td>${escapeHtml(hw.servingProfile)}</td>
        <td><code>${escapeHtml(hw.typicalBudget)}</code></td>
      </tr>`
    )
    .join('');

  const bodyHtml = `
    <div class="prose">
      <h1>Post-Training Frameworks and Compute Profiles</h1>
      <p class="doc-subtitle">Comparative specification of open-source and managed post-training libraries supporting multi-turn rollouts, rubric evaluation, and on-policy distillation, alongside GPU memory sizing for 1.5B–35B models.</p>
    </div>

    <div class="prose-wide">
      <h2>1. Framework Specification</h2>
      <div class="table-wrap">
        <table>
          <caption>Table 1. Capabilities and hardware profiles of contemporary LLM post-training frameworks.</caption>
          <thead>
            <tr>
              <th>Framework</th>
              <th>Primary Design Scope</th>
              <th>Policy Estimators</th>
              <th>Distillation</th>
              <th>Multi-Turn Support</th>
              <th>Hardware &amp; Execution</th>
            </tr>
          </thead>
          <tbody>${fwRows}</tbody>
        </table>
      </div>

      <h2>2. Hardware and Memory Sizing by Parameter Scale</h2>
      <p class="prose">Memory consumption scales with sequence length, adapter vs. full-parameter optimizer states, rollout group size <em>G</em>, and kernel fusion. Blockwise logit-and-loss kernels—such as Unsloth's chunked GRPO kernels and Liger-Kernel (<code>use_liger_kernel=True</code> in TRL)—avoid materializing full batch × sequence × vocabulary logit tensors during backpropagation.</p>
      <div class="table-wrap">
        <table>
          <caption>Table 2. Representative GPU configurations and experimental compute budgets across model tiers.</caption>
          <thead>
            <tr>
              <th>Parameter Tier</th>
              <th>SFT / iSFT Configuration</th>
              <th>RL / OPD Configuration</th>
              <th>Inference Characteristics</th>
              <th>Typical Compute Cost</th>
            </tr>
          </thead>
          <tbody>${hwRows}</tbody>
        </table>
      </div>
    </div>
  `;

  return pageShell({
    title: 'Frameworks & Compute',
    description: 'Comparative specification of post-training frameworks and GPU memory sizing.',
    activeNav: 'frameworks',
    rootPrefix: '../',
    bodyHtml
  });
}

function buildReferencesPage() {
  const pillars = ['Industry Case Study', 'SFT', 'RL', 'Distillation', 'Evals & Rewards', 'Frameworks & Infra', 'Continual Learning & Memory'];
  const types = ['Paper', 'Blog / Case Study', 'Repo / Tool', 'Video / Talk'];

  const refItemsHtml = references
    .map((r) => {
      const searchBlob = `${r.title} ${r.pillar} ${r.type} ${r.year} ${r.takeaway}`;
      const internalNote = r.internalUrl
        ? ` · <a href="../${escapeHtml(r.internalUrl)}">Compendium note →</a>`
        : '';
      return `
      <li class="bib-entry"
          data-ref-item
          data-pillar="${escapeHtml(r.pillar)}"
          data-type="${escapeHtml(r.type)}"
          data-search="${escapeHtml(searchBlob)}">
        <div class="bib-head">
          <a class="bib-title" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a>
          <span class="bib-meta">${r.year} · ${escapeHtml(r.type)}</span>
        </div>
        <p class="bib-note">${escapeHtml(r.takeaway)}</p>
        <div class="bib-tags">${escapeHtml(r.pillar)}${internalNote}</div>
      </li>`;
    })
    .join('');

  const bodyHtml = `
    <div class="prose">
      <h1>Annotated Bibliography</h1>
      <p class="doc-subtitle">Primary research literature, industrial engineering reports, and open-source software referenced across this compendium (${references.length} entries, 2023–2026).</p>
    </div>

    <div class="filter-controls">
      <input id="ref-search" class="filter-search" type="search" placeholder="Search by title, topic, model, or method (e.g., GRPO, ProRubric, OPD, LoRA)…">
      <div class="filter-line">
        <span class="filter-key">Topic</span>
        <button class="filter-btn active" data-ref-filter="pillar" data-val="all" type="button">All</button>
        ${pillars.map((p) => `<button class="filter-btn" data-ref-filter="pillar" data-val="${escapeHtml(p)}" type="button">${escapeHtml(p)}</button>`).join('')}
      </div>
      <div class="filter-line">
        <span class="filter-key">Format</span>
        <button class="filter-btn active" data-ref-filter="type" data-val="all" type="button">All</button>
        ${types.map((t) => `<button class="filter-btn" data-ref-filter="type" data-val="${escapeHtml(t)}" type="button">${escapeHtml(t)}</button>`).join('')}
      </div>
    </div>

    <div id="ref-count" class="count-note"></div>
    <ul id="ref-list" class="bib-list">${refItemsHtml}</ul>
  `;

  return pageShell({
    title: 'Bibliography',
    description: 'Annotated bibliography of post-training research papers, engineering reports, and repositories.',
    activeNav: 'refs',
    rootPrefix: '../',
    bodyHtml
  });
}

function buildSearchIndex() {
  const index = [
    { title: 'Overview — Post-Training of Small and Midsize Models', category: 'Compendium', url: '', excerpt: 'Abstract, economic motivation, regime mapping, and summary of 15 empirical studies.', external: false },
    { title: toolAlpacaPost.title, category: 'Blog', url: toolAlpacaPost.path, excerpt: toolAlpacaPost.description, external: false },
    { title: 'Supervised Fine-Tuning and Iterative Refinement', category: 'Chapter', url: 'sft/', excerpt: 'Generalization properties, Iterative SFT (iSFT), LoRA scaling, Shadow-FT, and hallucination amplification.', external: false },
    { title: 'Reinforcement Learning for Small and Midsize Models', category: 'Chapter', url: 'rl/', excerpt: 'GRPO, DAPO, GSPO, CISPO, GDPO; RLVR vs. rubric rewards (ProRubric, POW3R, Tournament-GRPO); numerical stability.', external: false },
    { title: 'Knowledge Distillation: Off-Policy, On-Policy, and Self-Distillation', category: 'Chapter', url: 'distillation/', excerpt: 'Exposure bias, On-Policy Distillation (OPD), SDFT/SDPO/RGSD, late-2026 OOD caveats, and Together AI cross-family off-policy distillation (Kimi-K3.1-Pro to Qwen3.8-27B, retention mixing).', external: false },
    { title: 'Experimental Protocol and Engineering Guidelines', category: 'Chapter', url: 'best-practices/', excerpt: 'Harness externalization, evaluation hygiene, overfit smoke tests, token-ID preservation, and precision parity.', external: false },
    { title: 'Modern Post-Training Pipeline Guide (Maxime Labonne, 2026)', category: 'Chapter', url: 'post-training-guide/', excerpt: 'SFT to RLVR to MOPD stage ordering, pass@k vs. pass@1 intuition, length-normalized DPO, harness-native small models, and style drift.', external: false },
    { title: 'Industrial Post-Training Sequence (Shwartz Ziv, 2026)', category: 'Chapter', url: 'company-blueprint/', excerpt: 'Seven-stage organizational sequence, pre-training in-context skill verification, and ~30B single-GPU LoRA baseline.', external: false },
    { title: 'Post-Training Frameworks and Compute Profiles', category: 'Reference', url: 'frameworks/', excerpt: 'verl, SkyRL, PrimeRL, OpenPipe ART, Unsloth, HF TRL, Tinker, Rocket, and GPU memory tables.', external: false },
    { title: 'Annotated Bibliography', category: 'Reference', url: 'references/', excerpt: 'Searchable bibliography of papers, engineering reports, and repositories.', external: false }
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
      excerpt: `${fw.rlAlgorithms} — ${fw.bestFor}`,
      external: false
    });
  }

  for (const ref of references) {
    index.push({
      title: ref.title,
      category: `${ref.pillar} (${ref.year})`,
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

fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(PUBLIC_DIR, 'assets'), { recursive: true });

fs.copyFileSync(path.join(ROOT, 'src/styles.css'), path.join(PUBLIC_DIR, 'assets/styles.css'));
fs.copyFileSync(path.join(ROOT, 'src/app.js'), path.join(PUBLIC_DIR, 'assets/app.js'));

writeOut('index.html', buildHomePage());
writeOut('blog/index.html', buildBlogIndex());
writeOut(`${toolAlpacaPost.path}index.html`, buildToolAlpacaPost());
writeOut(`${toolAlpacaPost.path}explorer.html`, fs.readFileSync(path.join(ROOT, 'src/blog/toolalpaca-explorer.html'), 'utf8'));
writeOut('case-studies/index.html', buildCaseStudiesIndex());
caseStudies.forEach((cs, idx) => {
  writeOut(`case-studies/${cs.slug}/index.html`, buildCaseStudyDetail(cs, idx));
});

writeOut(
  'sft/index.html',
  buildMarkdownPage({
    mdFile: 'sft.md',
    activeNav: 'sft',
    title: 'Supervised Fine-Tuning and Iterative Refinement',
    description: 'Supervised fine-tuning, Iterative SFT, LoRA scaling, Base+merge grafting, and hallucination control.'
  })
);
writeOut(
  'rl/index.html',
  buildMarkdownPage({
    mdFile: 'rl.md',
    activeNav: 'rl',
    title: 'Reinforcement Learning',
    description: 'Policy-gradient estimators (GRPO, DAPO, GSPO, GDPO), rubric verification, and multi-turn numerical stability.'
  })
);
writeOut(
  'distillation/index.html',
  buildMarkdownPage({
    mdFile: 'distillation.md',
    activeNav: 'distill',
    title: 'Knowledge Distillation',
    description: 'Off-policy sequence distillation, On-Policy Distillation (OPD), context-conditioned self-distillation, and OOD caveats.'
  })
);
writeOut(
  'best-practices/index.html',
  buildMarkdownPage({
    mdFile: 'best-practices.md',
    activeNav: 'playbook',
    title: 'Experimental Protocol and Guidelines',
    description: 'Ten methodological guidelines for industrial post-training of small and midsize models.'
  })
);
writeOut(
  'post-training-guide/index.html',
  buildMarkdownPage({
    mdFile: 'labonne-guide.md',
    activeNav: 'guide',
    title: 'Modern Post-Training Pipeline Guide (Labonne, 2026)',
    description: 'Distilled post-training guide from Maxime Labonne (The Information Bottleneck, Nov 2026) and Liquid AI LFM2: SFT, length-normalized DPO, RLVR, pass@k vs pass@1, and MOPD.'
  })
);
writeOut(
  'company-blueprint/index.html',
  buildMarkdownPage({
    mdFile: 'company-blueprint.md',
    activeNav: 'blueprint',
    title: 'Industrial Post-Training Sequence (Shwartz Ziv, 2026)',
    description: 'Seven-stage sequence for organizational model adaptation after Ravid Shwartz Ziv (2026).'
  })
);

writeOut('frameworks/index.html', buildFrameworksPage());
writeOut('references/index.html', buildReferencesPage());
writeOut('search-index.json', JSON.stringify(buildSearchIndex(), null, 2));
writeOut('.nojekyll', '');

writeOut(
  '404.html',
  pageShell({
    title: '404 Not Found',
    description: 'Page not found',
    activeNav: '',
    rootPrefix: './',
    bodyHtml: `<div class="prose"><h1>404 — Page Not Found</h1><p>Return to the <a href="./">compendium overview</a> or press <code>/</code> to search.</p></div>`
  })
);

console.log(`Built minimalist scientific compendium to ${PUBLIC_DIR}:`);
console.log(`  - ${caseStudies.length} technical case notes`);
console.log(`  - 5 chapters (SFT, RL, Distillation, Protocol, Industrial Sequence)`);
console.log(`  - Frameworks specification (${frameworksData.frameworks.length} frameworks)`);
console.log(`  - Annotated bibliography (${references.length} entries)`);
