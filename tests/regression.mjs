import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html"),
  css = read("css/styles.css"),
  tokens = read("css/tokens.css"),
  components = read("css/components.css"),
  app = read("js/app.js");
const quietConsole = { warn() {}, error() {}, log() {} };
function installCore(context) {
  context.window = context;
  if (!context.localStorage) {
    const values = new Map();
    context.localStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    };
  } else if (!context.localStorage.removeItem)
    context.localStorage.removeItem = () => {};
  vm.runInNewContext(read("js/core.js"), context);
  vm.runInNewContext(read("js/search-engine.js"), context);
  return context.EMCPCore;
}

// Syntax and shipped asset integrity.
const scripts = [
  "js/core.js",
  "js/search-engine.js",
  "js/knowledge.js",
  "js/calculator-model.js",
  "js/dom.js",
  "js/accessibility.js",
  "js/virtual-list.js",
  "js/operations.js",
  "js/features.js",
  "js/ai-guard.js",
  "js/search-worker.js",
  "js/app.js",
  "js/handbook.js",
  "js/assistant.js",
  "js/calculators.js",
  "js/i18n.js",
  "js/offline.js",
  "js/pwa.js",
  "js/workspace.js",
  "service-worker.js",
];
scripts.forEach((file) =>
  assert.doesNotThrow(() => new vm.Script(read(file), { filename: file })),
);
const sw = read("service-worker.js");
const build = read("scripts/build.mjs");
const vercel = JSON.parse(read("vercel.json"));
assert.equal(vercel.buildCommand, "npm run build");
assert.equal(vercel.outputDirectory, "dist");
const coreLiteral = sw.match(/const CORE_PATHS\s*=\s*(\[[\s\S]*?\]);/)[1];
const coreAssets = JSON.parse(coreLiteral.replace(/,\s*]$/, "]"));
coreAssets
  .filter((file) => file !== "./")
  .forEach((file) =>
    assert.ok(
      fs.existsSync(path.join(root, file)),
      `missing cached asset: ${file}`,
    ),
  );
