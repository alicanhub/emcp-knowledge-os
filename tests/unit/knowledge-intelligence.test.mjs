import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: null };
context.window = context;
vm.runInNewContext(fs.readFileSync("js/search-engine.js", "utf8"), context);
vm.runInNewContext(
  fs.readFileSync("js/knowledge-intelligence.js", "utf8"),
  context,
);
const normalize = context.EMCPBilingualSearch.normalize,
  entries = [
    {
      term: "Building Regulations",
      tr: "Yapı Mevzuatı",
      cat: "Planning",
      tags: ["regulation"],
      details: { difficultyLevel: "beginner", relatedConcepts: [] },
    },
    {
      term: "Planning Permission",
      tr: "Planlama İzni",
      cat: "Planning",
      tags: ["planning"],
      details: {
        difficultyLevel: "intermediate",
        relatedConcepts: ["Building Regulations"],
        relatedRegulations: [
          {
            title: {
              en: "Building Regulations guidance",
              tr: "Yapı Mevzuatı rehberi",
            },
          },
        ],
      },
    },
    {
      term: "Practical Completion",
      tr: "Pratik Tamamlama",
      cat: "Construction",
      tags: ["completion", "handover"],
      details: { difficultyLevel: "advanced", relatedConcepts: [] },
    },
    {
      term: "Asset Management",
      tr: "Varlık Yönetimi",
      cat: "Investment",
      tags: ["management", "operation"],
      details: { difficultyLevel: "expert", relatedConcepts: [] },
    },
  ],
  links = [[1], [0, 2], [1, 3], [2]],
  chapters = [
    {
      id: "chapter.planning",
      title: { en: "Planning", tr: "Planlama" },
      related_knowledge_entries: ["Planning Permission"],
    },
  ];

const create = (related = (index) => links[index]) =>
  context.EMCPKnowledgeIntelligence.create({
    entries,
    related,
    normalize,
    chapters,
  });

test("builds typed entry intelligence without inventing unavailable semantics", () => {
  const insight = create().forEntry(1, ["Building Regulations"]);
  assert.equal(insight.parent.title, "Planning");
  assert.deepEqual(Array.from(insight.children), []);
  assert.deepEqual(Array.from(insight.opposites), []);
  assert.equal(insight.related.length, 2);
  assert.equal(insight.frequentlyTogether.length, 2);
  assert.equal(insight.buildingRegulations.recorded.length, 1);
  assert.equal(insight.buildingRegulations.relatedEntry.index, 0);
  assert.equal(insight.handbook[0].id, "chapter.planning");
  assert.equal(insight.readNext.index, 2);
});

test("creates four-level journeys for every topic", () => {
  const journeys = create().journeys();
  assert.equal(journeys.length, 3);
  for (const journey of journeys)
    assert.deepEqual(Object.keys(journey.levels), [
      "beginner",
      "intermediate",
      "advanced",
      "expert",
    ]);
  const planning = journeys.find((journey) => journey.topic === "Planning");
  assert.equal(planning.levels.beginner[0].index, 0);
  assert.equal(planning.levels.intermediate[0].index, 1);
});

test("derives workflow positions from approved record fields", () => {
  const intelligence = create();
  assert.equal(intelligence.stageFor(entries[0]), "planning");
  assert.equal(intelligence.stageFor(entries[2]), "completion");
  assert.equal(intelligence.stageFor(entries[3]), "operation");
});

test("generates a focused graph and reports broken runtime relationships", () => {
  const graph = create().graph(1);
  assert.equal(graph.nodes[0].index, 1);
  assert.equal(graph.edges.length, 2);
  const valid = create().validate();
  assert.equal(valid.valid, true);
  assert.equal(valid.entries, 4);
  const broken = create((index) =>
    index === 0 ? [99] : links[index],
  ).validate();
  assert.equal(broken.valid, false);
  assert.ok(
    broken.issues.some((issue) => issue.type === "broken-relationship"),
  );
});
