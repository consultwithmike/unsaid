/**
 * Idempotent question-bank seed — E2E_LOCKS §5.
 *
 * Usage: `npm run seed:questions` (targets whatever database
 * `@netlify/database` resolves: local dev DB under `netlify dev`).
 *
 * Upserts on `(code, question_set_version)`, so re-running is safe.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDatabase } from "@netlify/database";

interface BankQuestion {
  code: string;
  section: string;
  displayOrder: number;
  text: string;
  responseType: string;
  responseOptions?: unknown;
  neutralDescription?: string | null;
  prompts?: unknown;
  parentCode?: string | null;
  followUpWhen?: unknown;
  hiddenUnlessParent?: unknown;
  compatibilityMatrix?: unknown;
  distanceMode?: string | null;
  specialScoring?: string | null;
  toneNote?: string | null;
}

interface Bank {
  questionSetVersion: string;
  questions: BankQuestion[];
}

function jsonOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

async function main() {
  const version = process.env.QUESTION_SET_VERSION ?? "2026.09";
  const bankPath = path.join(
    process.cwd(),
    "content",
    "questions",
    `${version}.json`,
  );
  const bank = JSON.parse(await readFile(bankPath, "utf8")) as Bank;

  if (bank.questionSetVersion !== version) {
    throw new Error(
      `Bank file declares ${bank.questionSetVersion} but ${version} was requested`,
    );
  }

  const db = getDatabase();
  let upserted = 0;

  for (const question of bank.questions) {
    // `followUpWhen` and `hiddenUnlessParent` normalize into one column.
    const showWhen = question.followUpWhen ?? question.hiddenUnlessParent ?? null;

    await db.sql`
      INSERT INTO questions (
        code, question_set_version, section_id, prompt, response_type, options,
        compatibility_matrix, parent_code, show_when, distance_mode,
        special_scoring, display_order, active, conversation_prompts,
        neutral_description, tone_note
      ) VALUES (
        ${question.code}, ${version}, ${question.section}, ${question.text},
        ${question.responseType}, ${jsonOrNull(question.responseOptions)},
        ${jsonOrNull(question.compatibilityMatrix)}, ${question.parentCode ?? null},
        ${jsonOrNull(showWhen)}, ${question.distanceMode ?? null},
        ${question.specialScoring ?? null}, ${question.displayOrder}, true,
        ${jsonOrNull(question.prompts)}, ${question.neutralDescription ?? null},
        ${question.toneNote ?? null}
      )
      ON CONFLICT (code, question_set_version) DO UPDATE
        SET section_id = EXCLUDED.section_id,
            prompt = EXCLUDED.prompt,
            response_type = EXCLUDED.response_type,
            options = EXCLUDED.options,
            compatibility_matrix = EXCLUDED.compatibility_matrix,
            parent_code = EXCLUDED.parent_code,
            show_when = EXCLUDED.show_when,
            distance_mode = EXCLUDED.distance_mode,
            special_scoring = EXCLUDED.special_scoring,
            display_order = EXCLUDED.display_order,
            active = true,
            conversation_prompts = EXCLUDED.conversation_prompts,
            neutral_description = EXCLUDED.neutral_description,
            tone_note = EXCLUDED.tone_note
    `;
    upserted += 1;
  }

  // Anything left over from an earlier bank revision stops being served.
  const codes = bank.questions.map((question) => question.code);
  await db.sql`
    UPDATE questions
       SET active = false
     WHERE question_set_version = ${version}
       AND NOT (code = ANY(${codes}))
  `;

  console.log(`Seeded ${upserted} questions for question set ${version}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
