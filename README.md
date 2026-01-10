# 🎓 Scholar.AI

**Enterprise-grade AI-powered study assistant with Retrieval-Augmented Generation (RAG) capabilities.**

[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)](https://www.mongodb.com/atlas)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🚀 Features

### Core Capabilities

- **📄 PDF Processing**: Advanced text extraction with OCR fallback for scanned documents
- **🧠 Local Embeddings**: Zero-cost vectorization using Xenova transformers (all-MiniLM-L6-v2)
- **💬 RAG Chat System**: Context-aware conversations with streaming responses
- **🎭 AI Personas**: Unique AI tutors generated from document content
- **📚 Content Generation**: Automatic flashcards and quiz creation
- **📊 Analytics Dashboard**: Study heatmaps, progress tracking, and insights
- **📅 Study Planner**: AI-powered study schedules with spaced repetition

### Advanced Features

- **🤝 Debate Engine**: AI vs AI debates using different documents
- **🔍 Vector Search**: MongoDB Atlas Vector Search for semantic similarity
- **⚡ Background Processing**: BullMQ worker queues for scalable PDF processing
- **🔐 Authentication**: JWT-based auth with refresh tokens
- **🛡️ Security**: Rate limiting, input sanitization, helmet protection
- **📈 Gamification**: XP system, levels, ranks, badges, and streaks

## 📋 Tech Stack

| Category           | Technology                         |
| ------------------ | ---------------------------------- |
| **Runtime**        | Node.js 20+ LTS                    |
| **Language**       | TypeScript 5.3                     |
| **Framework**      | Express.js                         |
| **Database**       | MongoDB Atlas (with Vector Search) |
| **Cache/Queue**    | Redis + BullMQ                     |
| **AI/LLM**         | OpenRouter (Mistral, Llama 3)      |
| **Embeddings**     | @xenova/transformers (local)       |
| **PDF Processing** | pdf-parse, Tesseract.js, pdf-lib   |
| **Real-time**      | Socket.io                          |
| **Validation**     | Zod                                |
| **Logging**        | Winston                            |
| **Testing**        | Jest (ready)                       |

## 🏗️ Architecture

```
scholar-ai-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── models/          # MongoDB schemas (User, KnowledgeNode, VectorChunk, etc.)
│   ├── services/        # Business logic (ingestion, chat, vectorization, etc.)
│   ├── controllers/     # Request handlers (auth, workspace, intelligence, analytics)
│   ├── middleware/      # Express middleware (auth, validation, rate limiting, errors)
│   ├── routes/          # API route definitions
│   ├── workers/         # Background job processors (PDF processing queue)
│   ├── utils/           # Helper functions and utilities
│   └── app.ts           # Main application entry point
├── logs/                # Application logs (auto-generated)
├── uploads/             # File upload directory
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🚦 Quick Start

### Prerequisites

- **Node.js** 20+ LTS
- **MongoDB Atlas** account (free M0 tier)
- **Redis** instance (local or cloud)
- **OpenRouter API** key (free tier available)

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd scholar-ai-backend

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit `.env` with your credentials (do NOT commit real secrets to git)
nano .env

# TIP: The repository contains `.env.example` — use it as a guide when creating your `.env` file.
```

**Critical Environment Variables:**

```env
MONGODB_URI=mongodb+srv://...
REDIS_HOST=your-redis-host
REDIS_PORT=6379
OPENROUTER_API_KEY=sk-or-v1-...
JWT_SECRET=your-secret-key
```

### 3. MongoDB Atlas Vector Search Setup

**CRITICAL**: You must create a Vector Search Index manually:

1. Go to MongoDB Atlas → Your Cluster → Search
2. Click "Create Search Index"
3. Choose "JSON Editor"
4. Paste this configuration:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "embedding": {
        "type": "knnVector",
        "dimensions": 384,
        "similarity": "cosine"
      }
    }
  }
}
```

5. Name it: `vector_index`
6. Apply to collection: `vectorchunks`

### 4. Start Development Server

```bash
# Start Redis (if local)
redis-server

# In one terminal - Start main server
npm run dev

# In another terminal - Start worker
npm run worker
```

Server will be available at: `http://localhost:3000`

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Register user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

## 📡 API Endpoints

### Authentication (`/api/v1/auth`)

- `POST /register` - Register new user
- `POST /login` - Login user
- `POST /refresh` - Refresh access token
- `GET /me` - Get current user
- `PATCH /profile` - Update profile
- `POST /change-password` - Change password
- `DELETE /account` - Delete account

### Workspace (`/api/v1/workspace`)

