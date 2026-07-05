import request from "supertest";
import { createApp } from "../src/app";

describe("app routes", () => {
  it("returns health response", async () => {
    const response = await request(createApp()).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("serves the OpenAPI document", async () => {
    const response = await request(createApp()).get("/api/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.info.title).toContain("Distributed Job Scheduler");
  });

  it("protects metrics without an access token", async () => {
    const response = await request(createApp()).get("/api/metrics");
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Authentication required");
  });
});
