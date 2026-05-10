import type { ContentPlan, ScriptJson } from "../domain/types.js";
import { scriptSystemPrompt } from "../content/brand.js";
import { runtimeWindow } from "../config/runtime.js";

export interface ScriptGenerator {
  generate(plan: ContentPlan): Promise<ScriptJson>;
}

export class MockScriptGenerator implements ScriptGenerator {
  async generate(plan: ContentPlan): Promise<ScriptJson> {
    const runtime = runtimeWindow();
    return {
      hook: "My first flip almost died three days before closing.",
      problem: "My lender went quiet. The seller was done waiting.",
      agitate: "Then I found 4 points and a draw schedule nobody explained.",
      solution: "Now I check the dashboard first. In some cases, that keeps my deal moving.",
      cta: "If you want to see how I fund my deals, link in bio.",
      full_script:
        "My first flip almost died three days before closing. My lender went quiet. The seller was done waiting. Then I found 4 points and a draw schedule nobody explained. Now I check the dashboard first. In some cases, that keeps my deal moving. If you want to see how I fund my deals, link in bio.",
      estimated_runtime_seconds: runtime.target,
      tone_note: "Fast, blunt, specific, first-person Sarah voice.",
      hook_type: "painful_story",
      content_pillar: plan.contentPillar
    };
  }
}

export class OpenAIScriptGenerator implements ScriptGenerator {
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.OPENAI_MODEL ?? "gpt-4.1"
  ) {}

  async generate(plan: ContentPlan): Promise<ScriptJson> {
    const runtime = runtimeWindow();
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          { role: "system", content: scriptSystemPrompt },
          {
            role: "user",
            content: [
              "Create today's Sarah UGC script.",
              `Content pillar: ${plan.contentPillar}.`,
              `Filming setting: ${plan.filmingSetting}.`,
              `Target runtime: ${runtime.min}-${runtime.max} seconds.`,
              "Topic lane: fix-and-flip funding and hard money lender process.",
              "Do not write about buying a dream home, consumer mortgages, or generic homebuyer steps.",
              "CTA must be soft and curiosity-based and must include the exact phrase link in bio.",
              "Do not use em dashes, en dashes, or semicolons."
            ].join(" ")
          }
        ],
        text: { format: { type: "json_object" } }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI script generation failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    const raw =
      data.output_text ??
      data.output?.flatMap((item) => item.content ?? []).find((content) => content.text)?.text;

    if (!raw) {
      throw new Error("OpenAI response did not include script JSON text");
    }

    return JSON.parse(raw) as ScriptJson;
  }
}