assert.match(sw, /CACHE_PREFIX\}v26/);
assert.match(sw, /caches\.match\(OFFLINE_URL\)/);
assert.match(sw, /url\.pathname\.endsWith\(["']\.json["']\)/);
assert.ok(coreAssets.includes("js/core.js"));
assert.ok(coreAssets.includes("js/search-engine.js"));
assert.ok(coreAssets.includes("js/knowledge.js"));
assert.ok(coreAssets.includes("js/calculator-model.js"));
assert.ok(coreAssets.includes("js/dom.js"));
assert.ok(coreAssets.includes("js/accessibility.js"));
assert.ok(coreAssets.includes("css/tokens.css"));
assert.ok(coreAssets.includes("css/components.css"));
assert.ok(coreAssets.includes("js/search-worker.js"));
assert.ok(coreAssets.includes("data/knowledge/search-index.json"));
assert.ok(coreAssets.includes("data/knowledge/relationships.json"));
assert.ok(coreAssets.includes("data/knowledge/details.json"));
assert.ok(coreAssets.includes("config/runtime.json"));
assert.match(build, /["']config["']/);
assert.match(build, /destination, ["']config\/runtime\.json["']/);
assert.doesNotMatch(
  build,
  /^\s*["'](?:content|admin)["'],?\s*$/m,
  "Production builds must not copy complete content or admin trees",
);
for (const runtimeContentPath of [
  "content/handbooks/investor/handbook.json",
  "content/handbooks/investor/chapters.json",
  "content/checklists/investor-checklists.json",
  "content/case-studies/investor-case-studies.json",
  "content/document-guides/property-purchase-documents.json",
]) {
  assert.match(
    build,
    new RegExp(runtimeContentPath.replaceAll("/", "\\/")),
    `${runtimeContentPath} must be included in the production allowlist`,
  );
}
assert.ok(coreAssets.includes("js/handbook.js"));
assert.ok(coreAssets.includes("content/handbooks/investor/handbook.json"));
assert.ok(coreAssets.includes("content/handbooks/investor/chapters.json"));

const handbook = JSON.parse(read("content/handbooks/investor/handbook.json"));
const chapters = JSON.parse(read("content/handbooks/investor/chapters.json"));
const roadmap = JSON.parse(
  read("content/roadmaps/master-content-roadmap.json"),
);
assert.equal(handbook.id, "handbook.property-investor");
assert.equal(handbook.chapters.length + handbook.planned_chapters.length, 40);
assert.equal(chapters.length, 30);
assert.ok(chapters.every((chapter) => chapter.review_status === "draft"));
assert.equal(roadmap.packs.length, 100);
assert.equal(roadmap.packs[0].pack_number, 1);
assert.equal(roadmap.packs[1].title.en, "Residential Property Fundamentals");
assert.equal(roadmap.packs[2].title.en, "Property Investor Fundamentals");

// Service-worker install and offline routing: navigation falls back to the app,
// while missing JSON rejects instead of ever receiving HTML.
{
  const listeners = {},
    stored = new Map();
  const response = (url, type = "basic") => ({
    url,
    ok: true,
    type,
    clone() {
      return response(url, type);
    },
  });
  const caches = {
    async open() {
      return {
        async addAll(urls) {
          urls.forEach((url) => stored.set(String(url), response(String(url))));
        },
        async put(request, value) {
          stored.set(String(request.url || request), value);
        },
      };
    },
    async match(request) {
      return stored.get(String(request.url || request));
    },
    async keys() {
      return ["emcp-os-v18", "emcp-os-v19"];
    },
    async delete() {
      return true;
    },
  };
  const self = {
    registration: { scope: "https://example.test/apps/emcp/" },
    location: { origin: "https://example.test" },
    clients: { claim: async () => {} },
    skipWaiting() {},
    addEventListener: (type, handler) => (listeners[type] = handler),
  };
  const context = {
    self,
    caches,
    fetch: async () => {
      throw new Error("offline");
    },
    URL,
    Promise,
    console,
  };
  vm.runInNewContext(sw, context);
  let pending;
  listeners.install({ waitUntil: (promise) => (pending = promise) });
  await pending;
  assert.ok(stored.has("https://example.test/apps/emcp/index.html"));
  let routed;
  listeners.fetch({
    request: {
      method: "GET",
      url: "https://example.test/apps/emcp/deep/link",
      mode: "navigate",
      destination: "document",
    },
    respondWith: (promise) => (routed = promise),
  });
  assert.equal((await routed).url, "https://example.test/apps/emcp/index.html");
  listeners.fetch({
    request: {
      method: "GET",
      url: "https://example.test/apps/emcp/data/missing.json",
      mode: "same-origin",
      destination: "",
    },
    respondWith: (promise) => (routed = promise),
  });
  await assert.rejects(routed, /offline/);
}

// Knowledge and bilingual data remain complete and aligned.
const index = JSON.parse(read("data/knowledge/index.json"));
const details = JSON.parse(read(`data/knowledge/${index.details}`));
assert.equal(details.version, 2);
assert.equal(Object.keys(details.entries).length, 378);
assert.ok(details.entries.LTV.simpleExplanation.en);
assert.equal(details.entries.LTV.revisionHistory.length > 0, true);
const entries = index.categories.flatMap(({ file }) =>
  JSON.parse(read(`data/knowledge/${file}`)),
);
const english = JSON.parse(read(`data/knowledge/${index.translations}`));
assert.equal(entries.length, 378);
assert.equal(new Set(entries.map((entry) => entry.term)).size, 378);
assert.deepEqual(
  Object.keys(english).sort(),
  entries.map((entry) => entry.term).sort(),
);
entries.forEach((entry) => {
  assert.ok(entry.def && entry.use && entry.cat);
  assert.ok(english[entry.term].defEn && english[entry.term].useEn);
});

// Shared schemas reject hostile shapes and safely recover malformed storage.
{
  const context = { console: quietConsole };
  const core = installCore(context);
  context.localStorage.setItem("broken", "{not json");
  assert.equal(core.storage.get("broken", [], core.stringList).length, 0);
  assert.equal(
    JSON.stringify(core.stringList(["LTV", "LTV", 7, "<img>"])),
    JSON.stringify(["LTV", "<img>"]),
  );
  assert.equal(
    core.schemas.scenarios([
      {
        id: "safe",
        name: "Safe",
        inputs: {
          dealName: "A",
          dealLoan: 1,
          dealPropertyValue: 2,
          dealCost: 2,
          dealGdv: 3,
          dealRent: 1,
        },
        createdAt: "bad",
        updatedAt: "bad",
      },
      { id: "bad", name: "Bad", inputs: {} },
    ]).length,
    1,
  );
  assert.throws(
    () =>
      core.schemas.knowledgeIndex({ categories: [{ file: "../secret.json" }] }),
    /Unsafe/,
  );
  assert.doesNotMatch(
    core.sanitizeHTML("<img src=x onerror=alert(1)><p>Safe</p>"),
    /<(?:img|script|iframe)/i,
  );
  const unavailable = {
      console: quietConsole,
      localStorage: {
        getItem() {
          throw new Error("blocked");
        },
        setItem() {
          throw new Error("blocked");
        },
        removeItem() {
          throw new Error("blocked");
        },
      },
    },
    fallback = installCore(unavailable);
  assert.equal(fallback.storage.set("safe", { value: 1 }), true);
  assert.equal(fallback.storage.get("safe", {}).value, 1);
}

// Knowledge loading validates paths, category membership, duplicates and search.
{
  const context = { console, fetch: async () => {} };
  const core = installCore(context);
  vm.runInNewContext(read("js/knowledge.js"), context);
  const fetcher = async (url) => {
    const file = String(url).replace("data/knowledge/", "");
    return {
      ok: true,
      json: async () => JSON.parse(read(`data/knowledge/${file}`)),
    };
  };
  assert.equal((await context.EMCPKnowledge.load({ fetcher })).length, 378);
  assert.equal(
    context.EMCPKnowledge.search("loan to value")[0].entry.term,
    "LTV",
  );
  assert.throws(
    () => context.EMCPKnowledge.setEntries([{ term: "broken" }]),
    /Incomplete/,
  );
  assert.ok(core.schemas.knowledgeEntries(entries).length === 378);
}

// Semantic structure and accessible control states.
assert.match(html, /<a class="skip-link" href="#mainContent"/);
assert.match(html, /<main id="mainContent" tabindex="-1">/);
assert.match(
  html,
  /role="dialog"\s+aria-modal="true"\s+aria-hidden="true"\s+aria-labelledby="modalTitle"/,
);
assert.match(html, /role="tablist"/);
assert.equal((html.match(/role="tab"/g) || []).length, 5);
assert.equal(
  (html.match(/<button type="button" class="module live"/g) || []).length,
  6,
);
assert.doesNotMatch(html, /<div class="module live"/);
assert.doesNotMatch(html, /\son(?:click|change|input)=/i);
assert.match(html, /Content-Security-Policy/);
assert.match(html, /data-i18n-aria="languageSelector"/);
assert.match(html, /data-i18n-aria="knowledgeCategories"/);
assert.match(html, /data-i18n-aria="workspaceViews"/);
assert.match(html, /data-i18n-aria="primaryNavigation"/);
assert.doesNotMatch(
  read("offline.html"),
  /<(?:style|script)(?:\s|>)[^>]*>[^<]/i,
);
const pageScripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(
  (match) => match[1],
);
assert.ok(
  pageScripts.indexOf("js/core.js") < pageScripts.indexOf("js/i18n.js"),
);
assert.ok(
  pageScripts.indexOf("js/search-engine.js") <
    pageScripts.indexOf("js/knowledge.js"),
);
assert.ok(
  pageScripts.indexOf("js/knowledge.js") < pageScripts.indexOf("js/app.js"),
);
assert.ok(
  pageScripts.indexOf("js/features.js") < pageScripts.indexOf("js/app.js"),
);
assert.ok(!pageScripts.includes("js/calculators.js"));
assert.ok(!pageScripts.includes("js/assistant.js"));
assert.match(app, /<button type="button" class="card"/);
assert.match(app, /aria-pressed=/);
assert.match(read("js/calculators.js"), /label\.htmlFor\s*=\s*definition\.id/);
assert.match(
  read("js/workspace.js"),
  /ArrowLeft[\s\S]*ArrowRight[\s\S]*Home[\s\S]*End/,
);
assert.match(read("js/assistant.js"), /aria-busy/);
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "duplicate static IDs");

// Focus, reduced motion, forced colours and responsive breakpoints.
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(css, /forced-colors:active/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /@media\(max-width:480px\)/);
assert.match(css, /font-size:16px/);
assert.match(css, /body\.modal-open/);
assert.match(tokens, /--target-min:\s*2\.75rem/);
assert.match(tokens, /color-scheme:\s*dark/);
assert.match(components, /button\):disabled/);
assert.match(components, /\[aria-invalid="true"\]/);
assert.match(components, /prefers-reduced-motion:\s*reduce/);

const luminance = (hex) => {
  const rgb = hex
    .match(/[a-f\d]{2}/gi)
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
assert.ok(contrast("#667085", "#ffffff") >= 4.5, "light muted text contrast");
assert.ok(contrast("#a8b3c4", "#0e1b2c") >= 4.5, "dark muted text contrast");
assert.ok(contrast("#ffffff", "#012169") >= 4.5, "primary button contrast");
assert.ok(contrast("#ffffff", "#C8102E") >= 4.5, "red button contrast");

// Modal keyboard behavior: initial focus, Tab wrap, Escape close and restoration.
{
  const listeners = {},
    bodyClasses = new Set(),
    modalClasses = new Set();
  const makeFocus = () => ({
    hidden: false,
    attrs: {},
    isConnected: true,
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    getAttribute(k) {
      return this.attrs[k];
    },
    focus() {
      document.activeElement = this;
    },
  });
  const opener = makeFocus(),
    close = makeFocus(),
    heading = makeFocus(),
    last = makeFocus();
  const document = {
    activeElement: opener,
    documentElement: { lang: "en" },
    body: {
      classList: {
        add: (v) => bodyClasses.add(v),
        remove: (v) => bodyClasses.delete(v),
      },
    },
    getElementById: (id) => (id === "modal" ? modal : sheet),
  };
  const sheet = {
    querySelector: (s) =>
      s === "h2" ? heading : s === ".close" ? close : null,
    querySelectorAll: () => [close, last],
    focus() {
      document.activeElement = this;
    },
  };
  const modal = {
    classList: {
      contains: (v) => modalClasses.has(v),
      add: (v) => modalClasses.add(v),
      remove: (v) => modalClasses.delete(v),
    },
    setAttribute() {},
    addEventListener: (type, handler) => (listeners[type] = handler),
  };
  const context = {
    window: null,
    document,
    requestAnimationFrame: (fn) => fn(),
    matchMedia: () => ({ matches: true }),
    scrollTo() {},
  };
  context.window = context;
  vm.runInNewContext(read("js/accessibility.js"), context);
  context.showModal();
  assert.equal(document.activeElement, close);
  assert.ok(bodyClasses.has("modal-open"));
  document.activeElement = last;
  let prevented = false;
  listeners.keydown({
    key: "Tab",
    shiftKey: false,
    preventDefault() {
      prevented = true;
    },
  });
  assert.ok(prevented);
  assert.equal(document.activeElement, close);
  listeners.keydown({ key: "Escape", preventDefault() {} });
  assert.equal(document.activeElement, opener);
  assert.ok(!modalClasses.has("show"));
  assert.equal(context.EMCPAccessibility.reducedMotion(), true);
}

// Bilingual state remains defensive and backward-compatible with raw preferences.
{
  const attributes = {};
  const context = {
    console: quietConsole,
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    dispatchEvent() {},
    document: {
      readyState: "loading",
      addEventListener() {},
      documentElement: {
        setAttribute: (key, value) => (attributes[key] = value),
      },
      querySelectorAll: () => [],
    },
  };
  installCore(context);
  vm.runInNewContext(read("js/i18n.js"), context);
  assert.equal(context.EMCPi18n.setLanguage("en"), "en");
  assert.equal(context.EMCPi18n.t("home"), "Home");
  assert.equal(attributes.lang, "en");
  assert.equal(context.EMCPi18n.setLanguage("unsupported"), "tr");
  assert.equal(context.EMCPi18n.t("home"), "Ana Sayfa");
}

// Calculator mathematics is independently testable without a browser DOM.
{
  const context = { window: null };
  context.window = context;
  vm.runInNewContext(read("js/calculator-model.js"), context);
  const model = context.EMCPCalculatorModel;
  assert.equal(model.ratio(700000, 1000000), 70);
  assert.equal(model.ratio(1, 0), null);
  assert.equal(model.monthlyPayment(500000, 6.5, 20).toFixed(2), "3727.87");
  assert.equal(model.tiles(35, 0.09, 10), 428);
  assert.equal(
    model.snapshot({
      dealLoan: 700000,
      dealPropertyValue: 1000000,
      dealCost: 900000,
      dealGdv: 1250000,
      dealRent: 60000,
    }).profit,
    350000,
  );
}

// All 15 enhanced calculators plus the combined deal snapshot retain expected outputs.
{
  const elements = new Map();
  const element = (value = "") => ({
    value: String(value),
    textContent: "",
    innerHTML: "",
    hidden: false,
    setAttribute() {},
    focus() {},
  });
  const context = {
    window: null,
    document: {
      readyState: "loading",
      addEventListener() {},
      getElementById: (id) => elements.get(id) || null,
    },
    localStorage: { getItem: () => null, setItem() {} },
    navigator: {},
    console: quietConsole,
    setTimeout,
    Intl,
    Map,
    CustomEvent: class {},
  };
  context.window = context;
  context.EMCPi18n = { language: "en" };
  installCore(context);
  vm.runInNewContext(read("js/calculator-model.js"), context);
  vm.runInNewContext(read("js/calculators.js"), context);
  const expected = {
    ltv: "70.00%",
    ltc: "66.67%",
    ltgdv: "60.00%",
    roi: "25.00%",
    yield: "6.00%",
    "development-profit": "£300,000 | 25.00% on cost",
    "monthly-payment": "£3,727.87",
    "arrangement-fee": "£11,250",
    "interest-rollup": "£108,000",
    concrete: "4.80 m³",
    paint: "57.60 m² total coating area",
    flooring: "44.00 m² incl. waste",
    plasterboard: "33 sheets",
    insulation: "105.00 m² incl. waste",
    tiles: "428 tiles",
  };
  assert.equal(context.EMCPCalculators.configurations.length, 15);
  context.EMCPCalculators.configurations.forEach((configuration) => {
    const values = Object.fromEntries(
      configuration.inputs.map((input) => [input.id, input.example]),
    );
    assert.equal(
      configuration.calculate(values).primary,
      expected[configuration.id],
      configuration.id,
    );
  });
  Object.entries({
    dealName: "Nottingham acquisition",
    dealLoan: 700000,
    dealPropertyValue: 1000000,
    dealCost: 900000,
    dealGdv: 1250000,
    dealRent: 60000,
  }).forEach(([id, value]) => elements.set(id, element(value)));
  ["dealErrors", "dealResults", "dealResultActions"].forEach((id) =>
    elements.set(id, element()),
  );
  const snapshot = context.EMCPCalculators.calculateSnapshot();
  assert.equal(snapshot.valid, true);
  assert.equal(snapshot.metrics.ltv, "70.00%");
  assert.equal(snapshot.metrics.profit, "£350,000");
  assert.equal(snapshot.metrics.equity, "£200,000");
  context.EMCPCore.storage.setRaw("emcpCalculatorScenarios", "{broken");
  assert.equal(context.EMCPCalculators.getScenarios().length, 0);
  context.EMCPCore.storage.set("emcpCalculatorScenarios", [
    {
      id: "valid",
      name: "Valid",
      inputs: {
        dealName: "",
        dealLoan: 1,
        dealPropertyValue: 2,
        dealCost: 2,
        dealGdv: 3,
        dealRent: 1,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { id: "invalid", name: "Invalid", inputs: {} },
  ]);
  assert.equal(context.EMCPCalculators.getScenarios().length, 1);
}

// Ask EMCP still retrieves local knowledge and exposes sources.
{
  const submit = {},
    output = {
      attrs: {},
      innerHTML: "",
      setAttribute(k, v) {
        this.attrs[k] = v;
      },
      querySelectorAll() {
        return [];
      },
    };
  const context = { window: null, console, setTimeout, document: {} };
  context.window = context;
  installCore(context);
  vm.runInNewContext(read("js/assistant.js"), context);
  const api = context.EMCPAssistant.create({
    form: {
      addEventListener(type, handler) {
        submit[type] = handler;
      },
    },
    questionInput: { value: "" },
    output,
    search: () => [
      {
        entry: {
          term: "LTV",
          tr: "Kredi / Değer",
          defEn: "Loan to value.",
          cat: "Finance",
        },
        index: 0,
        _s: 200,
      },
    ],
    getRelatedEntries: () => [],
    getRelatedCalculators: () => [],
    openEntry() {},
    getLanguage: () => "en",
  });
  const found = await api.ask("What is LTV?");
  assert.equal(found.found, true);
  assert.match(output.innerHTML, /Loan to value/);
  assert.equal(output.attrs["aria-busy"], "false");
  api.setProvider({
    generate: async () => "<img src=x onerror=alert(1)><p>Safe answer</p>",
  });
  await api.ask("LTV");
  assert.doesNotMatch(output.innerHTML, /<img/i);
  assert.match(output.innerHTML, /Safe answer/);
  api.clear();
  assert.equal(output.innerHTML, "");
}

// Personal workspace storage, collections, notes and export validation remain intact.
{
  const storage = new Map();
  const localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const context = {
    window: null,
    localStorage,
    console,
    crypto: { randomUUID: () => "collection-id" },
    document: {
      readyState: "loading",
      addEventListener() {},
      getElementById() {
        return null;
      },
      documentElement: { setAttribute() {} },
    },
    CustomEvent: class {},
    Blob: class {},
    URL: {},
    setTimeout,
    confirm: () => true,
  };
  context.window = context;
  context.EMCPi18n = { language: "en" };
  installCore(context);
  vm.runInNewContext(read("js/workspace.js"), context);
  assert.equal(
    context.EMCPWorkspace.createCollection("Due diligence").name,
    "Due diligence",
  );
  context.EMCPWorkspace.saveNote("knowledge", "LTV", "Review covenant");
  const backup = context.EMCPWorkspace.buildExport();
  assert.equal(backup.format, "emcp-workspace");
  assert.equal(backup.data.collections.length, 1);
  assert.equal(backup.data.notes["knowledge:LTV"], "Review covenant");
  assert.equal(
    context.EMCPWorkspace.validateImport(backup).collections[0].name,
    "Due diligence",
  );
  assert.throws(() =>
    context.EMCPWorkspace.validateImport({ format: "wrong" }),
  );
  assert.throws(() =>
    context.EMCPWorkspace.validateImport({
      format: "emcp-workspace",
      version: 1,
      data: {
        favourites: [],
        recent: [],
        collections: [],
        notes: {},
        scenarios: [{ id: "bad", name: "Bad", inputs: {} }],
      },
    }),
  );
}

// PWA root calculation remains safe when hosted below a subpath.
{
  const context = {
    window: null,
    URL,
    navigator: { standalone: false },
    console,
    setTimeout,
    clearTimeout,
    CustomEvent: class {},
    document: {
      scripts: [{ src: "https://example.test/apps/emcp/js/pwa.js" }],
      currentScript: null,
      baseURI: "https://example.test/apps/emcp/",
      readyState: "loading",
      addEventListener() {},
      getElementById() {
        return null;
      },
    },
  };
  context.window = context;
  vm.runInNewContext(read("js/pwa.js"), context);
  assert.equal(context.EMCPPWA.appRoot, "https://example.test/apps/emcp/");
}

// Manifest remains installable and subpath-safe.
const manifest = JSON.parse(read("manifest.webmanifest"));
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.equal(manifest.id, "./");
assert.equal(manifest.display, "standalone");
assert.ok(manifest.icons.some((icon) => icon.src === "icon.svg"));

console.log(
  `Regression passed: ${entries.length} knowledge entries, ${scripts.length} scripts, ${coreAssets.length} offline assets.`,
);
