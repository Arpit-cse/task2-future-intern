
const $ = (id) => document.getElementById(id);

let leads = [];
let activeFilter = "all";

const loginScreen = $("loginScreen");
const app = $("app");
const leadModal = $("leadModal");
const leadForm = $("leadForm");

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

function showLogin() {
  app.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  $("loginMessage").textContent = "";
}

function showApp() {
  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");
}

function notify(message, isError = false) {
  const notice = $("notice");
  notice.textContent = message;
  notice.classList.remove("hidden", "error");

  if (isError) notice.classList.add("error");

  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => {
    notice.classList.add("hidden");
  }, 4000);
}

// Escape user-provided text before placing it in HTML.
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(date) {
  if (!date) return "Not scheduled";

  const parts = date.split("-");
  if (parts.length !== 3) return escapeHTML(date);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function statusLabel(status) {
  return {
    new: "New",
    contacted: "Contacted",
    converted: "Converted"
  }[status] || "New";
}

// Login
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  $("loginMessage").textContent = "Signing in...";

  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("username").value.trim(),
        password: $("password").value
      })
    });

    $("password").value = "";
    showApp();
    await loadLeads();
  } catch (error) {
    $("loginMessage").textContent = error.message;
  }
});

// Logout
$("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (error) {
    console.error(error);
  }

  leads = [];
  showLogin();
});

// Load leads from the backend
async function loadLeads() {
  try {
    leads = await api("/api/leads");
    showApp();
    renderLeads();
  } catch (error) {
    if (!error.message.includes("log in")) {
      notify(error.message, true);
    }
  }
}

// Dashboard counters
function renderStats() {
  $("totalCount").textContent = leads.length;
  $("newCount").textContent =
    leads.filter(lead => lead.status === "new").length;
  $("contactedCount").textContent =
    leads.filter(lead => lead.status === "contacted").length;
  $("convertedCount").textContent =
    leads.filter(lead => lead.status === "converted").length;
}

// Search and filter
function getFilteredLeads() {
  const query = $("searchInput").value.trim().toLowerCase();
  const filter = $("statusFilter").value;

  return leads.filter(lead => {
    const matchesQuery = [
      lead.name, lead.email, lead.source, lead.notes
    ].some(value => String(value || "").toLowerCase().includes(query));

    const matchesStatus = filter === "all" || lead.status === filter;
    return matchesQuery && matchesStatus;
  });
}

function renderLeads() {
  renderStats();

  const filtered = getFilteredLeads();
  const table = $("leadsTable");

  $("leadCountLabel").textContent =
    `${filtered.length} of ${leads.length} lead(s)`;

  if (!filtered.length) {
    table.innerHTML = `
      <tr><td colspan="5" class="empty">
        No leads found. Add a new lead to get started.
      </td></tr>`;
    return;
  }

  table.innerHTML = filtered.map(lead => `
    <tr>
      <td>
        <div class="client-name">${escapeHTML(lead.name)}</div>
        <div class="client-email">${escapeHTML(lead.email)}</div>
        ${lead.notes
          ? `<div class="client-email" title="${escapeHTML(lead.notes)}">📝 Notes added</div>`
          : ""}
      </td>
      <td><span class="source-tag">${escapeHTML(lead.source)}</span></td>
      <td>
        <select class="status ${escapeHTML(lead.status)}"
                data-action="status" data-id="${escapeHTML(lead.id)}"
                aria-label="Change status for ${escapeHTML(lead.name)}">
          <option value="new" ${lead.status === "new" ? "selected" : ""}>New</option>
          <option value="contacted" ${lead.status === "contacted" ? "selected" : ""}>Contacted</option>
          <option value="converted" ${lead.status === "converted" ? "selected" : ""}>Converted</option>
        </select>
      </td>
      <td>${escapeHTML(formatDate(lead.followUp))}</td>
      <td>
        <div class="row-actions">
          <button class="action-btn" data-action="edit"
                  data-id="${escapeHTML(lead.id)}" aria-label="Edit lead">✎ Edit</button>
          <button class="action-btn delete" data-action="delete"
                  data-id="${escapeHTML(lead.id)}" aria-label="Delete lead">✕</button>
        </div>
      </td>
    </tr>
  `).join("");
}

$("searchInput").addEventListener("input", renderLeads);
$("statusFilter").addEventListener("change", renderLeads);

