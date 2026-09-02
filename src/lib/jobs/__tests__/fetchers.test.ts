import { afterEach, describe, expect, it, vi } from "vitest";

const parseURL = vi.fn();

vi.mock("rss-parser", () => ({
  default: class Parser {
    parseURL = (...args: unknown[]) => parseURL(...args);
  },
}));

import { fetchRapidApiJobs, fetchUpworkJobs } from "../fetchers";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchUpworkJobs", () => {
  it("maps a well-formed feed item into a JobListing", async () => {
    parseURL.mockResolvedValue({
      items: [
        {
          guid: "guid-1",
          title: "Frontend Developer",
          contentSnippet: "Build UI things",
          link: "https://upwork.com/jobs/1",
          isoDate: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const jobs = await fetchUpworkJobs("react developer");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: "guid-1",
      title: "Frontend Developer",
      company: "Upwork Client",
      description: "Build UI things",
      url: "https://upwork.com/jobs/1",
      source: "upwork",
    });
    expect(jobs[0].postedAt).toEqual(new Date("2024-01-01T00:00:00.000Z"));
  });

  it("returns an empty array for an empty feed", async () => {
    parseURL.mockResolvedValue({ items: [] });
    expect(await fetchUpworkJobs("nothing")).toEqual([]);
  });

  it("returns an empty array and does not throw when the feed fetch rejects", async () => {
    parseURL.mockRejectedValue(new Error("network timeout"));
    expect(await fetchUpworkJobs("react")).toEqual([]);
  });

  it("drops items with no link, since a url is required downstream", async () => {
    parseURL.mockResolvedValue({
      items: [{ guid: "g1", title: "No link job" }],
    });
    expect(await fetchUpworkJobs("q")).toEqual([]);
  });

  it("falls back to 'Untitled Job' when title is missing", async () => {
    parseURL.mockResolvedValue({
      items: [{ guid: "g1", link: "https://upwork.com/jobs/1" }],
    });
    const jobs = await fetchUpworkJobs("q");
    expect(jobs[0].title).toBe("Untitled Job");
  });

  it("falls back to content when contentSnippet is missing", async () => {
    parseURL.mockResolvedValue({
      items: [
        { guid: "g1", link: "https://upwork.com/jobs/1", content: "Full content here" },
      ],
    });
    const jobs = await fetchUpworkJobs("q");
    expect(jobs[0].description).toBe("Full content here");
  });

  it("uses an empty string description when both content fields are missing", async () => {
    parseURL.mockResolvedValue({
      items: [{ guid: "g1", link: "https://upwork.com/jobs/1" }],
    });
    const jobs = await fetchUpworkJobs("q");
    expect(jobs[0].description).toBe("");
  });

  it("falls back to link as externalId when guid is missing", async () => {
    parseURL.mockResolvedValue({
      items: [{ link: "https://upwork.com/jobs/xyz" }],
    });
    const jobs = await fetchUpworkJobs("q");
    expect(jobs[0].externalId).toBe("https://upwork.com/jobs/xyz");
  });

  it("uses the current date when isoDate is missing or unparsable", async () => {
    const before = Date.now();
    parseURL.mockResolvedValue({
      items: [{ guid: "g1", link: "https://upwork.com/jobs/1" }],
    });
    const jobs = await fetchUpworkJobs("q");
    const after = Date.now();
    expect(jobs[0].postedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(jobs[0].postedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("URL-encodes special characters in the search query", async () => {
    parseURL.mockResolvedValue({ items: [] });
    await fetchUpworkJobs("c++ developer & devops/sre");
    const calledUrl = parseURL.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("c++ developer & devops/sre");
    expect(calledUrl).toContain(encodeURIComponent("c++ developer & devops/sre"));
  });

  it("handles a query containing unicode characters without throwing", async () => {
    parseURL.mockResolvedValue({ items: [] });
    await expect(fetchUpworkJobs("développeur café ☕")).resolves.toEqual([]);
  });

  it("handles an empty query string", async () => {
    parseURL.mockResolvedValue({ items: [] });
    await expect(fetchUpworkJobs("")).resolves.toEqual([]);
  });

  it("maps multiple feed items independently, dropping any without a link", async () => {
    parseURL.mockResolvedValue({
      items: [
        { guid: "1", title: "Job A", link: "https://upwork.com/1" },
        { guid: "2", title: "Job B" },
        { guid: "3", title: "Job C", link: "https://upwork.com/3" },
      ],
    });
    const jobs = await fetchUpworkJobs("q");
    expect(jobs.map((j) => j.title)).toEqual(["Job A", "Job C"]);
  });
});

describe("fetchRapidApiJobs", () => {
  function mockFetchOnce(options: {
    ok: boolean;
    status: number;
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
    headers?: Record<string, string>;
  }) {
    const headerMap = new Map(Object.entries(options.headers ?? {}));
    const response = {
      ok: options.ok,
      status: options.status,
      headers: { get: (key: string) => headerMap.get(key) ?? null },
      json: options.json ?? (async () => ({})),
      text: options.text ?? (async () => ""),
    };
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("returns an 'unknown' result and never calls fetch when no API key is provided", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRapidApiJobs("engineer", "remote", undefined);
    expect(result).toEqual({
      jobs: [],
      status: "unknown",
      statusMessage: null,
      requestsRemaining: null,
      requestsLimit: null,
      quotaResetsAt: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Regression test: this project's JSearch subscription only exposes
  // /search-v2, not the commonly-documented /search — verified 2026-09-01
  // against the real API with a live key ("/search" returned 404).
  it("calls the /search-v2 endpoint, not /search", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { jobs: [] } }),
    });

    await fetchRapidApiJobs("engineer", "", "test-key");
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/search-v2");
    expect(calledUrl).not.toMatch(/\/search\?/);
  });

  it("classifies a 429 response as quota_exceeded with a professional message", async () => {
    mockFetchOnce({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ message: "Too many requests" }),
      headers: { "x-ratelimit-requests-limit": "200", "x-ratelimit-requests-remaining": "0" },
    });

    const result = await fetchRapidApiJobs("engineer", "remote", "test-key");
    expect(result.jobs).toEqual([]);
    expect(result.status).toBe("quota_exceeded");
    expect(result.statusMessage).toMatch(/monthly.*limit/i);
    expect(result.requestsRemaining).toBe(0);
    expect(result.requestsLimit).toBe(200);
  });

  it.each([401, 403])(
    "classifies a %i response as invalid with a professional message",
    async (status) => {
      mockFetchOnce({
        ok: false,
        status,
        text: async () => JSON.stringify({ message: "You are not subscribed to this API." }),
      });

      const result = await fetchRapidApiJobs("engineer", "remote", "test-key");
      expect(result.jobs).toEqual([]);
      expect(result.status).toBe("invalid");
      expect(result.statusMessage).toMatch(/rejected/i);
    },
  );

  it("classifies any other non-OK status as a generic error", async () => {
    mockFetchOnce({ ok: false, status: 500, text: async () => "Internal Server Error" });

    const result = await fetchRapidApiJobs("engineer", "remote", "test-key");
    expect(result.jobs).toEqual([]);
    expect(result.status).toBe("error");
    expect(result.statusMessage).toMatch(/500/);
  });

  it("returns a status: 'error' result and does not throw when the request itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await fetchRapidApiJobs("engineer", "remote", "test-key");
    expect(result.jobs).toEqual([]);
    expect(result.status).toBe("error");
    expect(result.statusMessage).toBe("network down");
  });

  it("maps a well-formed JSearch search-v2 response into JobListing objects with status ok", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      headers: { "x-ratelimit-requests-limit": "200", "x-ratelimit-requests-remaining": "194" },
      json: async () => ({
        data: {
          jobs: [
            {
              job_id: "j-1",
              job_title: "Backend Engineer",
              employer_name: "Acme Inc",
              job_description: "Build the backend",
              job_apply_link: "https://jobs.example.com/1",
              job_publisher: "Indeed",
              job_city: "Lahore",
              job_state: "Punjab",
              job_country: "PK",
              job_posted_at_datetime_utc: "2024-01-01T00:00:00.000Z",
              job_min_salary: 50000,
              job_max_salary: 70000,
              job_salary_currency: "USD",
            },
          ],
          cursor: null,
        },
      }),
    });

    const result = await fetchRapidApiJobs("backend engineer", "Lahore", "test-key");
    expect(result.status).toBe("ok");
    expect(result.statusMessage).toBeNull();
    expect(result.requestsRemaining).toBe(194);
    expect(result.requestsLimit).toBe(200);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      externalId: "j-1",
      source: "jsearch",
      publisher: "Indeed",
      title: "Backend Engineer",
      company: "Acme Inc",
      description: "Build the backend",
      url: "https://jobs.example.com/1",
      location: "Lahore, Punjab",
      salary: "USD50000-70000",
    });
    expect(result.jobs[0].postedAt).toEqual(new Date("2024-01-01T00:00:00.000Z"));
  });

  it("drops jobs with neither an apply link nor a Google Jobs link", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { jobs: [{ job_id: "j-1", job_title: "No link job" }] } }),
    });

    const result = await fetchRapidApiJobs("engineer", "", "test-key");
    expect(result.jobs).toEqual([]);
  });

  // Confirmed against a real JSearch response (2026-09-01): Indeed-sourced
  // listings often have job_apply_link: null and only a job_google_link.
  it("falls back to job_google_link when job_apply_link is null", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          jobs: [
            {
              job_id: "j-1",
              job_title: "Frontend Developer",
              job_apply_link: null,
              job_google_link: "https://www.google.com/search?q=jobs#vhid=abc",
            },
          ],
        },
      }),
    });

    const result = await fetchRapidApiJobs("engineer", "", "test-key");
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].url).toBe("https://www.google.com/search?q=jobs#vhid=abc");
  });

  it("falls back to 'Untitled Job'/'Unknown Company'/empty description when fields are missing", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { jobs: [{ job_apply_link: "https://jobs.example.com/2" }] } }),
    });

    const result = await fetchRapidApiJobs("engineer", "", "test-key");
    expect(result.jobs[0]).toMatchObject({
      title: "Untitled Job",
      company: "Unknown Company",
      description: "",
    });
  });

  it("falls back to job_country for location when city/state are missing", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { jobs: [{ job_apply_link: "https://jobs.example.com/3", job_country: "US" }] },
      }),
    });

    const result = await fetchRapidApiJobs("engineer", "", "test-key");
    expect(result.jobs[0].location).toBe("US");
  });

  it("omits location entirely when no city/state/country is present", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { jobs: [{ job_apply_link: "https://jobs.example.com/4" }] } }),
    });

    const result = await fetchRapidApiJobs("engineer", "", "test-key");
    expect(result.jobs[0].location).toBeUndefined();
  });

  it("omits salary unless both min and max are present", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          jobs: [{ job_apply_link: "https://jobs.example.com/5", job_min_salary: 50000 }],
        },
      }),
    });

    const result = await fetchRapidApiJobs("engineer", "", "test-key");
    expect(result.jobs[0].salary).toBeUndefined();
  });

  it("falls back to the current date when job_posted_at_datetime_utc is missing", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { jobs: [{ job_apply_link: "https://jobs.example.com/6" }] } }),
    });

    const before = Date.now();
    const result = await fetchRapidApiJobs("engineer", "", "test-key");
    const after = Date.now();
    expect(result.jobs[0].postedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.jobs[0].postedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("treats a missing data.jobs array as no results, without throwing", async () => {
    mockFetchOnce({ ok: true, status: 200, json: async () => ({ data: {} }) });

    const result = await fetchRapidApiJobs("engineer", "", "test-key");
    expect(result.status).toBe("ok");
    expect(result.jobs).toEqual([]);
  });

  it("includes the location in the query string when provided, omits it when empty", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { jobs: [] } }),
    });

    await fetchRapidApiJobs("engineer", "Lahore", "test-key");
    expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent("engineer jobs in Lahore"));

    await fetchRapidApiJobs("engineer", "", "test-key");
    expect(String(fetchMock.mock.calls[1][0])).toContain(encodeURIComponent("engineer jobs"));
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("jobs+in");
  });

  it("sends the RapidAPI auth headers", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { jobs: [] } }),
    });

    await fetchRapidApiJobs("engineer", "", "test-key");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["X-RapidAPI-Key"]).toBe("test-key");
    expect(init.headers["X-RapidAPI-Host"]).toBe("jsearch.p.rapidapi.com");
  });
});
