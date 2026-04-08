import { describe, it, expect, vi, beforeEach } from "vitest";
import { VirtualFileSystem } from "@/lib/file-system";
import { buildFileManagerTool } from "@/lib/tools/file-manager";

vi.mock("ai", () => ({
  tool: (config: unknown) => config,
}));

describe("buildFileManagerTool", () => {
  let fs: VirtualFileSystem;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let execute: (args: any) => Promise<unknown>;

  beforeEach(() => {
    fs = new VirtualFileSystem();
    // cast because we mocked `tool` to be a pass-through
    const built = buildFileManagerTool(fs) as unknown as {
      execute: (args: unknown) => Promise<unknown>;
    };
    execute = built.execute;
  });

  // ── rename ────────────────────────────────────────────────────────────────

  describe("rename command", () => {
    it("renames an existing file and returns success", async () => {
      fs.createFile("/src/old.ts", "content");

      const result = await execute({
        command: "rename",
        path: "/src/old.ts",
        new_path: "/src/new.ts",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /src/old.ts to /src/new.ts",
      });
      expect(fs.readFile("/src/new.ts")).toBe("content");
    });

    it("renames a directory recursively", async () => {
      fs.createFile("/components/Button.tsx", "export default function Button() {}");

      const result = await execute({
        command: "rename",
        path: "/components",
        new_path: "/ui",
      });

      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /components to /ui",
      });
    });

    it("returns an error when new_path is omitted", async () => {
      fs.createFile("/src/file.ts", "");

      const result = await execute({ command: "rename", path: "/src/file.ts" });

      expect(result).toEqual({
        success: false,
        error: "new_path is required for rename command",
      });
    });

    it("returns an error when the source path does not exist", async () => {
      const result = await execute({
        command: "rename",
        path: "/nonexistent.ts",
        new_path: "/dest.ts",
      });

      expect(result).toEqual({
        success: false,
        error: "Failed to rename /nonexistent.ts to /dest.ts",
      });
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe("delete command", () => {
    it("deletes an existing file and returns success", async () => {
      fs.createFile("/src/file.ts", "hello");

      const result = await execute({ command: "delete", path: "/src/file.ts" });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /src/file.ts",
      });
      expect(fs.readFile("/src/file.ts")).toBeNull();
    });

    it("deletes a directory and its children", async () => {
      fs.createFile("/pkg/index.ts", "");
      fs.createFile("/pkg/utils.ts", "");

      const result = await execute({ command: "delete", path: "/pkg" });

      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /pkg",
      });
    });

    it("returns an error when the path does not exist", async () => {
      const result = await execute({ command: "delete", path: "/ghost.ts" });

      expect(result).toEqual({
        success: false,
        error: "Failed to delete /ghost.ts",
      });
    });
  });

  // ── edge cases ────────────────────────────────────────────────────────────

  it("returns an error for an unrecognised command", async () => {
    const result = await execute({ command: "copy", path: "/a.ts" });

    expect(result).toEqual({ success: false, error: "Invalid command" });
  });
});