// Sidebar filters
document.querySelectorAll("[data-filter]").forEach(link => {
  link.addEventListener("click", () => {
    $("statusFilter").value = link.dataset.filter;
    renderLeads();
    $("sidebar").classList.remove("open");
  });
});

// Open the lead form
function openModal(lead = null) {
  leadForm.reset();
  $("formMessage").textContent = "";
  $("leadId").value = lead?.id || "";
  $("modalTitle").textContent = lead ? "Edit Lead" : "Add New Lead";
  $("saveLeadBtn").textContent = lead ? "Update Lead" : "Save Lead";

  if (lead) {
    $("leadName").value = lead.name;
    $("leadEmail").value = lead.email;
    $("leadSource").value = lead.source;
    $("leadStatus").value = lead.status;
    $("leadFollowUp").value = lead.followUp || "";
    $("leadNotes").value = lead.notes || "";
  } else {
    $("leadStatus").value = "new";
  }

  leadModal.classList.remove("hidden");
  $("leadName").focus();
}

function closeModal() {
  leadModal.classList.add("hidden");
}

$("addLeadBtn").addEventListener("click", () => openModal());
$("closeModalBtn").addEventListener("click", closeModal);
$("cancelBtn").addEventListener("click", closeModal);

leadModal.addEventListener("click", (event) => {
  if (event.target === leadModal) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

// Create or update a lead
leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const id = $("leadId").value;

  const payload = {
    name: $("leadName").value.trim(),
    email: $("leadEmail").value.trim(),
    source: $("leadSource").value,
    status: $("leadStatus").value,
    followUp: $("leadFollowUp").value,
    notes: $("leadNotes").value.trim()
  };

  $("saveLeadBtn").disabled = true;
  $("formMessage").textContent = "Saving...";

  try {
    await api(id ? `/api/leads/${encodeURIComponent(id)}` : "/api/leads", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });

    closeModal();
    await loadLeads();
    notify(id ? "Lead updated successfully." : "Lead added successfully.");
  } catch (error) {
    $("formMessage").textContent = error.message;
  } finally {
    $("saveLeadBtn").disabled = false;
  }
});

// Handle row actions and inline status updates
$("leadsTable").addEventListener("change", async (event) => {
  const control = event.target;

  if (control.dataset.action !== "status") return;

  const lead = leads.find(item => item.id === control.dataset.id);
  if (!lead) return;

  const previousStatus = lead.status;
  const updated = { ...lead, status: control.value };

  try {
    await api(`/api/leads/${encodeURIComponent(lead.id)}`, {
      method: "PUT",
      body: JSON.stringify(updated)
    });

    await loadLeads();
    notify("Lead status updated.");
  } catch (error) {
    control.value = previousStatus;
    notify(error.message, true);
  }
});

$("leadsTable").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const lead = leads.find(item => item.id === button.dataset.id);
  if (!lead) return;

  if (button.dataset.action === "edit") {
    openModal(lead);
    return;
  }

  if (button.dataset.action === "delete") {
    if (!confirm(`Delete the lead for ${lead.name}? This cannot be undone.`)) {
      return;
    }

    try {
      await api(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: "DELETE"
      });

      await loadLeads();
      notify("Lead deleted successfully.");
    } catch (error) {
      notify(error.message, true);
    }
  }
});

// Export visible leads to CSV
$("exportBtn").addEventListener("click", () => {
  const rows = getFilteredLeads();

  if (!rows.length) {
    notify("There are no leads to export.", true);
    return;
  }

  const columns = [
    "Name", "Email", "Source", "Status",
    "Follow-up Date", "Notes", "Created At"
  ];

  const csvCell = value => {
    let text = String(value ?? "");

    // Prevent spreadsheet formula injection.
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;

    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [
    columns.map(csvCell).join(","),
    ...rows.map(lead => [
      lead.name,
      lead.email,
      lead.source,
      statusLabel(lead.status),
      lead.followUp,
      lead.notes,
      lead.createdAt
    ].map(csvCell).join(","))
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "client-leads.csv";
  anchor.click();
  URL.revokeObjectURL(url);
});

// Mobile sidebar
$("sidebarToggle").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

// Check whether the existing session is valid on page load.
(async function init() {
  try {
    await loadLeads();
  } catch (error) {
    showLogin();
  }
})();
