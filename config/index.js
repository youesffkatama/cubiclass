require("dotenv").config();

const CONFIG = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI,
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRE: "1h",
  JWT_REFRESH_EXPIRE: "7d",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL,
  UPLOAD_DIR: "./uploads",
  VECTOR_DIMENSIONS: 384,
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  NODE_ENV: process.env.NODE_ENV || "development",
};

if (CONFIG.NODE_ENV === "production") {
  const required = [
    "MONGODB_URI",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "OPENROUTER_API_KEY",
    "FRONTEND_URL",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
}

module.exports = CONFIG;
