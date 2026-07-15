import * as fs from "node:fs/promises";
import * as path from "node:path";

const GENERATOR_VERSION = "1.0.0";

export class DraftGeneratorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DraftGeneratorError";
    this.code = code;
  }
}

const slug = (value) =>
  String(value || "")
    .toLocaleLowerCase("en-GB")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "topic";
const copy = (value) => structuredClone(value);
const brief = (topic, section) => ({
  en: `${section} research and professional review are required for ${topic.title.en}.`,
  tr: `${topic.title.tr} için ${section.toLocaleLowerCase("tr-TR")} araştırması ve uzman incelemesi gereklidir.`,
});
const listBrief = (topic, section) => {
  const value = brief(topic, section);
  return { en: [value.en], tr: [value.tr] };
};

export class JsonDraftGenerator {
  #draftsDirectory;
  #approvedDirectory;
  #queue;
  #researchQueue;
  #clock;

  /** @param {any} options */
  constructor(options = {}) {
    const {
      draftsDirectory,
      approvedDirectory,
      queue = null,
      researchQueue = null,
      clock = () => new Date(),
    } = options;
    if (!draftsDirectory || !approvedDirectory)
      throw new DraftGeneratorError(
        "missing_directory",
        "Draft and approved directories are required.",
      );
    this.#draftsDirectory = draftsDirectory;
    this.#approvedDirectory = approvedDirectory;
    this.#queue = queue;
    this.#researchQueue = researchQueue;
    this.#clock = clock;
  }

