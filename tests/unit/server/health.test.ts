import { describe, it, expect } from "vitest";
import { checkDatabaseConnection } from "../../../server/db";

describe("Health Check", () => {
  it("should have checkDatabaseConnection function", () => {
    expect(checkDatabaseConnection).toBeDefined();
    expect(typeof checkDatabaseConnection).toBe("function");
  });
});
