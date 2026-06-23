const state = {
  sites: [],
  site: null,
  search: "",
  tab: "summary",
  selectedDomainKey: null,
  focusDomain: null,
  focusRisk: null,
  flaggedRiskIds: [],
  summaryRiskView: "grid",
  fullRiskView: "grid",
  riskNotes: {},
  activeNoteRiskId: null,
  previousView: null,
  editingSiteVerdictId: null,
  editedSiteVerdict: {},
  editedVerdictStatus: {}, // tracks "suggested" or "edited"
  editingCategorySummaryId: null,
  editedCategorySummaries: {},
  temperatureProfileHidden: {}, // tracks hidden state by domain key
};

const elements = {
  toast: document.querySelector("#appToast"),
  title: document.querySelector("#pageTitle"),
  subhead: document.querySelector("#siteSubhead"),
  statusPill: document.querySelector("#statusPill"),
  searchInput: document.querySelector("#searchInput"),
  exportButton: document.querySelector("#exportButton"),
  summaryPanel: document.querySelector("#summaryPanel"),
  fullPanel: document.querySelector("#fullPanel"),
  mapPanel: document.querySelector("#mapPanel"),
  tabs: [...document.querySelectorAll(".tab-button")],
  riskTemplate: document.querySelector("#riskCardTemplate"),
};

let toastTimer = null;

boot();

async function boot() {
  const sites =
    window.__SITE_FIXTURE__ ||
    (await fetch("./data/sites.json").then((response) => response.json()));
  state.sites = sites;

  const params = new URLSearchParams(window.location.search);
  const siteId = params.get("site");
  state.site =
    sites.find((site) => site.id === siteId || slugify(site.name) === siteId) ||
    sites.find((site) => site.name === "Dema - Helis") ||
    sites[0];

  bindEvents();
  render();
}

