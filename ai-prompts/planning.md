# AI Prompts — Planning

Tool: Claude Code.

## 1. Planning the order of work

**Prompt (summary)**
Asked for a step-by-step approach to get through the whole exercise.

**AI response (summary)**
A five-phase plan: setup, planning documents, backend and state machine,
frontend, review and polish. Recommended writing the documents alongside the
code rather than at the end.

**What I accepted**
Building the state machine first, before the CRUD endpoints. The reasoning was
that it is the hardest rule in the project and everything else is easier once
it is settled.

Also accepted writing debugging notes at the time the bug happens. Writing
them a week later from memory would produce vague notes.

**What I rejected**
The suggestion to create every markdown file up front as an empty shell. A
folder of empty files is worse than files that appear as the work is done, and
it makes it easy to forget to fill one in. I create each document when I reach
the work it describes.

## 2. Choosing the stack

**Prompt (summary)**
Asked which stack to use.

**AI response (summary)**
Node + Express + React + SQLite. SQLite so a reviewer can clone and run with
no database server to install.

**What I accepted**
All of it. The SQLite reasoning is the strongest part. One of the listed
failure modes in the brief is "broken setup instructions", and every extra
install step is a chance for setup to fail on the reviewer's machine.

**What I questioned**
Whether SQLite looks too easy compared to PostgreSQL. I decided it does not.
The brief lists SQLite as an acceptable option, and the requirement being
tested is that persistence works and the setup runs, not that the database is
impressive.

## 3. Requirement analysis

**Prompt (summary)**
Asked for the gaps and ambiguities in the brief that I had not spotted, rather
than a summary of what it already says.

**AI response (summary)**
Raised questions about reopening Closed tickets, commenting on closed
tickets, editing closed tickets, who is allowed to change status, and what
happens on concurrent status changes.

**What I accepted**
The reopening question is the strongest one. The state machine has no path out
of Closed or Cancelled, which means both are final. That is unusual for a real
support tool, so it is worth flagging as a product question rather than
silently implementing it.

The concurrency point also stuck. The check has to run against the stored
status at the time of the request, not the status the browser last saw.

**What I rejected**
A suggestion to add an audit log table for status changes. It is real value in
a production system, but it is not in Core and not in the acceptance criteria.
Adding it would grow the app while the brief explicitly says to spend that
time on the lifecycle documents instead.

I also left role-based permissions out. The User entity has a `role` field, so
it is tempting, but roles are listed under Stretch.

**What I changed**
The generated assumption list was written as flat statements. I rewrote each
one to say why the scope is drawn there, since an assumption without a reason
is not useful to a reviewer.
