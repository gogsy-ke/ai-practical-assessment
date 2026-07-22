import express from 'express';
import { ticketRoutes } from './routes/tickets.js';
import { userRoutes } from './routes/users.js';
import { errorHandler, notFound } from './errors.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use('/api/tickets', ticketRoutes);
  app.use('/api/users', userRoutes);

  // An unknown path returns the same error shape as everything else, rather
  // than Express's default HTML page.
  app.use((req, res, next) => next(notFound('Route')));

  // Last, so it sees errors thrown by any route above.
  app.use(errorHandler);

  return app;
}
