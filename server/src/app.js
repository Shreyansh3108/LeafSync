const express = require('express');
const cookieParser = require('cookie-parser');
const requestId = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');

const authRoutes = require('./modules/auth/routes');
const booksRoutes = require('./modules/books/routes');
const ticketsRoutes = require('./modules/tickets/routes');
const adminRoutes = require('./modules/admin/routes');
const sseRoutes = require('./modules/events/sse.routes');
const docsRoutes = require('./docs/openapi');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(requestId);

// OpenAPI Docs (/api/docs & /api/openapi.json)
app.use('/api', docsRoutes);

// API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/books', booksRoutes);
app.use('/api/v1/tickets', ticketsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/events', sseRoutes);

// Health check route
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// 404 Handler
app.use((req, res, next) => {
  next(new AppError('NOT_FOUND', 404, 'Route not found'));
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;