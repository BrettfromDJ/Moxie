import { claudeModel, isMock, modelLabel } from "@/lib/server/claude";
import { openaiAvailable, openaiModel } from "@/lib/server/openai";

// Which model providers this deployment can use, for the composer's model picker.
export async function GET() {
  return Response.json({
    anthropic: { available: true, label: modelLabel("anthropic", claudeModel("write")) },
    openai: { available: openaiAvailable() || isMock(), label: modelLabel("openai", openaiModel("write")) },
  });
}
