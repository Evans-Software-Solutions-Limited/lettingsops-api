import { describe, it, expect, beforeEach } from "vitest";
import { setToken, getToken, clearToken, isAuthenticated } from "../auth";

describe("auth token store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getToken returns null when nothing is stored", () => {
    expect(getToken()).toBeNull();
  });

  it("isAuthenticated returns false when no token is stored", () => {
    expect(isAuthenticated()).toBe(false);
  });

  it("setToken persists the token so getToken returns it", () => {
    setToken("my-jwt-value");
    expect(getToken()).toBe("my-jwt-value");
  });

  it("isAuthenticated returns true after setToken", () => {
    setToken("some-token");
    expect(isAuthenticated()).toBe(true);
  });

  it("clearToken removes the stored token", () => {
    setToken("will-be-cleared");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("isAuthenticated returns false after clearToken", () => {
    setToken("will-be-cleared");
    clearToken();
    expect(isAuthenticated()).toBe(false);
  });

  it("setToken overwrites any previously stored token", () => {
    setToken("first");
    setToken("second");
    expect(getToken()).toBe("second");
  });
});
