# Candidate Information

Name: Gurpreet Singh
Role: Senior Software Engineer
Primary Technology Stack: JavaScript (Node.js, React)
Primary AI Tool Used: Claude (Claude Code)
Project Option Selected: Support Ticket Management System (Backend-heavy)
Assessment Start Date: 2026-07-22
Submission Date: 2026-07-22

## Project Summary

A small support ticket system for internal users. Users can create tickets,
view them in a list, open a ticket to see details, edit ticket fields, add
comments, and move a ticket through its status lifecycle.

The main rule in the system is the status state machine. A ticket can only
move between certain statuses. Any other move is rejected by the backend and
shown as a clear error in the UI.

## Tools Used

| Tool | Used for |
|------|----------|
| Claude Code | Requirement analysis, design, code generation, tests, review |
| Node.js + Express | Backend API |
| React + Vite | Frontend |
| SQLite + better-sqlite3 | Database |
| Vitest + Supertest | Integration tests |

## Setup Summary

Full steps are in README.md. Short version:

1. `npm install` in the project root
2. `npm run db:setup` to create the database and load seed data
3. `npm run dev` to start backend and frontend together

No external database server is needed. SQLite writes to a local file.
