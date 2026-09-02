process.env.AUTH_SECRET ??= "vitest-test-secret-at-least-32-characters-long";
process.env.AUTH_URL ??= "http://localhost:3000";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/jobbot_test";
process.env.LLM_BASE_URL ??= "http://127.0.0.1:8080/v1";
process.env.LLM_MODEL ??= "test-model";
