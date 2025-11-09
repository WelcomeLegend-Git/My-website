import fs from "node:fs";
import path from "node:path";

// Ensure required env vars exist for tests to avoid runtime throws in env.ts
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://localhost:3306/jee_study_test";
const dummySecret = "x".repeat(40);
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || dummySecret;
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || dummySecret;
process.env.GEMINI_API_KEYS =
  process.env.GEMINI_API_KEYS || "fake1,fake2,fake3,fake4,fake5,fake6,fake7,fake8";
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads-test";

// Ensure upload directory exists for tests
const uploadDir = path.isAbsolute(process.env.UPLOAD_DIR!)
  ? process.env.UPLOAD_DIR!
  : path.join(process.cwd(), process.env.UPLOAD_DIR!);
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch {
  // ignore
}
