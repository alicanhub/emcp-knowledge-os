(function (global) {
  "use strict";
  const language =
    global.EMCPCore.storage.getRaw("emcpLang") === "en" ? "en" : "tr";
  document.documentElement.lang = language;
  document.querySelector(".tr").hidden = language !== "tr";
  document.querySelector(".en").hidden = language !== "en";
  document
    .querySelectorAll("[data-retry]")
    .forEach((button) =>
      button.addEventListener("click", () => global.location.reload()),
    );
})(window);
