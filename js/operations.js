(function (global) {
  "use strict";
  const core = global.EMCPCore,
    STORAGE_KEY = "emcpProductMetrics",
    ERROR_KEY = "emcpDiagnostics",
    defaults = {
      releaseChannel: "stable",
      flags: {
        workerSearch: true,
        virtualResults: true,
        preloadFeatures: false,
        localAnalytics: true,
        performanceMonitoring: true,
      },
    };
  let configuration = defaults,
    adapter = null;
  const cleanName = (value) =>
    String(value || "unknown")
      .replace(/[^a-z0-9_-]/gi, "_")
      .slice(0, 80);
  const day = () => new Date().toISOString().slice(0, 10);

  function track(name) {
    if (!configuration.flags.localAnalytics) return false;
    const event = cleanName(name),
      metrics = core.storage.get(STORAGE_KEY, { version: 1, days: {} });
    metrics.version = 1;
    metrics.days ||= {};
    metrics.days[day()] ||= {};
    metrics.days[day()][event] = Math.min(
      1_000_000,
      (Number(metrics.days[day()][event]) || 0) + 1,
    );
    const dates = Object.keys(metrics.days).sort();
    dates
      .slice(0, Math.max(0, dates.length - 30))
      .forEach((date) => delete metrics.days[date]);
    core.storage.set(STORAGE_KEY, metrics);
    adapter?.event?.({
      name: event,
      releaseChannel: configuration.releaseChannel,
    });
    return true;
  }
  function recordError(type, message) {
    const diagnostics = core.storage.get(ERROR_KEY, []),
      safe = {
        type: cleanName(type),
        message: String(message || "Unknown error")
          .replace(/https?:\/\/\S+/g, "[url]")
          .slice(0, 300),
        at: new Date().toISOString(),
      };
    core.storage.set(ERROR_KEY, [...diagnostics.slice(-19), safe]);
    adapter?.error?.(safe);
  }
  function snapshot() {
    return {
      metrics: core.storage.get(STORAGE_KEY, { version: 1, days: {} }),
      diagnostics: core.storage.get(ERROR_KEY, []),
      releaseChannel: configuration.releaseChannel,
      flags: { ...configuration.flags },
    };
  }
  function clear() {
    core.storage.remove(STORAGE_KEY);
    core.storage.remove(ERROR_KEY);
  }
  function setAdapter(next) {
    adapter = next && typeof next === "object" ? next : null;
  }

  global.addEventListener("error", (event) =>
    recordError("error", event.message),
  );
  global.addEventListener("unhandledrejection", (event) =>
    recordError("promise", event.reason?.message || event.reason),
  );
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button,[data-workspace]");
    if (!button) return;
    if (button.dataset.page) track(`page_${button.dataset.page}`);
    if (button.dataset.openTerm !== undefined) track("knowledge_open");
    if (button.dataset.calculate) track("calculator_complete");
    if (button.dataset.workspace) track("workspace_open");
    if (button.id === "exportWorkspace") track("workspace_export");
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id === "assistantForm") track("assistant_question");
  });
  global.addEventListener("load", () => {
    track("app_open");
    if (
      configuration.flags.performanceMonitoring &&
      global.PerformanceObserver
    ) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            adapter?.performance?.({
              name: cleanName(entry.name || entry.entryType),
              duration: Math.round(entry.duration || 0),
              releaseChannel: configuration.releaseChannel,
            });
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        /* unsupported performance entry type */
      }
    }
  });
  fetch("config/runtime.json", { credentials: "same-origin" })
    .then((response) => (response.ok ? response.json() : defaults))
    .then((value) => {
      configuration = core.schemas.runtimeConfig(value);
      document.documentElement.dataset.releaseChannel =
        configuration.releaseChannel;
    })
    .catch(() => {});

  global.EMCPOperations = {
    track,
    snapshot,
    clear,
    setAdapter,
    get flags() {
      return configuration.flags;
    },
    get releaseChannel() {
      return configuration.releaseChannel;
    },
  };
})(window);
