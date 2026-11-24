import { describe, expect, it } from "vitest";
import { nightsBetween, videoEmbed } from "./rooms";

describe("videoEmbed", () => {
  it("embeds YouTube links of every common shape", () => {
    expect(videoEmbed("https://www.youtube.com/watch?v=abc123XYZ").src).toBe(
      "https://www.youtube-nocookie.com/embed/abc123XYZ",
    );
    expect(videoEmbed("https://youtu.be/abc123XYZ").kind).toBe("iframe");
    expect(videoEmbed("https://youtube.com/shorts/abc123XYZ").src).toContain("/embed/abc123XYZ");
  });
  it("plays other links as a video file", () => {
    expect(videoEmbed("https://example.com/room.mp4")).toEqual({
      kind: "file",
      src: "https://example.com/room.mp4",
    });
  });
});

describe("nightsBetween", () => {
  it("counts nights and ignores bad ranges", () => {
    expect(nightsBetween("2026-12-10", "2026-12-13")).toBe(3);
    expect(nightsBetween("2026-12-13", "2026-12-10")).toBe(0);
    expect(nightsBetween("", "2026-12-10")).toBe(0);
  });
});
