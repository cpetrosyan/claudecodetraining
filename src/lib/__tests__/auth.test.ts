// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mockCookies = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookies),
}));

import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";

const SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";

async function makeToken(
  payload: Record<string, unknown> = { userId: "u1", email: "user@test.com", expiresAt: new Date() },
  expiresAt?: number
) {
  const exp = expiresAt ?? Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .setIssuedAt()
    .sign(SECRET);
}

function makeRequest(token?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        token && name === COOKIE_NAME ? { value: token } : undefined,
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("sets an httpOnly cookie with the auth token", async () => {
    await createSession("u1", "user@test.com");

    expect(mockCookies.set).toHaveBeenCalledOnce();
    const [name, _token, options] = mockCookies.set.mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect(typeof _token).toBe("string");
    expect(_token.length).toBeGreaterThan(0);
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
    expect(options.expires).toBeInstanceOf(Date);
  });

  test("sets cookie expiry ~7 days in the future", async () => {
    const before = Date.now();
    await createSession("u1", "user@test.com");
    const after = Date.now();

    const [, , options] = mockCookies.set.mock.calls[0];
    const expiry = (options.expires as Date).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiry).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiry).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookies.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns null for an invalid token", async () => {
    mockCookies.get.mockReturnValue({ value: "not.a.valid.jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken({ userId: "u1", email: "user@test.com", expiresAt: new Date() });
    mockCookies.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("u1");
    expect(session?.email).toBe("user@test.com");
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken({ userId: "u1", email: "user@test.com", expiresAt: new Date() }, Math.floor(Date.now() / 1000) - 1);
    mockCookies.get.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth cookie", async () => {
    await deleteSession();
    expect(mockCookies.delete).toHaveBeenCalledWith(COOKIE_NAME);
  });
});

describe("verifySession", () => {
  test("returns null when no cookie is present", async () => {
    expect(await verifySession(makeRequest())).toBeNull();
  });

  test("returns null for an invalid token", async () => {
    expect(await verifySession(makeRequest("bad.token"))).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken({ userId: "u2", email: "other@test.com", expiresAt: new Date() });
    const session = await verifySession(makeRequest(token));
    expect(session?.userId).toBe("u2");
    expect(session?.email).toBe("other@test.com");
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken({ userId: "u2", email: "other@test.com", expiresAt: new Date() }, Math.floor(Date.now() / 1000) - 1);
    expect(await verifySession(makeRequest(token))).toBeNull();
  });
});
