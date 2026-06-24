const API_URL = import.meta.env.VITE_API_URL;

const submitBtn = document.getElementById("submitBtn");
const clearBtn = document.getElementById("clearBtn");
const textarea = document.getElementById("nodeInput");
const errorBox = document.getElementById("errorBox");
const output = document.getElementById("output");

clearBtn.addEventListener("click", () => {
  textarea.value = "";
  errorBox.style.display = "none";
  output.style.display = "none";
  output.innerHTML = "";
});

submitBtn.addEventListener("click", async () => {
  const raw = textarea.value.trim();
  if (!raw) return;
  const data = raw
    .split(/[\n,]+/)
    .map(s => s.trim().replace(/^["']|["']$/g, ""))
    .filter(s => s.length > 0);

  errorBox.style.display = "none";
  output.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>Analyzing...';

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const json = await res.json();
    renderOutput(json);
    output.style.display = "block";
  } catch (err) {
    errorBox.textContent = `Request failed: ${err.message}. Make sure the API is running and CORS is enabled.`;
    errorBox.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Analyze";
  }
});

function renderOutput(d) {
  output.innerHTML = `
    ${identitySection(d)}
    ${summarySection(d.summary)}
    ${hierarchiesSection(d.hierarchies)}
    ${tagsSection("Invalid Entries", d.invalid_entries, "tag-invalid")}
    ${tagsSection("Duplicate Edges", d.duplicate_edges, "tag-dup")}
  `;
}

function identitySection(d) {
  return `
    <div class="card">
      <div class="section-title">Identity</div>
      <div class="identity-grid">
        <div class="id-field"><div class="key">User ID</div><div class="val">${esc(d.user_id)}</div></div>
        <div class="id-field"><div class="key">Email</div><div class="val">${esc(d.email_id)}</div></div>
        <div class="id-field"><div class="key">Roll Number</div><div class="val">${esc(d.college_roll_number)}</div></div>
      </div>
    </div>`;
}

function summarySection(s) {
  return `
    <div class="card">
      <div class="section-title">Summary</div>
      <div class="summary-grid">
        <div class="stat-box">
          <div class="num">${s.total_trees}</div>
          <div class="lbl">Trees</div>
        </div>
        <div class="stat-box">
          <div class="num">${s.total_cycles}</div>
          <div class="lbl">Cycles</div>
        </div>
        <div class="stat-box">
          <div class="num">${esc(s.largest_tree_root) || '—'}</div>
          <div class="lbl">Largest Tree Root</div>
        </div>
      </div>
    </div>`;
}

function hierarchiesSection(hierarchies) {
  if (!hierarchies || hierarchies.length === 0) return "";
  const items = hierarchies.map(h => {
    const isCycle = h.has_cycle === true;
    return `
      <div class="h-card">
        <div class="h-header">
          <div class="h-root">${esc(h.root)}</div>
          <span class="badge ${isCycle ? 'badge-cycle' : 'badge-tree'}">${isCycle ? 'CYCLE' : 'TREE'}</span>
          ${!isCycle ? `<div class="h-depth">depth ${h.depth}</div>` : ''}
        </div>
        <div class="h-body">
          ${isCycle
            ? `<div class="cycle-msg">⚠ Cycle detected — no tree structure available.</div>`
            : `<div class="tree-visual">${renderTree(h.tree, h.root)}</div>`
          }
        </div>
      </div>`;
  }).join("");

  return `
    <div class="card">
      <div class="section-title">Hierarchies (${hierarchies.length})</div>
      <div class="hierarchy-list">${items}</div>
    </div>`;
}

function renderTree(treeObj, root) {
  const lines = [];

  function walk(node, children, prefix, isLast) {
    const connector = isLast ? "└── " : "├── ";
    lines.push(prefix + connector + node);
    const childKeys = Object.keys(children);
    childKeys.forEach((child, i) => {
      const childIsLast = i === childKeys.length - 1;
      const newPrefix = prefix + (isLast ? "    " : "│   ");
      walk(child, children[child], newPrefix, childIsLast);
    });
  }

  if (!treeObj || Object.keys(treeObj).length === 0) return "(empty)";

  const rootChildren = treeObj[root] || {};
  lines.push(root);
  const childKeys = Object.keys(rootChildren);
  childKeys.forEach((child, i) => {
    const isLast = i === childKeys.length - 1;
    walk(child, rootChildren[child], "", isLast);
  });

  return esc(lines.join("\n"));
}

function tagsSection(title, items, tagClass) {
  if (!items) return "";
  return `
    <div class="card">
      <div class="section-title">${title}</div>
      <div class="tag-list">
        ${items.length === 0
          ? `<span class="tag-empty">None</span>`
          : items.map(e => `<span class="tag ${tagClass}">${esc(e)}</span>`).join("")
        }
      </div>
    </div>`;
}

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
