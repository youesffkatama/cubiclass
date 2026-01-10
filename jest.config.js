module.exports = {
  transform: {
    '^.+\.js$': 'babel-jest',
  },
  testEnvironment: 'node',
  transformIgnorePatterns: [
    '/node_modules/(?!(@xenova|transformers|pdf-parse|natural|winston|bullmq|ioredis|csurf|express-rate-limit|express-mongo-sanitize|helmet|cors|jsonwebtoken|bcryptjs|mongoose|dotenv|supertest|mongodb-memory-server|swagger-ui-express|swagger-jsdoc|zod|nodemailer|openai))',
  ],
};

