(function (global) {
  "use strict";
  const states = new WeakMap();

  function clear(container) {
    const state = states.get(container);
    state?.observer?.disconnect();
    states.delete(container);
    container.replaceChildren();
  }

  function render(container, items, { empty = "", batchSize = 30 } = {}) {
    clear(container);
    if (!items.length) {
      container.innerHTML = empty;
      return;
    }
    const state = { index: 0, observer: null };
    const sentinel = document.createElement("div");
    sentinel.className = "virtual-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    const append = () => {
      const end = Math.min(state.index + batchSize, items.length),
        template = document.createElement("template");
      template.innerHTML = items.slice(state.index, end).join("");
      container.insertBefore(template.content, sentinel);
      state.index = end;
      if (state.index >= items.length) {
        state.observer?.disconnect();
        sentinel.remove();
      }
    };
    container.appendChild(sentinel);
    append();
    if (sentinel.isConnected && global.IntersectionObserver) {
      state.observer = new IntersectionObserver(
        (records) => {
          if (records.some((record) => record.isIntersecting)) append();
        },
        { rootMargin: "600px" },
      );
      state.observer.observe(sentinel);
    } else while (state.index < items.length) append();
    states.set(container, state);
  }

  global.EMCPVirtualList = { render, clear };
})(window);
