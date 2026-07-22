// HTTP only. Read the request, call the service, send the response.
// No business rules here — in particular, nothing in this file decides
// whether a status change is allowed.

import { Router } from 'express';
import * as tickets from '../services/ticketService.js';

export const ticketRoutes = Router();

// Errors are thrown by the service and handled by errorHandler. better-sqlite3
// is synchronous, so a throw inside a handler is caught by Express directly
// and there is no need to wrap these in try/catch.

ticketRoutes.get('/', (req, res) => {
  res.json(tickets.listTickets());
});

ticketRoutes.post('/', (req, res) => {
  res.status(201).json(tickets.createTicket(req.body));
});

ticketRoutes.get('/:id', (req, res) => {
  res.json(tickets.getTicket(req.params.id));
});

ticketRoutes.patch('/:id', (req, res) => {
  res.json(tickets.updateTicket(req.params.id, req.body));
});

// Status gets its own route. Keeping it out of PATCH means a status change
// cannot slip through the plain field path without the state machine check.
ticketRoutes.post('/:id/status', (req, res) => {
  res.json(tickets.changeStatus(req.params.id, req.body.status));
});
