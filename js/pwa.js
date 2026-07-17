(function (global) {
  "use strict";
  const i18n = global.EMCPi18n;
  const tr = () => i18n?.language === "tr";
  const pick = (english, turkish) => (tr() ? turkish : english);
  const script =
    [...document.scripts].find((item) =>
      /\/js\/pwa\.js(?:\?|$)/.test(item.src),
    ) || document.currentScript;
  const appRoot = new URL("../", script?.src || document.baseURI);
  let deferredPrompt = null,
    registration = null,
    waitingWorker = null,
    reloading = false,
    onlineTimer = null;

  const element = (id) => document.getElementById(id);
  const standalone = () =>
    global.matchMedia?.("(display-mode: standalone)").matches ||
    navigator.standalone === true;

  function refreshInstall() {
    const button = element("installBtn");
    if (!button) return;
    if (standalone()) {
      button.textContent = pick("App installed", "Uygulama yüklü");
      button.disabled = true;
      return;
    }
    button.disabled = false;
    if (deferredPrompt)
      button.textContent = pick(
        "Install EMCP Knowledge OS",
        "EMCP Knowledge OS’u yükle",
      );
    else
      button.textContent =
        i18n?.t("installButton") ||
        pick("Show installation instructions", "Kurulum talimatlarını göster");
  }

  async function promptInstall() {
    if (!deferredPrompt) {
      element("navHelp")?.click();
      return { outcome: "unavailable" };
    }
    const prompt = deferredPrompt;
    deferredPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    refreshInstall();
    return choice;
  }
  function handleInstall() {
    if (deferredPrompt) return promptInstall();
    element("navHelp")?.click();
  }

  function connection() {
    const status = element("connectionStatus");
    if (!status) return;
    clearTimeout(onlineTimer);
    if (!navigator.onLine) {
      status.hidden = false;
      status.classList.remove("online");
      status.textContent = pick(
        "You are offline. Cached knowledge, calculators and workspace data remain available.",
        "Çevrimdışısınız. Önbellekteki bilgiler, hesaplayıcılar ve çalışma alanı verileri kullanılabilir.",
      );
      return;
    }
    if (!status.hidden) {
      status.hidden = false;
      status.classList.add("online");
      status.textContent = pick("Back online.", "Yeniden çevrimiçisiniz.");
      onlineTimer = setTimeout(() => {
        status.hidden = true;
        status.classList.remove("online");
      }, 2500);
    } else status.hidden = true;
  }

  function refreshUpdateText() {
    const title = element("pwaUpdateTitle"),
      text = element("pwaUpdateText"),
      apply = element("applyUpdate"),
      dismiss = element("dismissUpdate");
    if (title) title.textContent = pick("Update available", "Güncelleme hazır");
    if (text)
      text.textContent = pick(
        "A new EMCP Knowledge OS version is ready.",
        "EMCP Knowledge OS’un yeni sürümü hazır.",
      );
    if (apply) apply.textContent = pick("Update now", "Şimdi güncelle");
    if (dismiss) dismiss.textContent = pick("Later", "Daha sonra");
  }
  function showUpdate(worker) {
    waitingWorker = worker || registration?.waiting || null;
    refreshUpdateText();
    const banner = element("pwaUpdate");
    if (banner) banner.hidden = false;
  }
  function dismissUpdate() {
    const banner = element("pwaUpdate");
    if (banner) banner.hidden = true;
  }
  function applyUpdate() {
    const worker = waitingWorker || registration?.waiting;
    if (worker) worker.postMessage({ type: "SKIP_WAITING" });
  }

  function observeRegistration(value) {
    registration = value;
    if (registration.waiting && navigator.serviceWorker.controller)
      showUpdate(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          showUpdate(worker);
      });
    });
    global.dispatchEvent(
      new CustomEvent("emcp:pwaready", {
        detail: { registration, scope: registration.scope },
      }),
    );
  }

  async function register() {
    if (!("serviceWorker" in navigator) || !global.isSecureContext) return null;
    try {
      const value = await navigator.serviceWorker.register(
        new URL("service-worker.js", appRoot),
        { scope: appRoot.pathname },
      );
      observeRegistration(value);
      return value;
    } catch (error) {
      console.error("Service worker registration failed:", error);
      return null;
    }
  }

  function initialize() {
    const hadController = Boolean(navigator.serviceWorker?.controller);
    global.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredPrompt = event;
      refreshInstall();
    });
    global.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      refreshInstall();
    });
    global.addEventListener("online", () => {
      connection();
      registration?.update?.();
    });
    global.addEventListener("offline", connection);
    global.addEventListener("emcp:languagechange", () => {
      refreshInstall();
      connection();
      refreshUpdateText();
    });
    element("applyUpdate")?.addEventListener("click", applyUpdate);
    element("dismissUpdate")?.addEventListener("click", dismissUpdate);
    element("installBtn")?.addEventListener("click", handleInstall);
    navigator.serviceWorker?.addEventListener("controllerchange", () => {
      if (hadController && !reloading) {
        reloading = true;
        global.location.reload();
      }
    });
    refreshInstall();
    connection();
    register();
  }

  const api = {
    initialize,
    register,
    promptInstall,
    applyUpdate,
    dismissUpdate,
    showUpdate,
    refreshInstall,
    connection,
    checkForUpdate: () => registration?.update?.(),
    get appRoot() {
      return appRoot.href;
    },
    get registration() {
      return registration;
    },
    get deferredPrompt() {
      return deferredPrompt;
    },
  };
  global.EMCPPWA = api;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})(window);
