(function (global) {
  "use strict";

  const modal = document.getElementById("modal");
  const sheet = document.getElementById("sheet");
  let returnFocus = null;
  const focusableSelector =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function reducedMotion() {
    return !!global.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }
  function closeLabel() {
    return document.documentElement.lang === "tr"
      ? "Pencereyi kapat"
      : "Close dialog";
  }
  function focusable() {
    return [...sheet.querySelectorAll(focusableSelector)].filter(
      (element) =>
        !element.hidden && element.getAttribute("aria-hidden") !== "true",
    );
  }

  function showModal() {
    if (!modal || !sheet) return;
    if (!modal.classList.contains("show")) returnFocus = document.activeElement;
    const heading = sheet.querySelector("h2");
    if (heading) {
      heading.id = "modalTitle";
      heading.setAttribute("tabindex", "-1");
    }
    const close = sheet.querySelector(".close");
    if (close) close.setAttribute("aria-label", closeLabel());
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    global.requestAnimationFrame(() => {
      (close || heading || sheet).focus({ preventScroll: true });
    });
  }

  function hideModal() {
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    const target = returnFocus;
    returnFocus = null;
    global.onEMCPModalClose?.();
    if (target && target.focus && target.isConnected !== false)
      target.focus({ preventScroll: true });
  }

  function handleKeydown(event) {
    if (!modal?.classList.contains("show")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      hideModal();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable();
    if (!items.length) {
      event.preventDefault();
      sheet.focus();
      return;
    }
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function scrollToTop() {
    global.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  }
  function scrollIntoView(element, options = {}) {
    element?.scrollIntoView({
      ...options,
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }

  modal?.addEventListener("keydown", handleKeydown);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) hideModal();
  });
  global.EMCPAccessibility = {
    showModal,
    hideModal,
    reducedMotion,
    scrollToTop,
    scrollIntoView,
  };
  global.showModal = showModal;
  global.hideModal = hideModal;
})(window);
