import { render, screen, cleanup } from "@testing-library/react";
import { describe, test, expect, afterEach } from "vitest";

afterEach(() => { cleanup(); });
import { ToolInvocationBadge, getLabel } from "../ToolInvocationBadge";
import type { ToolInvocation } from "ai";

// helpers
function makeInvocation(
  toolName: string,
  args: Record<string, unknown>,
  state: "call" | "result" = "call"
): ToolInvocation {
  return { toolCallId: "1", toolName, args, state } as ToolInvocation;
}

describe("getLabel", () => {
  test("str_replace_editor create", () => {
    expect(getLabel("str_replace_editor", { command: "create", path: "/src/App.jsx" })).toBe("Creating App.jsx");
  });

  test("str_replace_editor str_replace", () => {
    expect(getLabel("str_replace_editor", { command: "str_replace", path: "/src/Card.tsx" })).toBe("Editing Card.tsx");
  });

  test("str_replace_editor insert", () => {
    expect(getLabel("str_replace_editor", { command: "insert", path: "/src/Card.tsx" })).toBe("Editing Card.tsx");
  });

  test("str_replace_editor view", () => {
    expect(getLabel("str_replace_editor", { command: "view", path: "/src/index.ts" })).toBe("Reading index.ts");
  });

  test("file_manager rename", () => {
    expect(
      getLabel("file_manager", { command: "rename", path: "/src/Old.tsx", new_path: "/src/New.tsx" })
    ).toBe("Renaming Old.tsx to New.tsx");
  });

  test("file_manager delete", () => {
    expect(getLabel("file_manager", { command: "delete", path: "/src/Unused.tsx" })).toBe("Deleting Unused.tsx");
  });

  test("unknown tool falls back to tool name", () => {
    expect(getLabel("unknown_tool", {})).toBe("unknown_tool");
  });
});

describe("ToolInvocationBadge", () => {
  test("shows label derived from tool args", () => {
    render(<ToolInvocationBadge toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "/src/Button.tsx" })} />);
    expect(screen.getByText("Creating Button.tsx")).toBeDefined();
  });

  test("shows spinner when state is call", () => {
    const { container } = render(
      <ToolInvocationBadge toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "/src/Button.tsx" }, "call")} />
    );
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(container.querySelector(".bg-emerald-500")).toBeNull();
  });

  test("shows green dot when state is result", () => {
    const { container } = render(
      <ToolInvocationBadge toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "/src/Button.tsx" }, "result")} />
    );
    expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  test("file_manager delete label", () => {
    render(
      <ToolInvocationBadge toolInvocation={makeInvocation("file_manager", { command: "delete", path: "/src/Old.tsx" })} />
    );
    expect(screen.getByText("Deleting Old.tsx")).toBeDefined();
  });
});
