import { register } from "../instrumentation";

// Snapshot the original env so we can restore after each test
const originalEnv = { ...process.env };

beforeEach(() => {
  // Start each test with a clean env (no leftover vars from prior tests)
  process.env = { ...originalEnv };

  // Remove all vars the module checks so tests are explicit about what's set
  delete process.env.NEXT_RUNTIME;
  delete process.env.JTG_JWT_SECRET;
  delete process.env.OPENAI_API_KEY;
  delete process.env.JTG_SESSION_SECRET;
  delete process.env.JTG_ADMIN_TOKEN;

  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe("register()", () => {
  it("throws in production when JTG_JWT_SECRET is missing", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    await expect(register()).rejects.toThrow("Missing required env var: JTG_JWT_SECRET");
  });

  it("does not throw in development when JTG_JWT_SECRET is missing, but warns", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";

    await expect(register()).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Missing env var JTG_JWT_SECRET")
    );
  });

  it("does not throw or warn about required vars when all are present", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.JTG_JWT_SECRET = "test-secret";
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.JTG_SESSION_SECRET = "session-secret";
    process.env.JTG_ADMIN_TOKEN = "admin-token";

    await expect(register()).resolves.toBeUndefined();

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("warns about missing recommended vars but does not throw", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.JTG_JWT_SECRET = "test-secret";
    // All recommended vars are missing

    await expect(register()).resolves.toBeUndefined();

    const warnCall = (console.warn as jest.Mock).mock.calls[0][0] as string;
    expect(warnCall).toContain("OPENAI_API_KEY");
    expect(warnCall).toContain("JTG_SESSION_SECRET");
    expect(warnCall).toContain("JTG_ADMIN_TOKEN");
    expect(warnCall).toContain("3 warning(s)");
  });

  it("skips all validation when NEXT_RUNTIME is 'edge'", async () => {
    process.env.NEXT_RUNTIME = "edge";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    // JTG_JWT_SECRET is missing — would normally throw in production

    await expect(register()).resolves.toBeUndefined();

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
