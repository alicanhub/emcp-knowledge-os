"use strict";
/* global importScripts */

importScripts("search-engine.js");
let searchable = self.EMCPBilingualSearch.create([]);
self.addEventListener("message", (event) => {
  if (event.data?.type === "index") {
    searchable = self.EMCPBilingualSearch.create(event.data.entries || []);
    return;
  }
  if (event.data?.type !== "search") return;
  self.postMessage({
    id: event.data.id,
    results: searchable.search(
      event.data.query,
      event.data.categoryAliases || {},
    ),
  });
});