- `POST /upload` - Upload PDF file
- `GET /files` - List all documents
- `GET /files/:id` - Get document details
- `DELETE /files/:id` - Delete document
- `PATCH /files/:id/tags` - Update document tags
- `GET /files/:id/status` - Get processing status
- `GET /stats` - Workspace statistics

### Intelligence (`/api/v1/intelligence`)

- `POST /chat/stream` - Stream chat response (SSE)
- `GET /chat/conversations` - List conversations
- `GET /chat/conversations/:id` - Get conversation
- `DELETE /chat/conversations/:id` - Delete conversation
- `POST /flashcards` - Generate flashcards
- `POST /quiz` - Generate quiz questions
- `GET /summary/:nodeId` - Get document summary
- `POST /persona/update` - Update AI persona
- `POST /debate` - Generate AI debate
- `POST /search` - Search across documents

### Analytics (`/api/v1/analytics`)

- `GET /heatmap` - Study heatmap data
- `GET /subjects` - Subject distribution
- `GET /performance` - Performance metrics
- `GET /knowledge-gaps` - Identify weak areas
- `GET /trend` - Learning trend
- `GET /dashboard` - Complete dashboard
- `POST /study-plan` - Create study plan
- `GET /study-plans` - List study plans
- `GET /study-plans/:id` - Get study plan
- `POST /study-plans/:id/complete-task` - Complete task
- `DELETE /study-plans/:id` - Delete study plan
- `POST /knowledge-graph` - Generate knowledge graph
- `GET /badges` - User badges

## 🔧 Configuration

### Rate Limits (per user/IP)

- **Auth endpoints**: 5 requests / 15 minutes
- **File upload**: 5 uploads / day
- **Chat**: 50 messages / hour
- **Generation**: 20 requests / hour
- **General API**: 100 requests / 15 minutes

### Subscription Plans

- **Free**: Basic features, standard rate limits
- **Pro**: 3x rate limits, priority processing
- **Enterprise**: 10x rate limits, custom features

## 🧪 Development

### Run Tests

```bash
npm test
```

### Build for Production

```bash
npm run build
npm start
```

### Code Quality

```bash
# Linting
npm run lint

# Formatting
npm run format
```

## 🚢 Deployment

### Docker Deployment (Coming Soon)

```bash
docker build -t scholar-ai-backend .
docker run -p 3000:3000 --env-file .env scholar-ai-backend
```

### Environment-Specific Configs

- Copy `.env.example` to `.env.production`
- Set `NODE_ENV=production`
- Use strong JWT secrets
- Enable SSL for MongoDB and Redis
- Set up proper CORS origins

### Recommended Services

- **Hosting**: Railway, Render, Fly.io, AWS EC2
- **Database**: MongoDB Atlas (M0 free tier)
- **Redis**: Redis Cloud (free 30MB)
- **File Storage**: AWS S3, Cloudinary, or local volume

## 📊 Monitoring

### Log Files

Logs are stored in `./logs/`:

- `application-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Error logs only

### Health Checks

```bash
curl http://localhost:3000/api/v1/health
```

### Queue Monitoring

Access BullMQ dashboard (if installed):

```bash
npm install -g @bull-board/cli
bull-board
```

## 🔒 Security Features

- ✅ Helmet security headers
- ✅ CORS protection
- ✅ NoSQL injection prevention
- ✅ JWT authentication
- ✅ Rate limiting per user/IP
- ✅ Input validation with Zod
- ✅ Password hashing with bcrypt
- ✅ Request sanitization
- ✅ Error handling without stack traces in production

## 🎯 Performance Optimizations

- ✅ Local embeddings (no API costs)
- ✅ Background job processing
- ✅ Database indexing
- ✅ Response compression
- ✅ Connection pooling
- ✅ Efficient vector search
- ✅ Batch operations

## 🐛 Troubleshooting

### MongoDB Connection Issues

- Verify MONGODB_URI is correct
- Check IP whitelist in Atlas
- Ensure network access is configured

### Vector Search Not Working

- Verify index name is `vector_index`
- Check dimensions are set to 384
- Ensure index is on `vectorchunks` collection

### Worker Not Processing Files

- Check Redis connection
- Verify REDIS_HOST and REDIS_PORT
- Ensure worker is running: `npm run worker`

### OpenRouter API Errors

- Verify API key is valid
- Check rate limits
- Try different free models

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📧 Support

For issues and questions:

- Open an issue on GitHub
- Email: support@scholar-ai.com
- Documentation: https://docs.scholar-ai.com

---

**Built with ❤️ by the Scholar.AI Team**
