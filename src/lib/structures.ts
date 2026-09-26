import type { Structure } from "./types";

// Reusable writing mechanics. These teach *how* a post works, never what a
// specific successful post said.
export const BUILT_IN_STRUCTURES: Structure[] = [
  {
    id: "observation-reversal",
    name: "Observation → reversal",
    pattern: "Setup → expectation → flip",
    description:
      "State something everyone accepts, let the reader settle into the expected conclusion, then flip it.",
    steps: [
      "A plain observation the reader nods along to",
      "The conclusion they expect",
      "The flip: what is actually true",
    ],
    example: "Everyone says hire slow. The best teams I've seen hire fast and fire the process, not the person.",
  },
  {
    id: "escalation",
    name: "Escalation",
    pattern: "Small → bigger → absurd/profound",
    description: "Stack three beats that grow in stakes so the last one lands hardest.",
    steps: ["A small, relatable beat", "A bigger version of it", "The beat that reframes the first two"],
  },
  {
    id: "uncomfortable-truth",
    name: "Uncomfortable truth",
    pattern: "Claim nobody says → why it's true → what to do",
    description: "Name the thing people think but avoid saying, then earn it with a reason.",
    steps: ["The blunt claim", "The evidence or mechanism", "A practical implication"],
  },
  {
    id: "specific-to-broad",
    name: "Specific experience → broad insight",
    pattern: "What happened → what I noticed → what it means",
    description: "Start with a concrete moment and zoom out to a lesson that travels.",
    steps: ["A specific moment with a detail", "The thing you noticed", "The general insight"],
  },
  {
    id: "old-vs-new",
    name: "Old world vs. new world",
    pattern: "Then: X → Now: Y → So: Z",
    description: "Contrast how something used to work with how it works now, and name the consequence.",
    steps: ["How it used to work", "How it works now", "What that changes for the reader"],
  },
  {
    id: "compressed-insight",
    name: "Compressed insight",
    pattern: "One sentence that does the work of a paragraph",
    description: "Distill the idea into a line that is quotable and complete on its own.",
    steps: ["Find the core tension", "Cut every word that is not load-bearing"],
  },
  {
    id: "before-after",
    name: "Before → after",
    pattern: "I used to think X → now I think Y → because Z",
    description: "Show a change of mind and the reason it changed.",
    steps: ["The old belief", "The new belief", "What changed it"],
  },
  {
    id: "list-with-turn",
    name: "List with a turn",
    pattern: "N items → the last one breaks the pattern",
    description: "A tight list where the final item reframes the rest.",
    steps: ["A promise of N things", "Parallel, concrete items", "A last item that twists"],
  },
];

export function findStructure(id: string | null, custom: Structure[]): Structure | null {
  if (!id) return null;
  return [...BUILT_IN_STRUCTURES, ...custom].find((s) => s.id === id) ?? null;
}
