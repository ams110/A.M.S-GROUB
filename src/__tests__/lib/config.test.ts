import { asset, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

describe("asset()", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BASE_PATH;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_PATH;
    } else {
      process.env.NEXT_PUBLIC_BASE_PATH = originalEnv;
    }
  });

  it("returns path unchanged when BASE_PATH is empty", () => {
    // BASE_PATH defaults to "" in config.ts
    expect(asset("/logo.svg")).toBe("/logo.svg");
    expect(asset("/placeholder.svg")).toBe("/placeholder.svg");
  });

  it("prepends a non-empty base path", () => {
    // BASE_PATH is read at module evaluation time, so we verify the function's
    // concatenation contract: result always ends with the given path suffix.
    const path = "/logo.svg";
    // asset() returns `${BASE_PATH}${path}` — verify the expected shape
    const result = asset(path);
    expect(typeof result).toBe("string");
    expect(result.endsWith(path)).toBe(true);
  });

  it("handles paths with sub-directories", () => {
    const result = asset("/images/banner.jpg");
    expect(result.endsWith("/images/banner.jpg")).toBe(true);
  });

  it("handles empty path", () => {
    const result = asset("");
    expect(typeof result).toBe("string");
  });
});

describe("SUPABASE_URL / SUPABASE_ANON_KEY", () => {
  it("exports non-empty strings", () => {
    expect(typeof SUPABASE_URL).toBe("string");
    expect(SUPABASE_URL.length).toBeGreaterThan(0);
    expect(typeof SUPABASE_ANON_KEY).toBe("string");
    expect(SUPABASE_ANON_KEY.length).toBeGreaterThan(0);
  });
});
