import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const PROTECTED_ROUTES = ["/", "/jobs", "/chat", "/settings"];

/** Creates a brand-new, guaranteed-empty chat session and navigates to it. */
async function gotoFreshChatSession(page: Page): Promise<string> {
  const res = await page.request.post("/api/chat/sessions");
  const data = await res.json();
  await page.goto(`/chat/${data.id}`, { waitUntil: "networkidle" });
  return data.id;
}

test.describe("unauthenticated", () => {
  for (const path of PROTECTED_ROUTES) {
    test(`redirects ${path} to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("register page renders", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
  });

  // Regression guard: globals.css used to carry an unlayered `* { margin: 0;
  // padding: 0 }` reset that (due to CSS cascade-layer rules) silently beat
  // every Tailwind utility layered under `@layer utilities`, collapsing every
  // space-y-*/p-*/m-* class app-wide to 0 — see [[known-gaps]] memory, fixed
  // 2026-09-01. If this starts failing, that class of bug is back.
  test("login card has real padding and field spacing, not a collapsed layout", async ({
    page,
  }) => {
    await page.goto("/login");

    const cardPadding = await page
      .locator("form")
      .locator("..")
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
    expect(cardPadding).toBeGreaterThan(16);

    const fieldGap = await page.evaluate(() => {
      const firstField = document.querySelector("form > div");
      return firstField ? parseFloat(getComputedStyle(firstField).marginBottom) : 0;
    });
    expect(fieldGap).toBeGreaterThan(8);
  });
});

test.describe("admin session", () => {
  test.skip(
    !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD,
    "ADMIN_EMAIL/ADMIN_PASSWORD not set in .env.local",
  );

  // These tests share one mutable admin account and its one chat-session
  // list (and, for chat sends, one local LLM server not built for concurrent
  // load) — running them in parallel is inherently racy against shared
  // state, not just slow. Serial execution removed flakiness that showed up
  // under the default parallel runner.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", process.env.ADMIN_EMAIL!);
    await page.fill("#password", process.env.ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  for (const path of PROTECTED_ROUTES) {
    test(`loads ${path} without console/page errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  // Regression guard: the admin env-login used to return a hardcoded
  // "admin-static-id" that isn't a valid ObjectId, so every DB-backed route
  // keyed on session.user.id (starting with /api/me) threw BSONError and
  // 500'd for the admin account. Fixed 2026-09-01 — see [[known-gaps]].
  test("/api/me returns 200 for the admin session", async ({ page }) => {
    const res = await page.request.get("/api/me");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("filters");
  });

  test("settings page loads profile/filters/CV sections", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Job filters" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "CV & resume" })).toBeVisible();
  });

  test("chat page shows the composer and explains what the platform assistant is for", async ({
    page,
  }) => {
    // /chat lands in whichever session was most recently active, which may
    // already have messages (and so no intro/suggestions) — create a
    // guaranteed-empty session to test the empty state specifically.
    await gotoFreshChatSession(page);
    await expect(page.getByRole("heading", { name: "ProAlly AI" })).toBeVisible();
    await expect(
      page.getByPlaceholder("Ask ProAlly about your CV, applications, or interview prep…"),
    ).toBeVisible();

    // the intro message must explain platform scope, not just say hello
    await expect(page.getByText(/career assistant for this platform/i)).toBeVisible();
    await expect(page.getByText(/I stay focused on your job search/i)).toBeVisible();

    // the attachment feature was removed — no file input should remain on this page
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("chat suggestions populate the editable input instead of sending immediately", async ({
    page,
  }) => {
    // suggestion chips only render for an empty session — see note above
    await gotoFreshChatSession(page);
    const suggestion = "Review my CV and suggest 3 improvements";
    await page.getByText(suggestion).click();

    // populated into the editable input, not sent immediately
    await expect(page.locator("textarea")).toHaveValue(suggestion);

    await page.locator("textarea").fill(`${suggestion} for a backend role`);
    await expect(page.locator("textarea")).toHaveValue(`${suggestion} for a backend role`);
  });

  // Regression guard: chat used to be pure client-side state, lost on every
  // refresh. Fixed 2026-09-01 by persisting sessions/messages server-side and
  // routing by session id — see [[known-gaps]].
  test("visiting /chat lands in a real session, and it survives a hard reload", async ({
    page,
  }) => {
    test.setTimeout(60_000); // a real LLM round trip, not just page loads

    await page.goto("/chat");
    await page.waitForURL(/\/chat\/[0-9a-f]{24}$/, { timeout: 10_000 });
    const sessionUrl = page.url();

    const uniqueMessage = `Regression check ${Date.now()}`;
    await page.locator("textarea").fill(uniqueMessage);
    await Promise.all([
      page.waitForResponse((res) => res.url().includes("/messages"), { timeout: 45_000 }),
      page.locator('button[type="submit"]').click(),
    ]);
    // scoped to the message bubble, not the sidebar — the message may also
    // become the session's title there, which would otherwise double-match
    await expect(page.locator("span.whitespace-pre-wrap", { hasText: uniqueMessage })).toBeVisible();

    await page.reload({ waitUntil: "networkidle" });

    await expect(page).toHaveURL(sessionUrl);
    // scoped to the message bubble, not the sidebar — the message may also
    // become the session's title there, which would otherwise double-match
    await expect(page.locator("span.whitespace-pre-wrap", { hasText: uniqueMessage })).toBeVisible();
  });

  test("starting a new chat navigates to a distinct session and lists both in the sidebar", async ({
    page,
  }) => {
    await page.goto("/chat");
    await page.waitForURL(/\/chat\/[0-9a-f]{24}$/, { timeout: 10_000 });
    const firstUrl = page.url();

    await page.getByRole("button", { name: "New chat" }).click();
    await page.waitForFunction(
      (prev) => window.location.href !== prev,
      firstUrl,
      { timeout: 10_000 },
    );
    await page.waitForLoadState("networkidle");

    expect(page.url()).not.toBe(firstUrl);
    expect(page.url()).toMatch(/\/chat\/[0-9a-f]{24}$/);
    // admin is unlimited — the button must never disable for this account
    await expect(page.getByRole("button", { name: "New chat" })).toBeEnabled();
    await expect(page.getByText(/Unlimited chats \(admin\)/i)).toBeVisible();
  });

  // Regression guards, both fixed 2026-09-01 (see [[known-gaps]]):
  // 1. pdf-parse (via pdfjs-dist) wasn't in Next's serverExternalPackages, so
  //    Turbopack bundled it and broke its internal pdf.worker.mjs resolution —
  //    every PDF upload failed before any text extraction or LLM call ran.
  // 2. The CV upload used to hard-fail with a raw "Connection error." whenever
  //    AI analysis (the local LLM) was unreachable, losing the user's file
  //    over a transient dependency. The CV is now always saved and the
  //    response is always a calm, professional message — regardless of
  //    whether AI analysis could complete — so this asserts a 200 status
  //    unconditionally, not just "not a worker error".
  test("CV upload succeeds with a professional message, even when AI analysis is unavailable", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // a prior run of this test (or any other CV upload) may have already left
    // this account with a CV on file, which replaces the direct upload button
    // with a "Replace" button that opens the same uploader in a modal
    const replaceButton = page.getByRole("button", { name: "Replace" });
    if (await replaceButton.isVisible().catch(() => false)) {
      await replaceButton.click();
    }

    await page.locator('input[type="file"]').setInputFiles(
      path.join(__dirname, "fixtures/sample-cv.pdf"),
    );

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/cv/upload")),
      page.getByRole("button", { name: /^Upload CV$/i }).click(),
    ]);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(String(body.message)).not.toMatch(/worker|connection error/i);
  });
});

// A per-user chat session cap (MAX_CHAT_SESSIONS_PER_USER, default 5) applies
// to everyone except the admin account — verified with a fresh, non-admin
// account rather than the shared admin one so the limit is actually exercised.
test.describe("chat session limits (non-admin)", () => {
  test("a non-admin is blocked from creating more sessions than the configured limit", async ({
    page,
  }) => {
    const email = `e2e-limit-${Date.now()}@example.com`;
    const password = "TestPassword123!";

    await page.goto("/register");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.fill("#confirmPassword", password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/login");

    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    const listRes = await page.request.get("/api/chat/sessions");
    const listData = await listRes.json();
    expect(listData.limit.isAdmin).toBe(false);

    for (let i = listData.sessions.length; i < listData.limit.max; i++) {
      const createRes = await page.request.post("/api/chat/sessions");
      expect(createRes.status()).toBe(200);
    }

    const overLimitRes = await page.request.post("/api/chat/sessions");
    expect(overLimitRes.status()).toBe(403);
    const overLimitBody = await overLimitRes.json();
    expect(String(overLimitBody.error)).toMatch(/reached your limit/i);

    await page.goto("/chat");
    await page.waitForURL(/\/chat\/[0-9a-f]{24}$/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "New chat" })).toBeDisabled();
    await expect(page.getByText(/reached your chat limit/i)).toBeVisible();
  });
});
