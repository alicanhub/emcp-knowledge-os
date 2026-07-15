"use strict";
(async () => {
  const status = document.querySelector("#status");
  try {
    const response = await fetch("../content/dashboard/data.json", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const metrics = [
      ["Runtime entries", data.runtime_entries],
      ["Reviewed", data.reviewed_entries],
      ["Drafts", data.draft_entries],
      ["Rejected", data.rejected_entries],
      ["Completed packs", data.completed_packs],
      ["Active packs", data.active_packs],
      ["Source coverage", `${data.source_coverage_percentage}%`],
      ["Bilingual coverage", `${data.bilingual_coverage_percentage}%`],
      ["Handbook coverage", `${data.handbook_coverage_percentage}%`],
      ["Calculator links", `${data.calculator_link_coverage_percentage}%`],
      ["Broken references", data.broken_references],
      ["Due for review", data.records_due_for_review],
      ["Stale records", data.stale_records],
      ["Next pack", data.next_recommended_pack || "None"],
    ];
    document.querySelector("#summary").replaceChildren(
      ...metrics.map(([label, value]) => {
        const card = document.createElement("div");
        card.className = "metric";
        const strong = document.createElement("strong");
        strong.textContent = String(value);
        card.append(strong, document.createTextNode(label));
        return card;
      }),
    );
    const rows = (values) =>
      Object.entries(values).map(([label, value]) => {
        const row = document.createElement("tr"),
          name = document.createElement("td"),
          count = document.createElement("td");
        name.textContent = label;
        count.textContent = String(value);
        row.append(name, count);
        return row;
      });
    document
      .querySelector("#categories")
      .replaceChildren(...rows(data.entries_by_category));
    document
      .querySelector("#difficulty")
      .replaceChildren(...rows(data.entries_by_difficulty));
    status.textContent = `Generated ${new Date(data.generated_at).toLocaleString()}.`;
  } catch (error) {
    status.textContent = `Dashboard unavailable: ${error.message}. Run npm run content:dashboard.`;
  }
})();
