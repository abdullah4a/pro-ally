import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = { completions: { create: (...args: unknown[]) => create(...args) } };
  },
}));

const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = originalFetch;
});

describe("parseCvWithLlm", () => {
  it("parses a clean JSON response with no markdown fencing", async () => {
    const { parseCvWithLlm } = await import("../client");
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              skills: ["TypeScript"],
              experienceYears: 4,
              jobTitles: ["Engineer"],
              industries: ["Tech"],
              education: ["BSc"],
              keywords: ["node"],
            }),
          },
        },
      ],
    });

    const result = await parseCvWithLlm("some cv text");
    expect(result.skills).toEqual(["TypeScript"]);
    expect(result.experienceYears).toBe(4);
  });

  it("extracts JSON from a ```json fenced code block", async () => {
    const { parseCvWithLlm } = await import("../client");
    const payload = {
      skills: ["Go"],
      experienceYears: 2,
      jobTitles: ["Dev"],
      industries: ["Fintech"],
      education: ["MSc"],
      keywords: ["backend"],
    };
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: "Here you go:\n```json\n" + JSON.stringify(payload) + "\n```",
          },
        },
      ],
    });

    const result = await parseCvWithLlm("cv text");
    expect(result).toEqual(payload);
  });

  it("extracts JSON from an unlabeled ``` fenced block", async () => {
    const { parseCvWithLlm } = await import("../client");
    const payload = {
      skills: [],
      experienceYears: 0,
      jobTitles: [],
      industries: [],
      education: [],
      keywords: [],
    };
    create.mockResolvedValue({
      choices: [{ message: { content: "```\n" + JSON.stringify(payload) + "\n```" } }],
    });

    const result = await parseCvWithLlm("cv text");
    expect(result).toEqual(payload);
  });

  it("extracts JSON embedded in surrounding prose without fencing", async () => {
    const { parseCvWithLlm } = await import("../client");
    const payload = {
      skills: ["Python"],
      experienceYears: 1,
      jobTitles: ["Analyst"],
      industries: ["Data"],
      education: ["BA"],
      keywords: ["sql"],
    };
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: `Sure, here's the extracted data: ${JSON.stringify(payload)} Hope that helps!`,
          },
        },
      ],
    });

    const result = await parseCvWithLlm("cv text");
    expect(result).toEqual(payload);
  });

  it("throws when the LLM returns an empty message content", async () => {
    const { parseCvWithLlm } = await import("../client");
    create.mockResolvedValue({ choices: [{ message: { content: "" } }] });

    await expect(parseCvWithLlm("cv text")).rejects.toThrow(
      "LLM returned an empty response",
    );
  });

  it("throws when the LLM returns no choices at all", async () => {
    const { parseCvWithLlm } = await import("../client");
    create.mockResolvedValue({ choices: [] });

    await expect(parseCvWithLlm("cv text")).rejects.toThrow(
      "LLM returned an empty response",
    );
  });

  it("throws when the LLM returns malformed (non-parseable) JSON", async () => {
    const { parseCvWithLlm } = await import("../client");
    create.mockResolvedValue({
      choices: [{ message: { content: "not json at all {broken" } }],
    });

    await expect(parseCvWithLlm("cv text")).rejects.toThrow();
  });

  it("throws when the LLM returns JSON that doesn't match the parsedCvSchema shape", async () => {
    const { parseCvWithLlm } = await import("../client");
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ skills: "not-an-array" }),
          },
        },
      ],
    });

    await expect(parseCvWithLlm("cv text")).rejects.toThrow(
      "LLM returned invalid CV structure",
    );
  });

  it("throws when the LLM response has extra prose but zero JSON-like braces", async () => {
    const { parseCvWithLlm } = await import("../client");
    create.mockResolvedValue({
      choices: [{ message: { content: "I cannot process this CV." } }],
    });

    await expect(parseCvWithLlm("cv text")).rejects.toThrow();
  });

  it("truncates CV text longer than 12000 characters before sending to the LLM", async () => {
    const { parseCvWithLlm } = await import("../client");
    const payload = {
      skills: [],
      experienceYears: 0,
      jobTitles: [],
      industries: [],
      education: [],
      keywords: [],
    };
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });

    const longText = "A".repeat(20000);
    await parseCvWithLlm(longText);

    const callArgs = create.mock.calls[0][0];
    const userMessage = callArgs.messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMessage.content.length).toBeLessThan(20000);
  });

  it("propagates a network/API error from the OpenAI client", async () => {
    const { parseCvWithLlm } = await import("../client");
    create.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(parseCvWithLlm("cv text")).rejects.toThrow("ECONNREFUSED");
  });
});

