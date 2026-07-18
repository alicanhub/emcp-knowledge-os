(function (global) {
  "use strict";
  const definitions = {
      assistant: [
        "js/ai-guard.js",
        "js/assistant-engine.js",
        "js/assistant.js",
      ],
      calculators: ["js/calculators.js"],
      construction: ["js/calculators.js"],
      handbooks: ["js/handbook.js"],
    },
    scripts = new Map(),
    features = new Map();

  function loadScript(source) {
    if (scripts.has(source)) return scripts.get(source);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.defer = true;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error(`Unable to load ${source}`)),
        { once: true },
      );
      document.head.appendChild(script);
    });
    const retryable = promise.catch((error) => {
      if (scripts.get(source) === retryable) scripts.delete(source);
      throw error;
    });
    scripts.set(source, retryable);
    return retryable;
  }

  function load(name) {
    if (!definitions[name]) return Promise.resolve();
    if (!features.has(name)) {
      const promise = definitions[name].reduce(
          (chain, source) => chain.then(() => loadScript(source)),
          Promise.resolve(),
        ),
        retryable = promise.catch((error) => {
          if (features.get(name) === retryable) features.delete(name);
          throw error;
        });
      features.set(name, retryable);
    }
    return features.get(name);
  }
  const has = (name) => Boolean(definitions[name]);
  const idle =
    global.requestIdleCallback ||
    ((callback) => global.setTimeout(callback, 1500));
  idle(() => {
    if (global.EMCPOperations?.flags?.preloadFeatures) {
      load("assistant");
      load("calculators");
    }
  });
  global.EMCPFeatures = { load, has };
})(window);