function bindEvents() {
  elements.tabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      if (state.tab !== "full") {
        state.focusDomain = null;
        state.focusRisk = null;
      }
      render();
    });
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });

  elements.exportButton.addEventListener("click", () => {
    if (!state.site) {
      return;
    }
    const blob = new Blob([JSON.stringify(state.site, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(state.site.name)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function render() {
  const normalized = normalizeSite(state.site);
  renderHeader(normalized);
  renderTabs();
  renderSummary(normalized);
  renderFull(normalized);
  renderMap(normalized);
  renderReturnButton();
  highlightTarget();
}

function renderHeader(site) {
  elements.title.textContent = `Site Evaluation for: ${site.name}`;
  elements.statusPill.textContent = site.statusLabel;
  elements.subhead.textContent = "";
  elements.subhead.classList.add("hidden");
}

function renderTabs() {
  elements.tabs.forEach((button) => {
    const active = button.dataset.tab === state.tab;
    button.classList.toggle("active", active);
  });
  elements.summaryPanel.classList.toggle("hidden", state.tab !== "summary");
  elements.fullPanel.classList.toggle("hidden", state.tab !== "full");
  elements.mapPanel.classList.toggle("hidden", state.tab !== "map");
}

function renderSummary(site) {
  const risks = getSummaryRisks(site).filter((risk) => matchesSearch(risk.searchText));
  const riskMarkup =
    risks.length > 0
      ? risks
          .map((risk) => {
            const fragment = elements.riskTemplate.content.cloneNode(true);
            const card = fragment.querySelector(".risk-card");
            const category = fragment.querySelector(".category-chip");
            const severity = fragment.querySelector(".severity-badge");
            const certainty = fragment.querySelector(".certainty-badge");
            const title = fragment.querySelector(".risk-title");
            const text = fragment.querySelector(".risk-text");
            const source = fragment.querySelector(".source-link");
            const evidence = fragment.querySelector(".evidence-link");
            const flagButton = fragment.querySelector("[data-flag-risk]");
            const noteButton = fragment.querySelector("[data-note-risk]");

            category.outerHTML = renderSummaryCategoryChip(risk);
            severity.textContent = risk.severity;
            severity.classList.add(risk.severity.toLowerCase());
            certainty.textContent = `${risk.certainty}%`;
            title.textContent = risk.statement || risk.title;
            title.setAttribute("title", risk.title !== risk.statement ? `Technical: ${risk.title}` : "");
            text.textContent = risk.summary;
            source.textContent = `Sources (${risk.sources.length})`;
            source.href = risk.sources[0]?.url || "#";
            if (!risk.sources.length) {
              source.removeAttribute("href");
            }
            flagButton.dataset.flagRisk = risk.id;
            flagButton.innerHTML = renderFlagIcon();
            flagButton.classList.toggle("is-active", isFlaggedRisk(risk.id));
            const note = getRiskNote(risk.id);
            noteButton.dataset.noteRisk = risk.id;
            noteButton.innerHTML = renderNoteIcon();
            noteButton.classList.toggle("has-note", Boolean(note));
            noteButton.classList.toggle("is-open", state.activeNoteRiskId === risk.id);
            if (note) {
              noteButton.setAttribute("data-note-content", note);
            }

            const moreBtn = fragment.querySelector(".more-button");
            const editBtn = fragment.querySelector("[data-edit-risk]");
            const deleteBtn = fragment.querySelector("[data-delete-risk]");
            if (moreBtn) moreBtn.dataset.moreMenu = risk.id;
            if (editBtn) editBtn.dataset.editRisk = risk.id;
            if (deleteBtn) deleteBtn.dataset.deleteRisk = risk.id;

            card.dataset.domain = risk.domainKey;
            card.dataset.riskId = risk.id;
            if (state.activeNoteRiskId === risk.id) {
              const actions = fragment.querySelector(".risk-card-actions");
              actions.insertAdjacentHTML("beforeend", renderNotePopover(risk.id));
            }
            return card.outerHTML;
          })
          .join("")
      : '<div class="empty-state">No risks match the current search.</div>';

  elements.summaryPanel.innerHTML = `
    <div class="summary-grid">
      <section class="executive-wrap">
        <div class="map-thumb">
          ${renderPolygonSvg(site.polygon)}
        </div>
        <div class="executive-copy">
          <h2>Executive Summary</h2>
          <div class="executive-stats">
            <div>
              <span class="stat-label">Size</span>
              <span class="stat-value">${site.acresLabel}</span>
            </div>
            <div>
              <span class="stat-label">Location</span>
              <span class="stat-value">${site.locationLabel}</span>
            </div>
          </div>
          <div class="verdict-section">
            <div class="verdict-row">
              <span class="stat-label">Evaluation Verdict</span>
              <button class="verdict-chip-button" type="button" data-edit-verdict aria-label="Edit verdict">
                <span class="verdict-chip">
                  ${state.editedVerdictStatus[site.id] === "edited" ? "Edited by User" : "Suggested by AI"}
                </span>
                <span class="verdict-edit-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M3 17.25V21h3.75L17.81 9.94m-4.88-4.88L19.93 2.05a2.121 2.121 0 013 3L15.93 12.07m-4.88-4.88l1.41-1.41a2.121 2.121 0 013 0l4.88 4.88a2.121 2.121 0 010 3l-1.41 1.41m-2.12-2.12L9.05 9.05"/>
                  </svg>
                </span>
              </button>
              ${
                state.editedVerdictStatus[site.id] === "edited"
                  ? `<button class="revert-verdict-button" type="button" data-revert-verdict="${site.id}" aria-label="Revert to suggested version">Revert</button>`
                  : ""
              }
            </div>
            ${
              state.editingSiteVerdictId === site.id
                ? `
              <div class="verdict-editor" data-verdict-editor="${site.id}">
                <textarea class="verdict-textarea" rows="4" placeholder="Enter site evaluation verdict...">${escapeHtml(
                  state.editedSiteVerdict[site.id] ||
                    generateSiteExecutiveSummary(site)
                )}</textarea>
                <div class="editor-actions">
                  <button class="editor-cancel" type="button" data-verdict-cancel="${site.id}">Cancel</button>
                  <button class="editor-save" type="button" data-verdict-save="${site.id}">Save</button>
                </div>
              </div>
            `
                : `<p class="verdict-body">${state.editedSiteVerdict[site.id] || generateSiteExecutiveSummary(site)}</p>`
            }
          </div>
        </div>
      </section>

      <section>
        <div class="section-head">
          <h2>Risk Register</h2>
          <div class="section-head-actions summary-head-actions">
            <button class="primary-button" type="button" disabled>+ Add Risk</button>
            <div class="risk-view-toggle" role="group" aria-label="Summary risk view">
              <button class="toggle-button ${state.summaryRiskView === "list" ? "active" : ""}" type="button" data-summary-risk-view="list">List</button>
              <button class="toggle-button ${state.summaryRiskView === "grid" ? "active" : ""}" type="button" data-summary-risk-view="grid">Cards</button>
            </div>
          </div>
        </div>
        <div class="risk-grid ${state.summaryRiskView === "list" ? "is-list" : "is-grid"}">${riskMarkup}</div>
      </section>

      <section class="checklist-card">
        <div class="checklist-row">
          <span class="check-icon">✓</span>
          <div>
            <h2 class="checklist-title">Checklist Coverage</h2>
            <p class="checklist-copy">
              <strong>${site.checklistCompleted} / ${site.checklistTotal} checklist items completed (${site.checklistPercent}%)</strong><br />
              ${site.coverageSummary}
            </p>
          </div>
        </div>
      </section>
    </div>
  `;

  wireSummaryRiskCards(risks);
  wireRiskInteractions(elements.summaryPanel);
  wireVerdictEditor(site);

  [...elements.summaryPanel.querySelectorAll("[data-summary-risk-view]")].forEach(
    (button) => {
      button.addEventListener("click", () => {
        state.summaryRiskView = button.dataset.summaryRiskView;
        render();
      });
    }
  );
}

function wireSummaryRiskCards(risks) {
  const cards = [...elements.summaryPanel.querySelectorAll(".risk-card")];
  cards.forEach((card) => {
    const risk = risks.find((entry) => entry.id === card.dataset.riskId);
    const button = card.querySelector(".evidence-link");
    if (!risk || !button) {
      return;
    }
    button.addEventListener("click", () => {
      state.previousView = {
        tab: state.tab,
        scrollPosition: elements.summaryPanel.scrollTop,
        summaryRiskView: state.summaryRiskView,
      };
      state.tab = "full";
      state.selectedDomainKey = risk.domainKey;
      state.focusDomain = risk.domainKey;
      state.focusRisk = risk.id;
      render();
    });
  });
}

function generateExecutiveAssessment(risks) {
  if (!risks || risks.length === 0) {
    return "Development is feasible with standard due diligence and planning.";
  }

  const risksByTheme = {
    environmental: [],
    permitting: [],
    utilities: [],
    constraints: [],
    other: [],
  };

  risks.forEach((risk) => {
    const text = [risk.title, risk.statement, risk.summary]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/contamination|environmental|remediation|asbestos|lead|mold|hazard/i.test(text)) {
      risksByTheme.environmental.push(risk);
    } else if (/permit|zoning|approval|hearing|variance|entitlement/i.test(text)) {
      risksByTheme.permitting.push(risk);
    } else if (/utility|power|water|fiber|connectivity|infrastructure/i.test(text)) {
      risksByTheme.utilities.push(risk);
    } else if (/flood|seismic|climate|hazard|wildfire|access|wetland|habitat/i.test(text)) {
      risksByTheme.constraints.push(risk);
    } else {
      risksByTheme.other.push(risk);
    }
  });

  const assessmentParts = [];

  if (risksByTheme.environmental.length > 0) {
    assessmentParts.push(
      "Environmental considerations may require additional site investigation and regulatory coordination."
    );
  }

  if (risksByTheme.permitting.length > 0) {
    assessmentParts.push(
      "Project approvals and permits will need to address regulatory requirements before development can proceed."
    );
  }

  if (risksByTheme.utilities.length > 0) {
    assessmentParts.push(
      "Infrastructure connections and capacity will need to be confirmed with relevant service providers."
    );
  }

  if (risksByTheme.constraints.length > 0) {
    assessmentParts.push(
      "Site conditions and physical characteristics will need to be assessed and addressed during site planning."
    );
  }

  if (assessmentParts.length === 0) {
    return "Development is feasible with standard due diligence and planning.";
  }

  const assessment = assessmentParts.join(" ");
  return (
    "Development remains feasible but requires attention to key considerations: " +
    assessment.charAt(0).toLowerCase() +
    assessment.slice(1)
  );
}

function renderTemperatureProfile(profile, domainKey) {
  if (!profile) {
    return "";
  }

  const isHidden = state.temperatureProfileHidden[domainKey];

  const monthlyTableRows = profile.monthlyData
    .map(
      (month) => `
        <tr>
          <td class="month-label">${month.month}</td>
          <td class="temp-value">${month.high.f}°<span class="temp-unit">F</span></td>
          <td class="temp-value">${month.low.f}°<span class="temp-unit">F</span></td>
        </tr>
      `
    )
    .join("");

  return `
    <section class="temperature-profile">
      <div class="temperature-profile-header">
        <h4>Temperature Profile</h4>
        <button class="toggle-temp-profile" type="button" data-toggle-temp-profile="${domainKey}" aria-label="Toggle temperature profile">
          ${isHidden ? "Show" : "Hide"}
        </button>
      </div>
      ${
        !isHidden
          ? `
      <p class="temp-source">Historical data from Open-Meteo (ERSA)</p>

      <div class="temperature-stats">
        <div class="temp-stat-item">
          <span class="stat-label">Annual Average</span>
          <span class="stat-value">${profile.annualAverage.f}°F / ${profile.annualAverage.c}°C</span>
        </div>

        <div class="temp-stat-item">
          <span class="stat-label">Record High (${profile.recordHigh.year})</span>
          <span class="stat-value">${profile.recordHigh.value.f}°F / ${profile.recordHigh.value.c}°C</span>
        </div>

        <div class="temp-stat-item">
          <span class="stat-label">Record Low (${profile.recordLow.year})</span>
          <span class="stat-value">${profile.recordLow.value.f}°F / ${profile.recordLow.value.c}°C</span>
        </div>

        <div class="temp-stat-item">
          <span class="stat-label">Extreme Heat Days (+${profile.extremeHeatDays.f}°F / ${profile.extremeHeatDays.c}°C)</span>
          <span class="stat-value">38.1</span>
        </div>

        <div class="temp-stat-item">
          <span class="stat-label">Extreme Cold Days (${profile.extremeColdDays.f}°F / ${profile.extremeColdDays.c}°C)</span>
          <span class="stat-value">20.2</span>
        </div>

        <div class="temp-stat-item">
          <span class="stat-label">Cooling Degree Days (base 65°F)</span>
          <span class="stat-value">${profile.coolingDegreeDays.toLocaleString()}</span>
        </div>

        <div class="temp-stat-item">
          <span class="stat-label">Heating Degree Days (base 65°F)</span>
          <span class="stat-value">${profile.heatingDegreeDays.toLocaleString()}</span>
        </div>

        <div class="temp-stat-item">
          <span class="stat-label">Peak Apparent Temp (10-yr max)</span>
          <span class="stat-value">${profile.peakApparentTemp.f}°F / ${profile.peakApparentTemp.c}°C</span>
        </div>
      </div>

      <div class="monthly-temperatures">
        <h5>Monthly Average High / Low (10-year)</h5>
        <table class="temperature-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>High</th>
              <th>Low</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyTableRows}
          </tbody>
        </table>
      </div>
    `
          : ""
      }
    </section>
  `;
}

function renderCategorySummary(domain, risks) {
  if (!risks || risks.length === 0) {
    return "";
  }

  const executiveAssessment = generateExecutiveAssessment(risks);

  return `
    <section class="category-summary">
      <h3 class="category-summary-title">${domain.navLabel}</h3>

      <div class="category-summary-body">
        <div class="executive-assessment">
          <p>${executiveAssessment}</p>
        </div>
      </div>
    </section>
  `;
}

function getTemperatureProfile(domain) {
  if (!domain || domain.key !== "climate") {
    return null;
  }

  return {
    annualAverage: { f: 66.7, c: 19.3 },
    recordHigh: { value: { f: 109.4, c: 43 }, year: 1980 },
    recordLow: { value: { f: -3.8, c: -19.9 }, year: 2021 },
    extremeHeatDays: { f: 80, c: 38 },
    extremeColdDays: { f: 0, c: -32 },
    coolingDegreeDays: 1402,
    heatingDegreeDays: 1082,
    peakApparentTemp: { f: 113.2, c: 45.1 },
    monthlyData: [
      { month: "Jan", high: { f: 53.3, c: 11.8 }, low: { f: 36.5, c: 2.5 } },
      { month: "Feb", high: { f: 60.8, c: 16 }, low: { f: 43.3, c: 6.3 } },
      { month: "Mar", high: { f: 71.1, c: 21.7 }, low: { f: 50.3, c: 10.2 } },
      { month: "Apr", high: { f: 76.7, c: 24.8 }, low: { f: 55.8, c: 13.2 } },
      { month: "May", high: { f: 82.6, c: 28.1 }, low: { f: 64.2, c: 17.9 } },
      { month: "Jun", high: { f: 90.7, c: 32.6 }, low: { f: 72.5, c: 22.5 } },
      { month: "Jul", high: { f: 94.6, c: 34.8 }, low: { f: 76.4, c: 24.7 } },
      { month: "Aug", high: { f: 94.1, c: 34.5 }, low: { f: 76.2, c: 24.6 } },
      { month: "Sep", high: { f: 87.8, c: 31 }, low: { f: 70, c: 21.1 } },
      { month: "Oct", high: { f: 78.6, c: 25.9 }, low: { f: 58.1, c: 14.5 } },
      { month: "Nov", high: { f: 66.7, c: 19.3 }, low: { f: 48.4, c: 9.1 } },
      { month: "Dec", high: { f: 56, c: 13.3 }, low: { f: 42.1, c: 5.6 } },
    ],
  };
}

function generateSiteExecutiveSummary(site) {
  if (!site || !site.domains || site.domains.length === 0) {
    return "The site requires comprehensive due diligence across all categories before development can proceed.";
  }

  const categoryAssessments = [];
  const themesFound = new Set();

  site.domains.forEach((domain) => {
    if (domain.risks && domain.risks.length > 0) {
      const risksByType = {
        environmental: domain.risks.filter((r) =>
          /contamination|environmental|remediation|asbestos|lead|mold/i.test([r.title, r.statement].join(" "))
        ),
        regulatory: domain.risks.filter((r) =>
          /permit|zoning|approval|regulatory|entitlement/i.test([r.title, r.statement].join(" "))
        ),
        infrastructure: domain.risks.filter((r) =>
          /utility|power|water|fiber|infrastructure|connection/i.test([r.title, r.statement].join(" "))
        ),
        physical: domain.risks.filter((r) =>
          /site|physical|access|constraint|condition|hazard|flood|seismic/i.test([r.title, r.statement].join(" "))
        ),
      };

      if (risksByType.environmental.length > 0 && !themesFound.has("environmental")) {
        categoryAssessments.push("Environmental assessments and coordination will be required.");
        themesFound.add("environmental");
      }
      if (risksByType.regulatory.length > 0 && !themesFound.has("regulatory")) {
        categoryAssessments.push("Regulatory approvals and permits need to be secured.");
        themesFound.add("regulatory");
      }
      if (risksByType.infrastructure.length > 0 && !themesFound.has("infrastructure")) {
        categoryAssessments.push("Infrastructure capacity and connections require confirmation.");
        themesFound.add("infrastructure");
      }
      if (risksByType.physical.length > 0 && !themesFound.has("physical")) {
        categoryAssessments.push("Site conditions need to be assessed and mitigated.");
        themesFound.has("physical");
      }
    }
  });

  if (categoryAssessments.length === 0) {
    return "The site is feasible for development with standard due diligence.";
  }

  const assessmentText = categoryAssessments.slice(0, 3).join(" ");
  return (
    "Development is feasible but will require attention to multiple considerations: " +
    assessmentText.charAt(0).toLowerCase() +
    assessmentText.slice(1)
  );
}

function renderFull(site) {
  const visibleDomains = site.domains.filter((domain) =>
    matchesSearch(domain.searchText)
  );
  const selectedDomain =
    visibleDomains.find((domain) => domain.key === state.selectedDomainKey) ||
    visibleDomains.find((domain) => domain.key === state.focusDomain) ||
    visibleDomains[0] ||
    null;

  if (selectedDomain) {
    state.selectedDomainKey = selectedDomain.key;
  }

  const navMarkup = visibleDomains
    .map(
      (domain) => `
        <button class="domain-nav-item ${
          selectedDomain?.key === domain.key ? "active" : ""
        }" type="button" data-domain-nav="${domain.key}">
          <span class="domain-nav-icon" aria-hidden="true">${renderDomainNavIcon(
            domain.key
          )}</span>
          <span>${domain.navLabel}</span>
        </button>
      `
    )
    .join("");

  const visibleRisks = selectedDomain
    ? sortFullRisks(
        selectedDomain.risks.filter((risk) => matchesSearch(risk.searchText))
      )
    : [];

  const categorySummary = selectedDomain ? renderCategorySummary(selectedDomain, visibleRisks) : "";

  const bodyMarkup = selectedDomain
    ? `
      <section class="full-category-pane" id="domain-${selectedDomain.key}" data-domain="${selectedDomain.key}">
        ${categorySummary}
        ${selectedDomain.temperatureProfile ? renderTemperatureProfile(selectedDomain.temperatureProfile, selectedDomain.key) : ""}
        <nav class="section-quicknav" aria-label="Category sections">
          <a href="#section-risks" class="section-quicknav-item">Identified Risks (${selectedDomain.risks.length})</a>
          <a href="#section-findings" class="section-quicknav-item">Key Findings (${selectedDomain.keyFindings.length})</a>
          <a href="#section-metrics" class="section-quicknav-item">Quantified Metrics (${selectedDomain.quantifiedMetrics.length})</a>
          <a href="#section-checklist" class="section-quicknav-item">Detailed Checklist Assessment (${selectedDomain.checklistCompleted} / ${selectedDomain.checklistTotal} completed)</a>
        </nav>

        <section class="full-section" id="section-risks">
          <div class="full-section-head">
            <h4>Identified Risks</h4>
            <div class="section-head-actions">
              <span>${visibleRisks.length} items</span>
              <div class="risk-view-toggle" role="group" aria-label="Risk view">
                <button class="toggle-button ${state.fullRiskView === "list" ? "active" : ""}" type="button" data-risk-view="list">List</button>
                <button class="toggle-button ${state.fullRiskView === "grid" ? "active" : ""}" type="button" data-risk-view="grid">Cards</button>
              </div>
            </div>
          </div>
          <div class="full-risk-list ${state.fullRiskView === "grid" ? "is-grid" : "is-list"}">
            ${visibleRisks
              .map((risk) => renderFullRiskMarkup(risk))
              .join("")}
          </div>
        </section>

        <section class="full-section" id="section-findings">
          <div class="full-section-head">
            <h4>Key Findings</h4>
            <span>${selectedDomain.keyFindings.length} items</span>
          </div>
          <div class="finding-grid">
            ${selectedDomain.keyFindings
              .map(
                (finding) => `
                  <article class="finding-card">
                    <h5>${finding.title}</h5>
                    <p>${finding.text}</p>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>

        <section class="full-section" id="section-metrics">
          <div class="full-section-head">
            <h4>Quantified Metrics</h4>
            <span>${selectedDomain.quantifiedMetrics.length} metrics</span>
          </div>
          <div class="metric-grid">
            ${selectedDomain.quantifiedMetrics
              .map(
                (metric) => `
                  <article class="metric-card">
                    <span class="metric-card-label">${metric.label}</span>
                    <strong class="metric-card-value">${metric.value}</strong>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>

        <section class="full-section" id="section-checklist">
          <div class="full-section-head">
            <h4>Detailed Checklist Assessment</h4>
            <span>${selectedDomain.checklistItems.length} checklist items</span>
          </div>
          <div class="checklist-detail-list">
            ${selectedDomain.checklistItems
              .filter((item) => matchesSearch(item.searchText))
              .slice(0, 12)
              .map(
                (item) => `
                  <article class="checklist-detail-card">
                    <div class="checklist-detail-top">
                      <span class="checklist-status ${item.statusTone}">${item.statusLabel}</span>
                      <span class="checklist-id">${item.id}</span>
                    </div>
                    <h5>${item.title}</h5>
                    <p>${item.finding}</p>
                    ${
                      item.soWhat
                        ? `<p class="checklist-impact"><strong>So what:</strong> ${item.soWhat}</p>`
                        : ""
                    }
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      </section>
    `
    : '<div class="empty-state">No domains match the current search.</div>';

  elements.fullPanel.innerHTML = `
    <div class="full-layout">
      <div class="full-eval-shell">
        <aside class="full-sidenav">
          <div class="full-sidenav-head">
            <span>Categories</span>
          </div>
          <div class="full-sidenav-list">${navMarkup}</div>
        </aside>
        ${bodyMarkup}
      </div>
    </div>
  `;

  [...elements.fullPanel.querySelectorAll("[data-domain-nav]")].forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDomainKey = button.dataset.domainNav;
      state.focusDomain = button.dataset.domainNav;
      state.focusRisk = null;
      render();
    });
  });

  [...elements.fullPanel.querySelectorAll("[data-risk-view]")].forEach((button) => {
    button.addEventListener("click", () => {
      state.fullRiskView = button.dataset.riskView;
      render();
    });
  });
  wireRiskInteractions(elements.fullPanel);
  wireTemperatureProfileToggle(elements.fullPanel);
  wireFullSectionSpy();
}

function renderMap(site) {
  elements.mapPanel.innerHTML = `
    <div class="map-layout">
      <section class="map-card">
        <div class="map-thumb">
          ${renderPolygonSvg(site.polygon)}
        </div>
      </section>
      <aside class="insight-card">
        <h3>Map Context</h3>
        <ul class="insight-list">
          <li><strong>Site:</strong> ${site.name}</li>
          <li><strong>Centroid:</strong> ${site.center.lat.toFixed(5)}, ${site.center.lng.toFixed(5)}</li>
          <li><strong>Scale:</strong> ${site.acresLabel}</li>
          <li><strong>Jurisdiction:</strong> ${site.locationLabel}</li>
          <li><strong>Fatal flaws flagged:</strong> ${site.fatalFlawCount}</li>
        </ul>
        <h3>Conditions of Approval</h3>
        <ul class="mini-list">
          ${site.conditions.map((condition) => `<li>${condition}</li>`).join("")}
        </ul>
      </aside>
    </div>
  `;
}

function highlightTarget() {
  requestAnimationFrame(() => {
    document
      .querySelectorAll(".active-target")
      .forEach((node) => node.classList.remove("active-target"));

    if (state.tab !== "full") {
      return;
    }

    const target =
      (state.focusRisk && document.querySelector(`#risk-${CSS.escape(state.focusRisk)}`)) ||
      (state.focusDomain &&
        document.querySelector(`#domain-${CSS.escape(state.focusDomain)}`));

    if (target) {
      target.classList.add("active-target");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function normalizeSite(site) {
  const report = site.riskAssessment || {};
  const domainEntries = Object.entries(report.domains || {});
  const riskRegister = report.riskRegister || [];

  const domains = domainEntries.map(([key, domain]) => {
    const checklistItems = (domain.checklistItems || []).map((item) => ({
      title: item.title,
      status: item.checklist_completion_status || item.status || "Unknown",
    }));
    const checklistCompleted = checklistItems.filter((item) =>
      item.status.toLowerCase().includes("complete")
    ).length;

    const normalizedDomain = {
      key,
      label: domain.domainTitle || key,
      title: titleCase(domain.domainTitle || key),
      navLabel: getDomainDisplayName(key),
      summary: domain.summary || "No summary provided.",
      coverageLabel: domain.coverage || site.assessmentCoverage?.[key]?.coverage || "Coverage pending",
      factsCount: domain.facts_count || 0,
      sourcesCount: domain.sources_count || (domain.sources || []).length,
      checklistTotal: checklistItems.length,
      checklistCompleted,
      checklistPreview: checklistItems.slice(0, 4),
      keyFindings: (domain.keyFindings || []).map((finding) => ({
        title: finding.title || "Key finding",
        text: finding.text || "No finding text provided.",
      })),
      quantifiedMetrics: normalizeQuantifiedMetrics(domain.quantifiedData),
      checklistItems: (domain.checklistItems || []).map((item) =>
        normalizeChecklistItem(item)
      ),
      sources: dedupeSources(domain.sources || []),
      risks: (domain.risks || []).map((risk) => normalizeRisk(risk, key)),
      temperatureProfile: getTemperatureProfile({ key }),
      searchText: [
        key,
        domain.domainTitle,
        domain.summary,
        ...(domain.keyFindings || []).map((finding) => finding.title || finding.text),
        ...Object.keys(domain.quantifiedData || {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };

    return normalizedDomain;
  });
  const domainOrder = [
    "land",
    "zoning",
    "energy",
    "connectivity",
    "water",
    "environmental",
    "climate",
    "financial",
    "community",
  ];
  domains.sort(
    (a, b) => domainOrder.indexOf(a.key) - domainOrder.indexOf(b.key)
  );

  const normalizedRisks = riskRegister.map((risk) => {
    const category = getRiskCategory(risk);
    const matchingDomain = guessDomainKey(category);
    return normalizeRisk(risk, matchingDomain);
  });
  const allDomainRisks = domains.flatMap((domain) => domain.risks);

  const checklistCompleted = domains.reduce(
    (sum, domain) => sum + domain.checklistCompleted,
    0
  );
  const checklistTotal = domains.reduce((sum, domain) => sum + domain.checklistTotal, 0);
  const sizeSqft = Number(site.size) || 0;
  const acres = sizeSqft > 0 ? sizeSqft / 43560 : 0;
  const certaintyScore =
    Number(site.certaintyScores?.overall_score) ||
    Number(site.certaintyScores?.overall) ||
    0;

  return {
    ...site,
    center: site.center || { lat: 0, lng: 0 },
    polygon: site.polygon,
    name: site.name,
    statusLabel: titleCase(site.projectStatus || site.assessmentStatus || "Active"),
    locationLabel: [site.state, site.country].filter(Boolean).join(", ") || site.location,
    verdict:
      report.synthesis?.recommendation ||
      "No synthesized recommendation is available for this site yet.",
    risks: normalizedRisks,
    allDomainRisks,
    domains,
    riskCount: normalizedRisks.length,
    domainCount: domains.length,
    certaintyScore,
    certaintyGrade:
      site.certaintyScores?.overall_grade || site.certaintyScores?.grade || "N/A",
    acresLabel: `${Math.round(acres).toLocaleString()} acres`,
    checklistCompleted,
    checklistTotal,
    checklistPercent: checklistTotal
      ? Math.round((checklistCompleted / checklistTotal) * 100)
      : 0,
    coverageSummary:
      checklistTotal > 0
        ? "All available site evaluation criteria have been screened and surfaced into the detailed evaluation so leaders can move from executive readout to evidence without changing context."
        : "Coverage details are still being compiled.",
    coverageChips: [
      { label: "Fatal flaws", value: String((report.fatalFlawRankings || []).length) },
      { label: "Top risks", value: String((report.synthesis?.topRisks || []).length) },
      { label: "RFIs needed", value: String((report.synthesis?.rfisNeeded || []).length) },
    ],
    fatalFlawCount: (report.fatalFlawRankings || []).length,
    conditions:
      report.synthesis?.conditionsOfApproval?.length > 0
        ? report.synthesis.conditionsOfApproval
        : ["No explicit conditions of approval were listed in the fixture."],
  };
}

function normalizeRisk(risk, domainKey) {
  const category = inferRiskCategory(risk);
  const severity = getSeverity(risk);
  const certainty =
    Number(risk.certainty?.certainty_score) ||
    Number(risk.certainty?.score) ||
    Number(risk.confidence) ||
    67;

  const title = risk.title || "Untitled risk";
  const statement = getRiskStatement(risk, title, category);
  const impactAreas = getImpactAreas(risk, title, category);

  return {
    id: risk.id || crypto.randomUUID(),
    title,
    statement,
    summary:
      risk.so_what ||
      risk.description_plain ||
      risk.description ||
      risk.riskDescription ||
      "No summary provided.",
    mitigation:
      risk.riskMitigation ||
      risk.mitigation ||
      "No mitigation plan included in the source payload.",
    category,
    severity,
    certainty,
    domainKey: domainKey || guessDomainKey(category),
    sources: dedupeSources(risk.sources || []),
    impactAreas,
    searchText: [
      risk.title,
      risk.so_what,
      risk.description_plain,
      risk.description,
      risk.riskDescription,
      category,
      severity,
      domainKey,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

function getRiskStatement(risk, title, category) {
  const haystack = [title, category, risk.so_what, risk.description_plain, risk.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const statements = {
    "npl site": "Environmental remediation obligations may increase development costs",
    "groundwater monitoring": "Existing monitoring wells may restrict construction activities",
    "contamination migration": "Potential contaminant migration may require additional environmental review",
    "superfund": "Proximity to contaminated sites may trigger additional regulatory oversight",
    "wetland": "Wetland constraints may limit buildable area and require permitting",
    "protected habitat": "Protected species habitat may restrict development activities and timelines",
    "flood zone": "Flood risk may require elevated construction and impact insurability",
    "seismic": "Seismic activity may require specialized foundation design",
    "radon": "Radon exposure may require mitigation and ongoing monitoring",
    "zoning variance": "Requested zoning variance may face community opposition or approval delays",
    "permit": "Required permits may introduce schedule risk and approval uncertainty",
    "utility connection": "Utility infrastructure constraints may require costly extensions or upgrades",
    "power capacity": "Electrical capacity upgrades may be required and create schedule risk",
    "water allocation": "Water allocation limits may restrict operational demands",
    "connectivity": "Limited fiber or network infrastructure may affect operational efficiency",
    "environmental remediation": "Active remediation requirements may create operational and cost impacts",
    "asbestos": "Asbestos abatement may be required before demolition or renovation",
    "lead": "Lead remediation or containment may be required during construction",
    "mold": "Mold remediation may delay occupancy or increase construction scope",
    "adjacent property": "Conditions on adjacent properties may affect development feasibility",
    "noise": "Noise restrictions may limit operational hours or require mitigation",
    "air quality": "Air quality standards may require operational controls or monitoring",
    "market": "Market conditions may affect project viability or investment returns",
    "financing": "Financing challenges may constrain project delivery or scope",
  };

  for (const [pattern, statement] of Object.entries(statements)) {
    if (haystack.includes(pattern)) {
      return statement;
    }
  }

  return title;
}

function getImpactAreas(risk, title, category) {
  const haystack = [title, category, risk.so_what, risk.description_plain, risk.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const impacts = new Set();

  if (/contamination|remediation|environmental|asbestos|lead|mold|hazardous/.test(haystack)) {
    impacts.add("Cost");
    impacts.add("Schedule");
    impacts.add("Permitting");
  }

  if (/wetland|habitat|species|protected|preserve|ecological/.test(haystack)) {
    impacts.add("Buildability");
    impacts.add("Permitting");
    impacts.add("Schedule");
  }

  if (/flood|seismic|earthquake|hazard|climate|storm|wildfire/.test(haystack)) {
    impacts.add("Cost");
    impacts.add("Buildability");
    impacts.add("Operations");
  }

  if (/zoning|variance|permit|approval|entitlement|hearing/.test(haystack)) {
    impacts.add("Schedule");
    impacts.add("Permitting");
  }

  if (/utility|power|energy|water|wastewater|infrastructure|fiber/.test(haystack)) {
    impacts.add("Cost");
    impacts.add("Operations");
    impacts.add("Schedule");
  }

  if (/noise|air|traffic|community|stakeholder|opposition/.test(haystack)) {
    impacts.add("Schedule");
    impacts.add("Permitting");
  }

  if (/financial|tax|cost|budget|financing|insurance/.test(haystack)) {
    impacts.add("Cost");
  }

  if (impacts.size === 0) {
    impacts.add("Cost");
    impacts.add("Schedule");
  }

  return Array.from(impacts).sort();
}

function getSeverity(risk) {
  const raw =
    risk.severity_label ||
    risk.severity ||
    risk.severityOfOccurrence?.label ||
    risk.severityOfOccurrence?.level ||
    risk.severityOfOccurrence;

  if (typeof raw === "number") {
    if (raw >= 8) {
      return "High";
    }
    if (raw >= 5) {
      return "Medium";
    }
    return "Low";
  }

  const label = String(raw || "Medium").toLowerCase();
  if (label.includes("high")) {
    return "High";
  }
  if (label.includes("low")) {
    return "Low";
  }
  return "Medium";
}

function getRiskCategory(risk) {
  const raw = risk.riskCategorization;
  if (typeof raw === "string" && raw) {
    return raw;
  }
  if (raw && typeof raw === "object") {
    return raw.categoryName || raw.category || raw.name || "General";
  }
  return "General";
}

function inferRiskCategory(risk) {
  const rawCategory = getRiskCategory(risk);
  const haystack = [
    risk.title,
    risk.so_what,
    risk.description_plain,
    risk.description,
    risk.riskDescription,
    rawCategory,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const titleStack = [risk.title, rawCategory].filter(Boolean).join(" ").toLowerCase();

  if (
    /\b(community|stakeholder|opposition|social license|ban|local government|elected officials|climate revolution|activist|activists)\b/.test(
      titleStack
    )
  ) {
    return "Community/Stakeholder";
  }

  if (
    /\b(zoning|permit|permitting|variance|rezoning|entitlement|hearing|litigation|appeal|master plan|approval path)\b/.test(
      haystack
    )
  ) {
    return "Zoning/Permitting";
  }

  if (
    /\b(superfund|wetland|plume|environmental|ecology|species|floodplain|riparian|contamination)\b/.test(
      haystack
    )
  ) {
    return "Environmental";
  }

  if (
    /\b(water|wastewater|cooling|aquifer|sewer|njaw|allocation permit)\b/.test(
      haystack
    )
  ) {
    return "Water/Wastewater";
  }

  if (
    /\b(power|energy|substation|electric|utility|feeder|pjm|grid|transformer)\b/.test(
      haystack
    )
  ) {
    return "Utility/Power";
  }

  if (
    /\b(fiber|connectivity|network|telecom|carrier|latency|broadband)\b/.test(
      haystack
    )
  ) {
    return "Connectivity/Network";
  }

  if (
    /\b(financial|tax|insurance|incentive|ciac|premium|land acquisition)\b/.test(
      haystack
    )
  ) {
    return "Financial/Tax";
  }

  if (/\b(climate|hazard|storm|heat|wildfire|drought)\b/.test(haystack)) {
    return "Climate/Natural Hazards";
  }

  if (/\b(land|physical|parcel|site area|constructability|buildable)\b/.test(haystack)) {
    return "Land/Physical";
  }

  return rawCategory;
}

function guessDomainKey(category) {
  const value = category.toLowerCase();
  if (value.includes("water")) return "water";
  if (value.includes("utility") || value.includes("power") || value.includes("energy"))
    return "energy";
  if (value.includes("zoning") || value.includes("permit")) return "zoning";
  if (value.includes("climate")) return "climate";
  if (value.includes("community")) return "community";
  if (value.includes("financial")) return "financial";
  if (value.includes("connect")) return "connectivity";
  if (value.includes("environment")) return "environmental";
  return "land";
}

function getDomainDisplayName(key) {
  const labels = {
    land: "Land & Constructability",
    zoning: "Zoning, Permitting & Legal",
    energy: "Power & Energy",
    connectivity: "Fiber & Connectivity",
    water: "Water, Wastewater & Cooling",
    environmental: "Environmental & Cultural Resources",
    climate: "Climate & Natural Hazards",
    community: "Community Engagement",
    financial: "Financial, Tax & Incentives",
  };
  return labels[key] || titleCase(key);
}

function renderDomainNavIcon(key) {
  const icons = {
    land: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="2"></rect><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h6"></path></svg>',
    zoning: '<svg viewBox="0 0 24 24"><path d="M7 4h7l5 5v11H7z"></path><path d="M14 4v5h5"></path></svg>',
    energy: '<svg viewBox="0 0 24 24"><path d="M13 2 6 13h5l-1 9 7-11h-5z"></path></svg>',
    connectivity: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path></svg>',
    water: '<svg viewBox="0 0 24 24"><path d="M12 3c3 4 6 7.1 6 10a6 6 0 0 1-12 0c0-2.9 3-6 6-10Z"></path></svg>',
    environmental: '<svg viewBox="0 0 24 24"><path d="M19 5c-7 0-12 4.2-12 10 0 2.8 1.6 4 3.8 4 5.7 0 8.2-5 8.2-14Z"></path><path d="M8 15c1.5-1.5 3.6-2.8 6.2-3.8"></path></svg>',
    climate: '<svg viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M3 12h6M15 12h6"></path></svg>',
    community: '<svg viewBox="0 0 24 24"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 13a2.5 2.5 0 1 0 0-5M3 19a6 6 0 0 1 12 0M14 19v-1a4 4 0 0 1 7.2-2.4"></path></svg>',
    financial: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M9 10c0-1.1 1.1-2 2.5-2h1c1.4 0 2.5.9 2.5 2s-1.1 2-2.5 2h-2c-1.4 0-2.5.9-2.5 2s1.1 2 2.5 2h1c1.4 0 2.5-.9 2.5-2M12 6v12"></path></svg>',
  };
  return icons[key] || icons.land;
}

function normalizeQuantifiedMetrics(quantifiedData) {
  return Object.entries(quantifiedData || {})
    .slice(0, 12)
    .map(([label, value]) => ({
      label,
      value: formatMetricValue(value),
    }));
}

function normalizeChecklistItem(item) {
  const rawStatus =
    item.checklist_completion_status || item.status || "Unknown";
  const statusLabel = titleCase(String(rawStatus).replace(/_/g, " "));
  return {
    id: item.id || "Item",
    title: item.title || "Checklist item",
    finding: item.finding || "No assessment finding provided.",
    soWhat: item.so_what || "",
    statusLabel,
    statusTone: getChecklistTone(rawStatus),
    searchText: [
      item.id,
      item.title,
      item.finding,
      item.so_what,
      rawStatus,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

function getChecklistTone(status) {
  const value = String(status).toLowerCase();
  if (value.includes("complete") || value.includes("confirm")) return "is-good";
  if (value.includes("insufficient") || value.includes("gap")) return "is-warn";
  return "is-neutral";
}

function formatMetricValue(value) {
  if (value == null || value === "") {
    return "Not provided";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  if (typeof value === "object") {
    return Object.values(value).join(" • ");
  }
  return String(value);
}

function renderPolygonSvg(polygon) {
  const coords = polygon?.coordinates?.[0] || [];
  if (!coords.length) {
    return "";
  }

  const xs = coords.map((pair) => pair[0]);
  const ys = coords.map((pair) => pair[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  const points = coords
    .map(([x, y]) => {
      const px = ((x - minX) / width) * 76 + 12;
      const py = 86 - ((y - minY) / height) * 76;
      return `${px},${py}`;
    })
    .join(" ");

  return `
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon
        points="${points}"
        fill="rgba(115, 174, 255, 0.28)"
        stroke="#4c8bff"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
      <g class="marker-dot" transform="translate(50 58)">
        <circle r="5" fill="#ffffff"></circle>
        <circle r="2.1" fill="#ff5d56"></circle>
        <circle r="7.5" fill="none" stroke="#ffffff" stroke-width="1.2"></circle>
      </g>
    </svg>
  `;
}

function dedupeSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = source.source_id || source.url;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getSummaryRisks(site) {
  const flagged = site.allDomainRisks.filter((risk) => isFlaggedRisk(risk.id));
  const merged = [...flagged, ...site.risks];
  const seen = new Set();
  return merged
    .filter((risk) => {
      if (seen.has(risk.id)) return false;
      seen.add(risk.id);
      return true;
    })
    .sort((a, b) => Number(isFlaggedRisk(b.id)) - Number(isFlaggedRisk(a.id)));
}

function renderFullRiskMarkup(risk) {
  const note = getRiskNote(risk.id);
  const noteEditorOpen = state.activeNoteRiskId === risk.id;
  const impactIcons = {
    cost: '<svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/></svg>',
    schedule: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    permitting: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    buildability: '<svg viewBox="0 0 24 24"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/></svg>',
    operations: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6m7-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2M5 10a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/></svg>',
    utilities: '<svg viewBox="0 0 24 24"><path d="M6 9h12M6 9L4 20h16l-2-11M6 9l1-4h6v-1h-6l-1 5h12l1-5h-6v1h6l1-4H7l-1 4z"/></svg>',
  };

  const impactTags = (risk.impactAreas || [])
    .map((area) => {
      const className = area.toLowerCase().replace(/\s+/g, "");
      const icon = impactIcons[className] || '';
      return `<span class="impact-tag ${className}"><span class="impact-tag-icon">${icon}</span>${area}</span>`;
    })
    .join("");

  return `
    <article class="full-risk-row" id="risk-${risk.id}" data-risk-id="${risk.id}">
      <div class="full-risk-top">
        <div class="full-risk-actions">
          <button class="flag-button ${isFlaggedRisk(risk.id) ? "is-active" : ""}" type="button" data-flag-risk="${risk.id}" aria-label="Flag risk">
            ${renderFlagIcon()}
          </button>
          <div class="note-button-wrapper">
            <button
              class="note-button ${note ? "has-note" : ""} ${noteEditorOpen ? "is-open" : ""}"
              type="button"
              data-note-risk="${risk.id}"
              aria-label="${note ? "Edit note" : "Add note"}"
              ${note ? `data-note-content="${escapeHtml(note)}"` : ""}
            >
              ${renderNoteIcon()}
            </button>
            ${note ? `<div class="note-tooltip">${escapeHtml(note)}</div>` : ""}
          </div>
          <div class="risk-more-menu">
            <button class="more-button" type="button" data-more-menu="${risk.id}" aria-label="More options" aria-haspopup="menu">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
              </svg>
            </button>
            <div class="more-menu-dropdown" role="menu">
              <button class="more-menu-item" type="button" data-edit-risk="${risk.id}" role="menuitem">Edit</button>
              <button class="more-menu-item danger" type="button" data-delete-risk="${risk.id}" role="menuitem">Delete</button>
            </div>
          </div>
          ${noteEditorOpen ? renderNotePopover(risk.id) : ""}
        </div>
      </div>
      <div class="risk-metrics full-risk-metrics">
        <div class="metric-pair">
          <span class="severity-badge ${risk.severity.toLowerCase()}">${risk.severity}</span>
        </div>
        <div class="metric-pair certainty-pair">
          <span class="metric-label">Certainty:</span>
          <span class="certainty-badge">${risk.certainty}%</span>
        </div>
      </div>
      <h5 class="risk-statement">${risk.statement}</h5>
      ${impactTags ? `<div class="impact-tags">${impactTags}</div>` : ""}
      <p class="full-risk-text">${risk.summary}</p>
      <a class="text-link" href="${risk.sources[0]?.url || "#"}" target="_blank" rel="noreferrer noopener">Sources (${risk.sources.length})</a>
    </article>
  `;
}

function isFlaggedRisk(riskId) {
  return state.flaggedRiskIds.includes(riskId);
}

function toggleFlagRisk(riskId) {
  state.flaggedRiskIds = isFlaggedRisk(riskId)
    ? state.flaggedRiskIds.filter((id) => id !== riskId)
    : [...state.flaggedRiskIds, riskId];
}

function renderFlagIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3v18"></path>
      <path d="M6 4h9l-1.8 3 1.8 3H6"></path>
    </svg>
  `;
}

function renderNoteIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4.5A2.5 2.5 0 0 1 5 12z"></path>
    </svg>
  `;
}

function renderNotePopover(riskId) {
  return `
    <div class="note-popover" role="dialog" aria-label="Risk note editor">
      <div class="note-popover-head">Note</div>
      <textarea class="note-textarea" rows="4" placeholder="Add context, follow-up, or next step...">${escapeHtml(
        getRiskNote(riskId)
      )}</textarea>
      <div class="note-popover-actions">
        <button class="note-secondary" type="button" data-note-cancel="${riskId}">Cancel</button>
        <button class="note-secondary danger" type="button" data-note-delete="${riskId}">Delete</button>
        <button class="note-primary" type="button" data-note-save="${riskId}">Save</button>
      </div>
    </div>
  `;
}

function wireRiskInteractions(container) {
  [...container.querySelectorAll("[data-more-menu]")].forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdown = button.nextElementSibling;
      if (dropdown?.classList.contains("more-menu-dropdown")) {
        dropdown.classList.toggle("is-open");
      }
    });
  });

  document.addEventListener("click", (e) => {
    [...document.querySelectorAll(".more-menu-dropdown.is-open")].forEach((dropdown) => {
      if (!dropdown.parentElement.contains(e.target)) {
        dropdown.classList.remove("is-open");
      }
    });
  });

  [...container.querySelectorAll("[data-flag-risk]")].forEach((button) => {
    button.addEventListener("click", () => {
      const riskId = button.dataset.flagRisk;
      const nextFlagged = !isFlaggedRisk(riskId);
      toggleFlagRisk(riskId);
      showToast(
        nextFlagged
          ? "Risk added to Summary Evaluation."
          : "Risk removed from Summary Evaluation."
      );
      render();
    });
  });

  [...container.querySelectorAll("[data-note-risk]")].forEach((button) => {
    button.addEventListener("click", () => {
      const riskId = button.dataset.noteRisk;
      state.activeNoteRiskId = state.activeNoteRiskId === riskId ? null : riskId;
      render();
    });
  });

  [...container.querySelectorAll("[data-note-cancel]")].forEach((button) => {
    button.addEventListener("click", () => {
      state.activeNoteRiskId = null;
      render();
    });
  });

  [...container.querySelectorAll("[data-note-delete]")].forEach((button) => {
    button.addEventListener("click", () => {
      setRiskNote(button.dataset.noteDelete, "");
      state.activeNoteRiskId = null;
      render();
    });
  });

  [...container.querySelectorAll("[data-note-save]")].forEach((button) => {
    button.addEventListener("click", () => {
      const riskId = button.dataset.noteSave;
      const editor = button.closest(".note-popover");
      const textarea = editor?.querySelector("textarea");
      setRiskNote(riskId, textarea?.value || "");
      state.activeNoteRiskId = null;
      render();
    });
  });

  [...container.querySelectorAll("[data-edit-risk]")].forEach((button) => {
    button.addEventListener("click", () => {
      const riskId = button.dataset.editRisk;
      showToast("Edit risk feature coming soon");
      // TODO: Implement edit risk functionality
    });
  });

  [...container.querySelectorAll("[data-delete-risk]")].forEach((button) => {
    button.addEventListener("click", () => {
      const riskId = button.dataset.deleteRisk;
      if (confirm("Are you sure you want to delete this risk?")) {
        // TODO: Implement delete risk functionality
        showToast("Risk deleted");
        render();
      }
    });
  });
}

function wireVerdictEditor(site) {
  const editButton = elements.summaryPanel?.querySelector("[data-edit-verdict]");
  const cancelButton = elements.summaryPanel?.querySelector("[data-verdict-cancel]");
  const saveButton = elements.summaryPanel?.querySelector("[data-verdict-save]");
  const revertButton = elements.summaryPanel?.querySelector("[data-revert-verdict]");

  if (editButton) {
    editButton.addEventListener("click", () => {
      state.editingSiteVerdictId = site.id;
      render();
    });
  }

  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      state.editingSiteVerdictId = null;
      render();
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", () => {
      const editor = elements.summaryPanel?.querySelector("[data-verdict-editor]");
      const textarea = editor?.querySelector("textarea");
      if (textarea) {
        state.editedSiteVerdict[site.id] = textarea.value.trim();
        state.editedVerdictStatus[site.id] = "edited";
      }
      state.editingSiteVerdictId = null;
      render();
    });
  }

  if (revertButton) {
    revertButton.addEventListener("click", () => {
      delete state.editedSiteVerdict[site.id];
      delete state.editedVerdictStatus[site.id];
      render();
    });
  }
}

function wireTemperatureProfileToggle(container) {
  [...container.querySelectorAll("[data-toggle-temp-profile]")].forEach((button) => {
    button.addEventListener("click", () => {
      const domainKey = button.dataset.toggleTempProfile;
      state.temperatureProfileHidden[domainKey] = !state.temperatureProfileHidden[domainKey];
      render();
    });
  });
}

function wireFullSectionSpy() {
  const scrollRoot = elements.fullPanel;
  const quicknav = scrollRoot.querySelector(".section-quicknav");
  const links = [...scrollRoot.querySelectorAll(".section-quicknav-item")];
  const sections = [...scrollRoot.querySelectorAll(".full-section")];

  if (!quicknav || !links.length || !sections.length) {
    return;
  }

  const setActiveLink = (activeId) => {
    links.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${activeId}`;
      link.classList.toggle("is-active", isActive);
      link.setAttribute("aria-current", isActive ? "true" : "false");
    });
  };

  const updateActiveSection = () => {
    const rootTop = scrollRoot.getBoundingClientRect().top;
    const stickyOffset = quicknav.offsetHeight + 20;
    const candidate =
      sections.find((section) => {
        const sectionTop = section.getBoundingClientRect().top - rootTop;
        return sectionTop >= stickyOffset - 12;
      }) || sections[sections.length - 1];

    setActiveLink(candidate.id);
  };

  links.forEach((link) => {
    link.addEventListener("click", () => {
      const targetId = link.getAttribute("href")?.slice(1);
      if (targetId) {
        setActiveLink(targetId);
      }
    });
  });

  scrollRoot.addEventListener("scroll", updateActiveSection, { passive: true });
  updateActiveSection();
}

function renderSummaryCategoryChip(risk) {
  const presentation = getCategoryPresentation(risk);
  return `
    <div class="category-chip ${presentation.toneClass}">
      <span class="category-chip-icon" aria-hidden="true">${presentation.icon}</span>
      <span class="category-chip-label">${presentation.label}</span>
    </div>
  `;
}

function getCategoryPresentation(risk) {
  const domainKey = risk.domainKey || guessDomainKey(risk.category);
  const label = getDomainDisplayName(domainKey);
  return {
    key: domainKey,
    label,
    icon: renderDomainNavIcon(domainKey),
    toneClass: `is-${domainKey}`,
  };
}

function getRiskNote(riskId) {
  return state.riskNotes[riskId] || "";
}

function setRiskNote(riskId, value) {
  const note = String(value || "").trim();
  if (!note) {
    delete state.riskNotes[riskId];
    return;
  }
  state.riskNotes[riskId] = note;
}

function sortFullRisks(risks) {
  return [...risks].sort(
    (a, b) =>
      Number(isFlaggedRisk(b.id)) - Number(isFlaggedRisk(a.id)) ||
      getSeverityRank(b.severity) - getSeverityRank(a.severity) ||
      Number(b.certainty || 0) - Number(a.certainty || 0) ||
      a.title.localeCompare(b.title)
  );
}

function getSeverityRank(severity) {
  const value = String(severity || "").toLowerCase();
  if (value.includes("high")) return 3;
  if (value.includes("medium")) return 2;
  if (value.includes("low")) return 1;
  return 0;
}

function matchesSearch(text) {
  return !state.search || text.includes(state.search);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(message) {
  if (!elements.toast) {
    return;
  }
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  elements.toast.classList.add("is-visible");

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
    elements.toast.classList.add("hidden");
  }, 2600);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function titleCase(value) {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderReturnButton() {
  let button = document.querySelector("#returnToPreviousView");

  if (!state.previousView) {
    if (button) button.remove();
    return;
  }

  if (!button) {
    button = document.createElement("button");
    button.id = "returnToPreviousView";
    button.className = "return-button";
    button.setAttribute("aria-label", "Return to previous view");
    document.body.appendChild(button);
    button.addEventListener("click", returnToPreviousView);
  }

  const viewLabel = state.previousView.tab === "summary" ? "Summary Evaluation" : "Map";
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
    <span>Back to ${viewLabel}</span>
  `;
}

function returnToPreviousView() {
  if (!state.previousView) return;

  state.tab = state.previousView.tab;
  state.summaryRiskView = state.previousView.summaryRiskView || "grid";
  state.focusDomain = null;
  state.focusRisk = null;
  const scrollPos = state.previousView.scrollPosition;
  state.previousView = null;

  render();

  requestAnimationFrame(() => {
    const panel = state.tab === "summary" ? elements.summaryPanel : elements.mapPanel;
    if (panel) {
      panel.scrollTop = scrollPos;
    }
  });
}
