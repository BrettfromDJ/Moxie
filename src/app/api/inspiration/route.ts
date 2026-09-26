import { AppError, isMock, jsonError, structured } from "@/lib/server/claude";
import { mockBlueprint, mockInspirationPosts } from "@/lib/server/mock";
import { ANALYST_SYSTEM } from "@/lib/server/prompts";
import { readJson } from "@/lib/server/request";
import { BlueprintSchema } from "@/lib/server/schemas";
import { getRecentPosts, getUser, parseHandle, xApiAvailable } from "@/lib/server/xapi";
import type { InspirationPost } from "@/lib/types";

export const maxDuration = 300;

export async function GET() {
  return Response.json({ xApi: xApiAvailable() || isMock() });
}

// Learns HOW a writer the user admires writes: from an X handle (via the X API,
// using their best-performing recent originals) or from pasted posts.
export async function POST(request: Request) {
  try {
    const body = await readJson<{ handle?: string; name?: string; posts?: string[] }>(request);
    let name = body.name?.trim() || "";
    let handle: string | undefined;
    let avatar: string | undefined;
    let bio: string | undefined;
    let posts: InspirationPost[];

    if (body.handle) {
      handle = parseHandle(body.handle);
      if (isMock()) {
        name = name || handle;
        posts = mockInspirationPosts();
      } else {
        const user = await getUser(handle);
        handle = user.username;
        name = user.name;
        avatar = user.profile_image_url;
        bio = user.description;
        const recent = await getRecentPosts(user.id, { originalsOnly: true });
        // Their best-received posts are the clearest evidence of what works for them.
        posts = recent
          .filter((p) => p.text.trim().length > 20 && !/^https?:\/\/\S+$/.test(p.text.trim()))
          .sort((a, b) => b.likes + 2 * b.reposts - (a.likes + 2 * a.reposts))
          .slice(0, 40)
          .map((p) => ({ text: p.text, likes: p.likes }));
      }
    } else {
      posts = (body.posts ?? []).map((t) => String(t).trim()).filter((t) => t.length > 1).slice(0, 60).map((text) => ({ text }));
      if (!name) throw new AppError(400, "Add the writer's name or handle.");
    }
    if (posts.length < 5) {
      throw new AppError(400, "Need at least 5 of their posts to learn from. Their account may be private or mostly replies; try pasting posts instead.");
    }

    const blueprint = await structured({
      job: "analyze",
      system: ANALYST_SYSTEM,
      schema: BlueprintSchema,
      mock: mockBlueprint,
      content: [
        {
          type: "text",
          text: `<writer name="${name.replace(/"/g, "'")}"${handle ? ` handle="@${handle}"` : ""}>
${posts.map((p, i) => `<post index="${i}"${p.likes != null ? ` likes="${p.likes}"` : ""}>${p.text.slice(0, 2000)}</post>`).join("\n")}
</writer>

<task>
Someone admires this writer and wants their own posts to learn from how this writer writes. Work out the craft, not the content:
- What makes these posts work (weighted toward the best-received ones, when likes are given).
- Signature moves and openings, described as reusable techniques that could be applied to any topic. Never quote their posts or catchphrases.
- The recurring shapes their posts take.
- Their rhythm: sentence length, line breaks, casing, punctuation, emoji and hashtag habits.
- What they write about (so a ghostwriter knows what NOT to borrow), and what they never do.
Be concrete and cite observable evidence ("opens 7 of 20 posts with a number").
</task>`,
        },
      ],
    });

    return Response.json({ handle, name, avatar, bio, posts: posts.slice(0, 30), blueprint });
  } catch (error) {
    return jsonError(error);
  }
}