describe("evaluateJobMatch", () => {
  it("includes experienceYears and experienceLevel in the prompt when provided", async () => {
    const { evaluateJobMatch } = await import("../client");
    create.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ match: true, score: 80 }) } },
      ],
    });

    await evaluateJobMatch({
      skills: "React, TypeScript",
      title: "Senior Frontend Developer",
      description: "Build things.",
      experienceYears: 7,
      experienceLevel: "senior",
    });

    const callArgs = create.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).toContain("Candidate years of experience: 7");
    expect(userMessage.content).toContain("Candidate self-reported level: senior");
  });

  it("omits experience lines from the prompt when not provided", async () => {
    const { evaluateJobMatch } = await import("../client");
    create.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ match: true, score: 80 }) } },
      ],
    });

    await evaluateJobMatch({
      skills: "React, TypeScript",
      title: "Frontend Developer",
      description: "Build things.",
    });

    const callArgs = create.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).not.toContain("Candidate years of experience");
    expect(userMessage.content).not.toContain("Candidate self-reported level");
  });

  it("instructs the model that seniority must fit, not just skills", async () => {
    const { evaluateJobMatch } = await import("../client");
    create.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ match: true, score: 80 }) } },
      ],
    });

    await evaluateJobMatch({ skills: "React", title: "Frontend Developer", description: "" });

    const callArgs = create.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).toMatch(/seniority must fit/i);
  });

  it("returns the parsed evaluation and applies defaults for omitted fields", async () => {
    const { evaluateJobMatch } = await import("../client");
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ match: true, score: 92 }) } }],
    });

    const result = await evaluateJobMatch({
      skills: "React",
      title: "Frontend Developer",
      description: "",
    });

    expect(result).toEqual({ match: true, score: 92, reason: "", matchingSkills: [] });
  });

  it("throws when the LLM returns JSON that doesn't match jobMatchEvaluationSchema", async () => {
    const { evaluateJobMatch } = await import("../client");
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ match: "yes" }) } }],
    });

    await expect(
      evaluateJobMatch({ skills: "React", title: "Frontend Developer", description: "" }),
    ).rejects.toThrow("LLM returned invalid job evaluation structure");
  });

  it("throws when the LLM returns an empty response", async () => {
    const { evaluateJobMatch } = await import("../client");
    create.mockResolvedValue({ choices: [{ message: { content: "" } }] });

    await expect(
      evaluateJobMatch({ skills: "React", title: "Frontend Developer", description: "" }),
    ).rejects.toThrow("LLM returned an empty response");
  });
});

describe("chatWithLlm", () => {
  it("returns the assistant's reply content", async () => {
    const { chatWithLlm } = await import("../client");
    create.mockResolvedValue({
      choices: [{ message: { content: "Here is some advice." } }],
    });

    const result = await chatWithLlm("How do I negotiate salary?");
    expect(result).toBe("Here is some advice.");
  });

  it("falls back to a default message when content is null/undefined", async () => {
    const { chatWithLlm } = await import("../client");
    create.mockResolvedValue({ choices: [{ message: {} }] });

    const result = await chatWithLlm("hello");
    expect(result).toBe("I could not generate a response.");
  });

  it("falls back to a default message when there are no choices", async () => {
    const { chatWithLlm } = await import("../client");
    create.mockResolvedValue({ choices: [] });

    const result = await chatWithLlm("hello");
    expect(result).toBe("I could not generate a response.");
  });

  it("propagates an error thrown by the underlying client", async () => {
    const { chatWithLlm } = await import("../client");
    create.mockRejectedValue(new Error("model unavailable"));

    await expect(chatWithLlm("hello")).rejects.toThrow("model unavailable");
  });
});

describe("checkLlmHealth", () => {
  it("reports online when the /health endpoint responds ok", async () => {
    const { checkLlmHealth } = await import("../client");
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;

    const result = await checkLlmHealth();
    expect(result.online).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it("falls back to a chat probe when /health is unreachable, and reports online on success", async () => {
    const { checkLlmHealth } = await import("../client");
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    create.mockResolvedValue({ choices: [{ message: { content: "pong" } }] });

    const result = await checkLlmHealth();
    expect(result.online).toBe(true);
    expect(create).toHaveBeenCalled();
  });

  it("falls back to a chat probe when /health responds with a non-ok status", async () => {
    const { checkLlmHealth } = await import("../client");
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    create.mockResolvedValue({ choices: [{ message: { content: "pong" } }] });

    const result = await checkLlmHealth();
    expect(result.online).toBe(true);
  });

  it("reports offline with an error message when both health check and chat probe fail", async () => {
    const { checkLlmHealth } = await import("../client");
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    create.mockRejectedValue(new Error("model server not running"));

    const result = await checkLlmHealth();
    expect(result.online).toBe(false);
    expect(result.error).toBe("model server not running");
  });

  it("reports a generic error message when the chat probe throws a non-Error value", async () => {
    const { checkLlmHealth } = await import("../client");
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;
    create.mockRejectedValue("some string failure");

    const result = await checkLlmHealth();
    expect(result.online).toBe(false);
    expect(result.error).toBe("LLM unavailable");
  });
});
