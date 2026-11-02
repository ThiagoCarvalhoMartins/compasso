import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "mysql://test:test@localhost:3306/compasso_test",
      JWT_SECRET: "test-secret-with-at-least-32-characters!!",
    },
  },
});
