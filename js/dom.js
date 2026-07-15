(function (global) {
  "use strict";
  const get = (id) => document.getElementById(id);
  const requireElement = (id) => {
    const element = get(id);
    if (!element) throw new Error(`Required UI element not found: #${id}`);
    return element;
  };
  const collect = (ids, { required = true } = {}) =>
    Object.fromEntries(
      ids.map((id) => [id, required ? requireElement(id) : get(id)]),
    );
  global.EMCPDOM = { get, require: requireElement, collect };
})(window);
