import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("converts Latin lowercase letters and digits", () => {
    expect(slugify("hello world 123")).toBe("hello-world-123");
  });

  it("lowercases Latin uppercase letters", () => {
    expect(slugify("Camera Pro")).toBe("camera-pro");
  });

  it("preserves Hebrew characters", () => {
    const result = slugify("מצלמה חכמה");
    expect(result).toContain("מצלמה");
    expect(result).toContain("חכמה");
  });

  it("collapses multiple separators into one hyphen", () => {
    expect(slugify("a  --  b")).toBe("a-b");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("handles mixed Hebrew and Latin", () => {
    const result = slugify("Tiandy מצלמה 4K");
    expect(result).toContain("tiandy");
    expect(result).toContain("מצלמה");
    expect(result).toContain("4k");
  });

  it("returns a non-empty fallback for punctuation-only input", () => {
    const result = slugify("!@#$%");
    expect(result).toBeTruthy();
    expect(result.startsWith("item-")).toBe(true);
  });

  it("returns a non-empty fallback for empty string", () => {
    const result = slugify("");
    expect(result).toBeTruthy();
    expect(result.startsWith("item-")).toBe(true);
  });

  it("does not produce consecutive hyphens", () => {
    const result = slugify("hello   world");
    expect(result).not.toContain("--");
  });
});
