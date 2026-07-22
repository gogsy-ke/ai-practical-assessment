import { Router } from 'express';
import { db } from '../db.js';

export const userRoutes = Router();

// Read only. Users are seeded, and there is no user management UI.
// The frontend needs this for the assignee dropdown.
userRoutes.get('/', (req, res) => {
  res.json(db.prepare('SELECT id, name, email, role FROM users ORDER BY name').all());
});
