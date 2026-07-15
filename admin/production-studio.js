"use strict";
(() => {
  const STAGES = [
    ["load-content-pack", "Load Content Pack"],
    ["topic-planner", "Topic Planner"],
    ["job-queue", "Job Queue creation"],
    ["draft-generator", "Draft Generator"],
    ["research-queue", "Research Queue"],
    ["human-review", "Human Review"],
    ["batch-validation", "Batch Validation"],
    ["safe-import", "Safe Import"],
    ["backup-rollback", "Backup & Rollback"],
    ["dashboard-refresh", "Dashboard refresh"],
    ["monthly-maintenance", "Monthly Maintenance"],
    ["final-report", "Final Production Report"],
  ];
  const byId = (id) => document.getElementById(id);
  const number = (value) =>
    Number.isFinite(Number(value)) ? Number(value) : 0;
  const percentage = (value) => Math.max(0, Math.min(100, number(value)));
  const label = (value) =>
    String(value || "unknown")
      .replaceAll("-", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  let refreshTimer = null;
  let config = { refreshMs: 5000, dataUrl: "../content/dashboard/data.json" };
  let active = false;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const bar = (name, value) => {
    const row = element("div", "bar-row");
    const title = element("span", "", label(name));
    const track = element("span", "bar");
    const fill = element("i");
    fill.style.width = `${percentage(value)}%`;
    track.append(fill);
    row.append(title, track, element("strong", "", Math.round(number(value))));
    return row;
  };
  const statusItems = (values) =>
    Object.entries(values || {}).map(([name, value]) => {
      const item = element("div", "status-item");
      item.append(
        element("strong", "", number(value)),
        element("span", "", label(name)),
      );
      return item;
    });

  function model(data) {
    const outputs = data?.outputs || {};
    const dashboard =
      outputs["dashboard-refresh"] || data?.dashboard || data || {};
    const completedStages = data?.completedStages || [];
    const currentStage = data?.currentStage || null;
    const qualityReports =
      outputs["knowledge-quality"] ||
      dashboard.knowledgeQuality?.reports ||
      data?.qualityReports ||
      [];
    const averageQuality = qualityReports.length
      ? qualityReports.reduce(
          (sum, report) => sum + number(report.totalScore),
          0,
        ) / qualityReports.length
      : number(
          dashboard.knowledgeQuality?.averageScore ||
            dashboard.overall?.averageKnowledgeQuality,
        );
    return {
      raw: data,
      dashboard,
      outputs,
      completedStages,
      currentStage,
      status: data?.status || "idle",
      progress: number(
        data?.progressPercentage ||
          dashboard.overall?.productionCompletionPercentage,
      ),
      jobs: data?.jobs || dashboard.jobQueue?.jobList || [],
      jobStats: dashboard.jobQueue || data?.jobQueue || {},
      research:
        outputs["research-queue"]?.statistics ||
        dashboard.researchQueue ||
        data?.researchQueue ||
        {},
      reviews: dashboard.humanReview || data?.humanReview || {},
      validation:
        outputs["batch-validation"] ||
        dashboard.batchValidation ||
        data?.batchValidation ||
        {},
      importData:
        outputs["safe-import"] ||
        dashboard.safeImport ||
        data?.safeImport ||
        {},
      qualityReports,
      averageQuality,
    };
  }

  function renderPipeline(view) {
    const completed = new Set(view.completedStages);
    const failedStage = view.status === "failed" ? view.currentStage : null;
    byId("pipeline").replaceChildren(
      ...STAGES.map(([id, name], index) => {
        const item = element(
          "li",
          `stage${completed.has(id) ? " completed" : ""}${view.currentStage === id ? " active" : ""}${failedStage === id ? " failed" : ""}`,
        );
        item.dataset.stage = id;
        item.append(
          element("span", "stage-number", completed.has(id) ? "✓" : index + 1),
          element("strong", "", name),
          element(
            "small",
            "",
            completed.has(id)
              ? "Complete"
              : view.currentStage === id
                ? "In progress"
                : failedStage === id
                  ? "Failed"
                  : "Pending",
          ),
        );
        return item;
      }),
    );
    const count = completed.size;
    byId("stageCount").textContent = `${count} of ${STAGES.length} complete`;
  }

  function renderMetrics(view) {
    const dashboard = view.dashboard;
    const metrics = [
      ["Jobs", view.jobStats.total || view.jobs.length],
      ["Drafts", dashboard.draftGenerator?.draftsGenerated || 0],
      ["Research verified", `${number(view.research.verifiedPercentage)}%`],
      ["Reviews approved", view.reviews.byStatus?.approved || 0],
      ["Validated batches", dashboard.batchValidation?.passed || 0],
      ["Imported records", dashboard.safeImport?.recordsImported || 0],
    ];
    byId("metrics").replaceChildren(
      ...metrics.map(([name, value]) => {
        const card = element("div", "metric-card");
        card.append(element("strong", "", value), element("span", "", name));
        return card;
      }),
    );
  }

  function renderJobs(view) {
    const jobs = view.jobs;
    byId("jobCount").textContent = String(
      number(view.jobStats.total || jobs.length),
    );
    byId("jobs").replaceChildren(
      ...jobs.map((job) => {
        const row = element("tr");
        const status = element("span", "status-pill", job.status);
        const statusCell = element("td");
        statusCell.append(status);
        row.append(
          element("td", "", job.title || job.id),
          statusCell,
          element("td", "", label(job.priority)),
          element(
            "td",
            "",
            job.updatedAt ? new Date(job.updatedAt).toLocaleString() : "—",
          ),
        );
        return row;
      }),
    );
    byId("jobsEmpty").hidden = jobs.length > 0;
  }

  function renderResearch(view) {
    const values = view.research.byStatus || {};
    const total = number(view.research.total);
    byId("researchCount").textContent = String(total);
    byId("researchStatuses").replaceChildren(
      ...Object.entries(values).map(([name, value]) =>
        bar(name, total ? (number(value) / total) * 100 : 0),
      ),
    );
  }

  function renderReview(view) {
    byId("reviewCount").textContent = String(number(view.reviews.totalCases));
    byId("reviewStatuses").replaceChildren(
      ...statusItems(view.reviews.byStatus || {}),
    );
  }

  function renderValidation(view) {
    const validation = view.validation;
    const valid =
      validation.validForPublishing ??
      (number(validation.passed) > 0 && number(validation.failed) === 0);
    const badge = byId("validationBadge");
    badge.textContent =
      valid === true ? "Passed" : valid === false ? "Blocked" : "No report";
    badge.className = `badge${valid === true ? " passed" : valid === false ? " failed" : ""}`;
    const findings = validation.findings || {};
    byId("validationFindings").replaceChildren(
      ...statusItems(
        Array.isArray(findings)
          ? findings.reduce((values, item) => {
              values[item.severity] = (values[item.severity] || 0) + 1;
              return values;
            }, {})
          : findings,
      ).map((item) => {
        item.className = "finding";
        return item;
      }),
    );
  }

  function renderImport(view) {
    const value = view.importData;
    const count = number(value.imports || (value.importId ? 1 : 0));
    byId("importCount").textContent = String(count);
    const details = [
      [
        "Latest import",
        value.latestImport?.importId || value.importId || "None",
      ],
      [
        "Records",
        value.recordsImported || value.importedRecordIds?.length || 0,
      ],
      ["Runtime before", value.runtimeCountBefore ?? "—"],
      [
        "Runtime after",
        value.runtimeCountAfter ?? value.latestImport?.runtimeCountAfter ?? "—",
      ],
      ["Indexes", value.indexesUpdated ? "Updated" : "—"],
    ];
    byId("importDetails").replaceChildren(
      ...details.flatMap(([name, detail]) => [
        element("dt", "", name),
        element("dd", "", detail),
      ]),
    );
  }

  function renderQuality(view) {
    const score = Math.round(percentage(view.averageQuality));
    byId("qualityScore").textContent = String(score);
    byId("qualityRing").style.setProperty("--score", score);
    const report = view.qualityReports.at(-1);
    byId("qualityBand").textContent = report
      ? label(report.band)
      : "Not scored";
    byId("qualityDetail").textContent = report
      ? `${report.recommendations?.length || 0} improvement recommendations`
      : "No quality reports available.";
    byId("qualityCategories").replaceChildren(
      ...Object.entries(report?.categories || {}).map(([name, value]) =>
        bar(name, value.score),
      ),
    );
  }

  function renderDashboard(view) {
    const dashboard = view.dashboard;
    const values = [
      ["Planned topics", dashboard.overall?.plannedTopics || 0],
      ["Completed jobs", dashboard.overall?.completedJobs || 0],
      ["Backups", dashboard.backupRollback?.snapshots || 0],
      ["Rollbacks", dashboard.backupRollback?.automaticRollbacks || 0],
      ["Quality average", Math.round(view.averageQuality)],
      ["Cycle progress", `${Math.round(view.progress)}%`],
      ["Runtime entries", dashboard.runtime_entries || 0],
      ["Broken references", dashboard.broken_references || 0],
    ];
    byId("dashboardMetrics").replaceChildren(
      ...values.map(([name, value]) => {
        const item = element("div", "dashboard-item");
        item.append(element("strong", "", value), element("span", "", name));
        return item;
      }),
    );
  }

  function render(data) {
    const view = model(data);
    const progress = percentage(view.progress);
    byId("overallProgress").setAttribute("aria-valuenow", String(progress));
    byId("overallProgress").firstElementChild.style.width = `${progress}%`;
    byId("progressValue").textContent = `${Math.round(progress)}%`;
    byId("cycleStatus").textContent = label(view.status);
    byId("lastUpdated").textContent = new Date(
      data?.completedAt || data?.generatedAt || Date.now(),
    ).toLocaleString();
    renderPipeline(view);
    renderMetrics(view);
    renderJobs(view);
    renderResearch(view);
    renderReview(view);
    renderValidation(view);
    renderImport(view);
    renderQuality(view);
    renderDashboard(view);
    return view;
  }

  async function refresh({ announce = true } = {}) {
    try {
      const response = await fetch(config.dataUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(await response.json());
      if (announce)
        byId("studioStatus").textContent =
          `Production data refreshed. Next automatic refresh in ${Math.round(config.refreshMs / 1000)} seconds.`;
    } catch (error) {
      byId("studioStatus").textContent =
        `Production data unavailable: ${error.message}. The Studio remains read-only.`;
    }
  }

  async function startProduction() {
    active = true;
    document.body.dataset.active = "true";
    byId("modeLabel").textContent = "Monitoring active";
    byId("startButton").disabled = true;
    byId("startButton").textContent = "Production requested";
    const detail = { requestedAt: new Date().toISOString() };
    window.dispatchEvent(
      new CustomEvent("emcp:production-start-request", { detail }),
    );
    if (config.startEndpoint) {
      try {
        const response = await fetch(config.startEndpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(detail),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        byId("studioStatus").textContent =
          "Production start request accepted. Monitoring live progress.";
      } catch (error) {
        byId("studioStatus").textContent =
          `Start request failed: ${error.message}. No production data was changed by Studio.`;
      }
    } else {
      byId("studioStatus").textContent =
        "Production start event emitted for the local Orchestrator host. Studio itself remains read-only.";
    }
    await refresh({ announce: false });
  }

  async function initialize() {
    try {
      const response = await fetch("../config/runtime.json", {
        cache: "no-store",
      });
      if (response.ok) {
        const runtime = await response.json();
        config = { ...config, ...(runtime.productionStudio || {}) };
      }
    } catch {
      // Safe local defaults keep the read-only page usable.
    }
    render({ status: "idle", completedStages: [], progressPercentage: 0 });
    await refresh();
    refreshTimer = window.setInterval(
      () => refresh({ announce: false }),
      Math.max(2000, number(config.refreshMs)),
    );
  }

  byId("refreshButton").addEventListener("click", () => refresh());
  byId("startButton").addEventListener("click", startProduction);
  window.addEventListener("pagehide", () => window.clearInterval(refreshTimer));
  window.EMCPProductionStudio = {
    render,
    refresh,
    isActive: () => active,
    stages: STAGES.map(([id]) => id),
  };
  initialize();
})();
