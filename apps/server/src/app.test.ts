import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("app", () => {
  const app = createApp();

  it("returns ok for health check", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });
});