// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockPrismaUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: mockPrismaUser },
}));

const { mockCreateSession, mockDeleteSession, mockGetSession } = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockDeleteSession: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createSession: mockCreateSession,
  deleteSession: mockDeleteSession,
  getSession: mockGetSession,
}));

const mockRevalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

const mockRedirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn(),
  },
}));

import bcrypt from "bcrypt";
import { signUp, signIn, signOut, getUser } from "@/actions/index";

const mockBcrypt = bcrypt as { hash: ReturnType<typeof vi.fn>; compare: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signUp", () => {
  test("creates a user and session with valid credentials", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);
    mockPrismaUser.create.mockResolvedValue({ id: "u1", email: "user@test.com" });

    const result = await signUp("user@test.com", "password123");

    expect(result).toEqual({ success: true });
    expect(mockPrismaUser.create).toHaveBeenCalledWith({
      data: { email: "user@test.com", password: "hashed-password" },
    });
    expect(mockCreateSession).toHaveBeenCalledWith("u1", "user@test.com");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  test("returns error when email is missing", async () => {
    const result = await signUp("", "password123");
    expect(result).toEqual({ success: false, error: "Email and password are required" });
    expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
  });

  test("returns error when password is missing", async () => {
    const result = await signUp("user@test.com", "");
    expect(result).toEqual({ success: false, error: "Email and password are required" });
    expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
  });

  test("returns error when password is less than 8 characters", async () => {
    const result = await signUp("user@test.com", "short");
    expect(result).toEqual({ success: false, error: "Password must be at least 8 characters" });
    expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
  });

  test("returns error when email is already registered", async () => {
    mockPrismaUser.findUnique.mockResolvedValue({ id: "u1", email: "user@test.com" });

    const result = await signUp("user@test.com", "password123");
    expect(result).toEqual({ success: false, error: "Email already registered" });
    expect(mockPrismaUser.create).not.toHaveBeenCalled();
  });

  test("returns error when database throws", async () => {
    mockPrismaUser.findUnique.mockRejectedValue(new Error("DB error"));

    const result = await signUp("user@test.com", "password123");
    expect(result).toEqual({ success: false, error: "An error occurred during sign up" });
  });

  test("hashes password with salt rounds of 10", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);
    mockPrismaUser.create.mockResolvedValue({ id: "u1", email: "user@test.com" });

    await signUp("user@test.com", "password123");

    expect(mockBcrypt.hash).toHaveBeenCalledWith("password123", 10);
  });
});

describe("signIn", () => {
  test("creates a session for valid credentials", async () => {
    mockPrismaUser.findUnique.mockResolvedValue({
      id: "u1",
      email: "user@test.com",
      password: "hashed-password",
    });
    mockBcrypt.compare.mockResolvedValue(true as never);

    const result = await signIn("user@test.com", "password123");

    expect(result).toEqual({ success: true });
    expect(mockCreateSession).toHaveBeenCalledWith("u1", "user@test.com");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  test("returns error when email is missing", async () => {
    const result = await signIn("", "password123");
    expect(result).toEqual({ success: false, error: "Email and password are required" });
    expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
  });

  test("returns error when password is missing", async () => {
    const result = await signIn("user@test.com", "");
    expect(result).toEqual({ success: false, error: "Email and password are required" });
    expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
  });

  test("returns error when user does not exist", async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);

    const result = await signIn("nobody@test.com", "password123");
    expect(result).toEqual({ success: false, error: "Invalid credentials" });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test("returns error when password is incorrect", async () => {
    mockPrismaUser.findUnique.mockResolvedValue({
      id: "u1",
      email: "user@test.com",
      password: "hashed-password",
    });
    mockBcrypt.compare.mockResolvedValue(false as never);

    const result = await signIn("user@test.com", "wrongpassword");
    expect(result).toEqual({ success: false, error: "Invalid credentials" });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  test("returns error when database throws", async () => {
    mockPrismaUser.findUnique.mockRejectedValue(new Error("DB error"));

    const result = await signIn("user@test.com", "password123");
    expect(result).toEqual({ success: false, error: "An error occurred during sign in" });
  });
});

describe("signOut", () => {
  test("deletes session, revalidates path, and redirects", async () => {
    await signOut();

    expect(mockDeleteSession).toHaveBeenCalledOnce();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });
});

describe("getUser", () => {
  test("returns null when no session exists", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await getUser();
    expect(result).toBeNull();
    expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
  });

  test("returns user data when session and user exist", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "user@test.com" });
    const fakeUser = { id: "u1", email: "user@test.com", createdAt: new Date() };
    mockPrismaUser.findUnique.mockResolvedValue(fakeUser);

    const result = await getUser();

    expect(result).toEqual(fakeUser);
    expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { id: true, email: true, createdAt: true },
    });
  });

  test("returns null when user is not found in database", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "user@test.com" });
    mockPrismaUser.findUnique.mockResolvedValue(null);

    const result = await getUser();
    expect(result).toBeNull();
  });

  test("returns null when database throws", async () => {
    mockGetSession.mockResolvedValue({ userId: "u1", email: "user@test.com" });
    mockPrismaUser.findUnique.mockRejectedValue(new Error("DB error"));

    const result = await getUser();
    expect(result).toBeNull();
  });
});