  async generate({ plannerJobId, plan }) {
    this.#assertPlan(plan);
    if (typeof plannerJobId !== "string" || !plannerJobId)
      throw new DraftGeneratorError("invalid_job", "plannerJobId is required.");
    const generatedAt = this.#clock().toISOString();
    const approvedIds = await this.#contentIds(this.#approvedDirectory);
    await fs.mkdir(this.#draftsDirectory, { recursive: true });
    const drafts = [],
      skipped = [];
    for (const topic of plan.topics) {
      if (topic.existingRuntimeEntry) {
        skipped.push({ id: topic.id, reason: "existing-runtime-entry" });
        continue;
      }
      if (approvedIds.has(topic.id)) {
        skipped.push({ id: topic.id, reason: "approved-content-exists" });
        continue;
      }
      const regeneration = (await this.#latestRegeneration(topic.id)) + 1;
      const draftId = `${topic.id}.draft.${String(regeneration).padStart(3, "0")}`;
      const file = path.join(
        this.#draftsDirectory,
        `${topic.id}.draft-${String(regeneration).padStart(3, "0")}.json`,
      );
      const entry = this.#entry(
        topic,
        plan,
        plannerJobId,
        draftId,
        generatedAt,
      );
      await this.#write(file, entry);
      drafts.push({
        id: topic.id,
        path: file,
        reviewStatus: "draft",
        regeneration,
        draft_id: draftId,
        source_pack: plan.packId,
        planner_job_id: plannerJobId,
        version: GENERATOR_VERSION,
        generated_at: generatedAt,
        updated_at: generatedAt,
      });
    }
    return {
      plannerJobId,
      sourcePack: plan.packId,
      generatedAt,
      drafts,
      skipped,
      reviewedRecordsCreated: 0,
    };
  }

  async generateFromQueue(jobId) {
    if (!this.#queue?.get || !this.#queue?.transition)
      throw new DraftGeneratorError(
        "queue_unavailable",
        "A Job Queue Engine instance is required.",
      );
    let job = this.#queue.get(jobId);
    if (!job)
      throw new DraftGeneratorError(
        "job_not_found",
        `Unknown planner job: ${jobId}`,
      );
    if (job.payload?.kind !== "topic-production-plan" || !job.payload.plan)
      throw new DraftGeneratorError(
        "invalid_planner_job",
        "The queue job does not contain a Topic Planner plan.",
      );
    try {
      if (job.status === "pending")
        job = await this.#queue.transition(jobId, "planned");
      if (job.status !== "planned")
        throw new DraftGeneratorError(
          "invalid_job_state",
          `Planner job must be planned, not ${job.status}.`,
        );
      await this.#queue.transition(jobId, "drafting");
      const result = await this.generate({
        plannerJobId: jobId,
        plan: job.payload.plan,
      });
      if (this.#researchQueue?.createForDrafts)
        await this.#researchQueue.createForDrafts(result);
      await this.#queue.transition(jobId, "research");
      return result;
    } catch (error) {
      const current = this.#queue.get(jobId);
      if (
        current &&
        ["pending", "planned", "drafting", "research"].includes(current.status)
      )
        await this.#queue.transition(jobId, "failed", error.message);
      throw error;
    }
  }

  #entry(topic, plan, plannerJobId, draftId, timestamp) {
    const date = timestamp.slice(0, 10);
    const category = topic.group || plan.packTitle;
    const aliases = {
      en: [...new Set(topic.aliases?.en || [])],
      tr: [...new Set(topic.aliases?.tr || [])],
    };
    const keywords = {
      en: [
        ...new Set(
          [topic.title.en, topic.abbreviation, ...aliases.en].filter(Boolean),
        ),
      ],
      tr: [...new Set([topic.title.tr, ...aliases.tr].filter(Boolean))],
    };
    return {
      $schema: "../../schemas/content-entry.schema.json",
      draft_id: draftId,
      source_pack: plan.packId,
      planner_job_id: plannerJobId,
      version: GENERATOR_VERSION,
      generated_at: timestamp,
      updated_at: timestamp,
      id: topic.id,
      legacy_term: topic.title.en,
      title: copy(topic.title),
      summary: brief(topic, "Summary"),
      simple_explanation: brief(topic, "Simple explanation"),
      professional_explanation: brief(topic, "Professional explanation"),
      real_world_example: brief(topic, "Real-world example"),
      site_example: brief(topic, "Site example"),
      office_example: brief(topic, "Office example"),
      interview_questions: {
        en: [
          {
            question: `How would you explain ${topic.title.en}?`,
            answer: `A verified model answer for ${topic.title.en} must be added during human review.`,
          },
        ],
        tr: [
          {
            question: `${topic.title.tr} nasıl açıklanır?`,
            answer: `${topic.title.tr} için doğrulanmış örnek cevap insan incelemesinde eklenmelidir.`,
          },
        ],
      },
      abbreviation: topic.abbreviation || "",
      definition: brief(topic, "Definition"),
      category: { key: slug(category.en), en: category.en, tr: category.tr },
      subcategory: {
        key: "planned-topic",
        en: "Planned topic",
        tr: "Planlanan konu",
      },
      aliases,
      tags: [...new Set([slug(category.en), slug(topic.difficulty)])],
      keywords,
      formula: null,
      worked_example: brief(topic, "Worked example"),
      when_to_use: brief(topic, "When-to-use guidance"),
      use_cases: listBrief(topic, "Use-case"),
      risks: listBrief(topic, "Risk"),
      common_mistakes: listBrief(topic, "Common-mistake"),
      practical_tips: listBrief(topic, "Practical-tip"),
      best_practice: listBrief(topic, "Best-practice"),
      uk_practice: brief(topic, "UK-practice"),
      turkey_practice: brief(topic, "Turkey-practice"),
      related_concepts: [...new Set(topic.prerequisites || [])],
      related_calculators: [],
      related_documents: [],
      related_standards: [],
      related_regulations: [],
      revision_history: [
        {
          version: "0.1.0",
          date,
          summary: {
            en: "Deterministic initial draft generated from the approved topic plan.",
            tr: "Onaylı konu planından deterministik ilk taslak oluşturuldu.",
          },
          reviewer: "Pending human review",
        },
      ],
      difficulty_level: topic.difficulty,
      estimated_reading_time_minutes: Math.max(
        1,
        Math.round(topic.estimatedDraftHours * 2),
      ),
      frequently_asked_questions: {
        en: [
          {
            question: `What should a beginner know about ${topic.title.en}?`,
            answer:
              "Evidence-based guidance must be completed during research and human review.",
          },
        ],
        tr: [
          {
            question: `Yeni başlayan biri ${topic.title.tr} hakkında ne bilmelidir?`,
            answer:
              "Kanıta dayalı açıklama araştırma ve insan incelemesi sırasında tamamlanmalıdır.",
          },
        ],
      },
      visual_illustration: {
        status: "planned",
        caption: {
          en: `Planned illustration for ${topic.title.en}.`,
          tr: `${topic.title.tr} için planlanan görsel.`,
        },
        url: null,
      },
      future_video: {
        status: "planned",
        caption: {
          en: `Planned video for ${topic.title.en}.`,
          tr: `${topic.title.tr} için planlanan video.`,
        },
        url: null,
      },
      generation_warnings: [
        "Generated structure only; factual content and citations require human research and review.",
        "Jurisdiction-sensitive claims must be verified against authoritative UK and Turkish sources.",
      ],
      jurisdiction: [
        "United Kingdom",
        "Turkey — professional verification required",
      ],
      sources: [],
      created_date: date,
      reviewed_date: null,
      reviewer: null,
      review_status: "draft",
      content_version: "0.1.0",
    };
  }

  async #latestRegeneration(id) {
    let names = [];
    try {
      names = await fs.readdir(this.#draftsDirectory);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const prefix = `${id}.draft-`;
    return names.reduce((highest, name) => {
      const match =
        name.startsWith(prefix) && name.match(/\.draft-(\d+)\.json$/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
  }

  async #contentIds(directory) {
    const ids = new Set();
    const visit = async (folder) => {
      let entries = [];
      try {
        entries = await fs.readdir(folder, { withFileTypes: true });
      } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
      }
      for (const item of entries) {
        const file = path.join(folder, item.name);
        if (item.isDirectory()) await visit(file);
        else if (item.isFile() && item.name.endsWith(".json")) {
          const value = JSON.parse(await fs.readFile(file, "utf8"));
          for (const record of Array.isArray(value) ? value : [value])
            if (record?.id) ids.add(record.id);
        }
      }
    };
    await visit(directory);
    return ids;
  }

  async #write(file, value) {
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await fs.rename(temporary, file);
  }

  #assertPlan(plan) {
    if (
      !plan ||
      plan.schemaVersion !== 1 ||
      !plan.packId ||
      !Array.isArray(plan.topics)
    )
      throw new DraftGeneratorError(
        "invalid_plan",
        "A Topic Planner v1 production plan is required.",
      );
  }
}
