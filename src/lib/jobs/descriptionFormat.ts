/**
 * Turns a raw job description (JSearch/Indeed/LinkedIn postings are usually one
 * long blob of newline-separated text, sometimes with "Requirements:"-style
 * section labels and "- "/"• " bullet lines) into structured blocks so the UI
 * can render headings and bullet lists the way real job boards do, instead of
 * one dense wall of text.
 */

export type DescriptionBlock =
  | { type: "heading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "paragraph"; text: string };

const BULLET_PREFIX = /^[-•*▪‣◦]\s+|^\d+[.)]\s+/;
const HEADING_WITH_COLON = /^[A-Za-z][A-Za-z0-9 /&'()-]{2,48}:$/;

function isAllCapsHeading(line: string): boolean {
  return (
    line.length <= 42 &&
    line === line.toUpperCase() &&
    /[A-Z]/.test(line) &&
    !/[.!?]$/.test(line)
  );
}

export function parseDescriptionBlocks(raw: string): DescriptionBlock[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const blocks: DescriptionBlock[] = [];
  let bullets: string[] = [];
  let paragraph: string[] = [];

  const flushBullets = () => {
    if (bullets.length) {
      blocks.push({ type: "bullets", items: bullets });
      bullets = [];
    }
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (const line of lines) {
    if (!line) {
      flushBullets();
      flushParagraph();
      continue;
    }
    if (BULLET_PREFIX.test(line)) {
      flushParagraph();
      bullets.push(line.replace(BULLET_PREFIX, "").trim());
      continue;
    }
    if (HEADING_WITH_COLON.test(line) || isAllCapsHeading(line)) {
      flushBullets();
      flushParagraph();
      blocks.push({ type: "heading", text: line.replace(/:$/, "") });
      continue;
    }
    flushBullets();
    paragraph.push(line);
  }
  flushBullets();
  flushParagraph();

  return blocks;
}
