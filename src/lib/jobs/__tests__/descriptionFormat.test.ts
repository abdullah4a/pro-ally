import { describe, expect, it } from "vitest";

import { parseDescriptionBlocks } from "../descriptionFormat";

describe("parseDescriptionBlocks", () => {
  it("returns a single paragraph for plain unstructured text", () => {
    expect(parseDescriptionBlocks("We are looking for a great engineer.")).toEqual([
      { type: "paragraph", text: "We are looking for a great engineer." },
    ]);
  });

  it("merges consecutive non-empty lines into one paragraph", () => {
    expect(parseDescriptionBlocks("Line one\nLine two")).toEqual([
      { type: "paragraph", text: "Line one Line two" },
    ]);
  });

  it("starts a new paragraph after a blank line", () => {
    expect(parseDescriptionBlocks("Paragraph one\n\nParagraph two")).toEqual([
      { type: "paragraph", text: "Paragraph one" },
      { type: "paragraph", text: "Paragraph two" },
    ]);
  });

  it("groups dash-bullet lines into one bullets block", () => {
    expect(parseDescriptionBlocks("- First\n- Second\n- Third")).toEqual([
      { type: "bullets", items: ["First", "Second", "Third"] },
    ]);
  });

  it("recognizes •, *, and numbered bullet prefixes", () => {
    expect(parseDescriptionBlocks("• One\n* Two\n1. Three\n2) Four")).toEqual([
      { type: "bullets", items: ["One", "Two", "Three", "Four"] },
    ]);
  });

  it("treats a short line ending in a colon as a heading", () => {
    expect(parseDescriptionBlocks("Requirements:\n- Node.js\n- SQL")).toEqual([
      { type: "heading", text: "Requirements" },
      { type: "bullets", items: ["Node.js", "SQL"] },
    ]);
  });

  it("treats a short all-caps line with no terminal punctuation as a heading", () => {
    expect(parseDescriptionBlocks("RESPONSIBILITIES\nBuild things.")).toEqual([
      { type: "heading", text: "RESPONSIBILITIES" },
      { type: "paragraph", text: "Build things." },
    ]);
  });

  it("does not treat an all-caps sentence ending in punctuation as a heading", () => {
    expect(parseDescriptionBlocks("APPLY NOW!")).toEqual([
      { type: "paragraph", text: "APPLY NOW!" },
    ]);
  });

  it("does not treat a long line ending in a colon as a heading", () => {
    const longLine =
      "This is a much longer line that happens to end with a colon even though it is really a sentence:";
    expect(parseDescriptionBlocks(longLine)).toEqual([{ type: "paragraph", text: longLine }]);
  });

  it("closes an open bullet list when a heading follows immediately", () => {
    expect(parseDescriptionBlocks("- Item one\nBenefits:\n- Item two")).toEqual([
      { type: "bullets", items: ["Item one"] },
      { type: "heading", text: "Benefits" },
      { type: "bullets", items: ["Item two"] },
    ]);
  });

  it("handles a realistic multi-section job description", () => {
    const raw = [
      "ABOUT THE ROLE",
      "We are hiring a Frontend Developer to join our team.",
      "",
      "Responsibilities:",
      "- Build responsive UI",
      "- Collaborate with design",
      "",
      "Requirements:",
      "- 2+ years experience",
      "- React and TypeScript",
    ].join("\n");

    expect(parseDescriptionBlocks(raw)).toEqual([
      { type: "heading", text: "ABOUT THE ROLE" },
      { type: "paragraph", text: "We are hiring a Frontend Developer to join our team." },
      { type: "heading", text: "Responsibilities" },
      { type: "bullets", items: ["Build responsive UI", "Collaborate with design"] },
      { type: "heading", text: "Requirements" },
      { type: "bullets", items: ["2+ years experience", "React and TypeScript"] },
    ]);
  });

  it("returns an empty array for empty or whitespace-only input", () => {
    expect(parseDescriptionBlocks("")).toEqual([]);
    expect(parseDescriptionBlocks("   \n  \n")).toEqual([]);
  });
});
