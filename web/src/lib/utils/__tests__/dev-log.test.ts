/**
 * lib/utils/__tests__/dev-log.test.ts
 *
 * Unit tests for the dev-log production guard.
 */

describe("utils/dev-log", () => {
  const originalEnv = process.env.NODE_ENV;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    jest.resetModules();
  });

  describe("devLog", () => {
    it("logs in development", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      jest.isolateModules(() => {
        const { devLog } = require("../dev-log");
        devLog("hello", 42);
        expect(consoleSpy).toHaveBeenCalledWith("hello", 42);
      });
    });

    it("logs in test environment", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      jest.isolateModules(() => {
        const { devLog } = require("../dev-log");
        devLog("test message");
        expect(consoleSpy).toHaveBeenCalledWith("test message");
      });
    });

    it("does NOT log in production", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      jest.isolateModules(() => {
        const { devLog } = require("../dev-log");
        devLog("should not appear");
        expect(consoleSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe("devLogJson", () => {
    it("logs stringified JSON in development", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      jest.isolateModules(() => {
        const { devLogJson } = require("../dev-log");
        const obj = { event: "test", value: 123 };
        devLogJson(obj);
        expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(obj));
      });
    });

    it("does NOT log in production", () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      jest.isolateModules(() => {
        const { devLogJson } = require("../dev-log");
        devLogJson({ secret: "data" });
        expect(consoleSpy).not.toHaveBeenCalled();
      });
    });
  });
});
