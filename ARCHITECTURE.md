# Scholar.AI - Architecture Documentation

## Project Structure

```
cubiclass/
├── server.js                 # Main entry point (minimal)
├── package.json
├── .env
├── .gitignore
├── README.md
├── config/
│   ├── index.js             # Configuration management
│   └── database.js          # Database configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   ├── validation.js        # Input validation middleware
│   ├── error-handler.js     # Error handling middleware
│   └── rate-limiter.js      # Rate limiting middleware
├── models/
│   ├── User.js
│   ├── KnowledgeNode.js
│   ├── VectorChunk.js
│   ├── Conversation.js
│   ├── StudyPlan.js
│   ├── ActivityLog.js
│   ├── Class.js
│   ├── Task.js
│   ├── Note.js
│   └── Notification.js
├── routes/
│   ├── index.js             # Main route aggregator
│   └── api/
│       ├── v1/
│       │   ├── auth.js
│       │   ├── user.js
│       │   ├── workspace.js
│       │   ├── intelligence.js
│       │   ├── classes.js
│       │   ├── tasks.js
│       │   ├── notes.js
│       │   ├── notifications.js
│       │   └── analytics.js
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── workspaceController.js
│   ├── intelligenceController.js
│   ├── classController.js
│   ├── taskController.js
│   ├── noteController.js
│   ├── notificationController.js
│   └── analyticsController.js
├── services/
│   ├── authService.js
│   ├── userService.js
│   ├── aiService.js
│   ├── pdfService.js
│   ├── vectorService.js
│   ├── notificationService.js
│   ├── gamificationService.js
│   ├── queueService.js
│   └── logger.js
├── utils/
│   ├── validators.js        # Zod schemas
│   ├── helpers.js           # Helper functions
│   └── constants.js         # Constants
└── public/
    └── script.js            # Refactored frontend code
```

## Architecture Overview

### Backend Architecture

#### 1. Server Layer (`server.js`)

- Entry point for the application
- Sets up Express app with security middleware
- Initializes database connection
- Configures Socket.IO with authentication
- Implements centralized error handling
- Includes health check endpoint

#### 2. Configuration Layer (`config/`)

- Environment variable management
- Database configuration
- API keys and secrets handling
- Environment-specific settings

#### 3. Middleware Layer (`middleware/`)

- Authentication middleware with JWT validation
- Input validation using Zod schemas
- Rate limiting for API protection
- Error handling middleware
- Request logging and monitoring

#### 4. Models Layer (`models/`)

- Mongoose schemas for all data entities
- Database indexing strategies
- Validation rules and constraints
- Relationships between entities

#### 5. Routes Layer (`routes/`)

- RESTful API endpoints
- Versioned API structure (v1)
- Route organization by domain
- Proper HTTP method usage

#### 6. Controllers Layer (`controllers/`)

- Business logic separation
- Request/response handling
- Data transformation
- Service layer orchestration

#### 7. Services Layer (`services/`)

- Core business logic implementation
- External API integrations
- Data access operations
- Domain-specific utilities

#### 8. Utilities Layer (`utils/`)

- Validation schemas (Zod)
- Helper functions
- Constants and enums
- Utility classes

### Frontend Architecture

#### 1. API Client (`ApiClient` class)

- Centralized API request handling
- Error handling and retry logic
- Token refresh mechanism
- Request/response interceptors

#### 2. State Management (`AppStateManager` class)

- Centralized application state
- Observer pattern for state changes
- Local storage persistence
- Reactive updates

#### 3. Error Boundaries (`ErrorBoundary` class)

- Component-level error handling
- Graceful degradation
- User-friendly error messages
- Error reporting

#### 4. Utilities (`Utils` class)

- Common helper functions
- UI interaction utilities
- Data formatting functions
- Storage management

#### 5. Socket Management (`SocketManager` class)

- WebSocket connection handling
- Reconnection logic
- Event management
- Authentication integration

## Security Features

### Backend Security

- Helmet.js for HTTP header security
- CORS configuration with origin validation
- Rate limiting to prevent abuse
- Input sanitization to prevent injection attacks
- JWT authentication with refresh tokens
- Secure password hashing
- Environment-based security configurations

### Frontend Security

- Secure token storage
- Input validation and sanitization
- CSRF protection
- Secure API communication
- Error masking in production

## Performance Optimizations

### Backend

- Database connection pooling
- Request compression
- Caching strategies
- Efficient query patterns
- Asynchronous processing with BullMQ
- Resource cleanup and graceful shutdown

### Frontend

- Bundle optimization
- Lazy loading of components
- Efficient DOM manipulation
- Memory leak prevention
- Performance monitoring

## Error Handling Strategy

### Backend

- Centralized error handling middleware
- Structured logging with Winston
- Graceful degradation
- Comprehensive error responses
- Unhandled promise rejection handling

### Frontend

- Global error boundaries
- Network error handling
- User-friendly error messages
- Automatic retry mechanisms
- Session management on errors

## Deployment Considerations

### Production Requirements

- Environment-specific configurations
- SSL/TLS termination
- Load balancing support
- Database connection management
- Monitoring and logging setup
- Security header enforcement

### Scaling Factors

- Horizontal scaling capabilities
- Database connection optimization
- Caching layer integration
- CDN for static assets
- Queue processing for heavy tasks
