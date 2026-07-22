import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import CommentSection from './CommentSection.jsx';

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export default function TicketDetail({ ticketId, users, currentUserId, onBack, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Errors from an action, kept apart from the load error above. A failed
  // status change should show a message on a page that still works, not
  // replace the whole ticket with an error screen.
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    api
      .getTicket(ticketId)
      .then(setTicket)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(load, [load]);

  async function run(action) {
    setBusy(true);
    setActionError(null);

    try {
      await action();
      // Reload rather than patching local state, so what is on screen is
      // what the server actually stored, including updatedAt and the new
      // list of allowed transitions.
      const fresh = await api.getTicket(ticketId);
      setTicket(fresh);
      setEditing(false);
      onChanged();
    } catch (err) {
      // The backend message is shown as it is. For a rejected transition it
      // already names which statuses were allowed instead.
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="state">Loading ticket…</p>;

  if (error) {
    return (
      <div className="state error">
        <p>{error}</p>
        <button onClick={load}>Retry</button>
        <button onClick={onBack}>Back to list</button>
      </div>
    );
  }

  const startEditing = () => {
    setForm({
      title: ticket.title,
      description: ticket.description ?? '',
      priority: ticket.priority,
      assignedTo: ticket.assignedTo ?? '',
    });
    setActionError(null);
    setEditing(true);
  };

  const save = () =>
    run(() =>
      api.updateTicket(ticketId, {
        title: form.title,
        description: form.description,
        priority: form.priority,
        assignedTo: form.assignedTo === '' ? null : Number(form.assignedTo),
      }),
    );

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <>
      <button className="back" onClick={onBack}>← Back to list</button>

      <section className="panel">
        <div className="detail-head">
          <h2>{ticket.title}</h2>
          <span className={`badge ${ticket.status.replace(' ', '-').toLowerCase()}`}>
            {ticket.status}
          </span>
        </div>

        {actionError && <p className="error-box">{actionError}</p>}

        {editing ? (
          <>
            <label className="field">
              Title
              <input value={form.title} onChange={set('title')} maxLength={200} />
            </label>

            <label className="field">
              Description
              <textarea rows={4} value={form.description} onChange={set('description')} />
            </label>

            <div className="row">
              <label className="field">
                Priority
                <select value={form.priority} onChange={set('priority')}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>

              <label className="field">
                Assigned to
                <select value={form.assignedTo} onChange={set('assignedTo')}>
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="actions">
              <button className="primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p className="description">
              {ticket.description || <span className="muted">No description.</span>}
            </p>

            <dl className="meta">
              <div><dt>Priority</dt><dd>{ticket.priority}</dd></div>
              <div>
                <dt>Assigned to</dt>
                <dd>{ticket.assignedToName ?? <span className="muted">Unassigned</span>}</dd>
              </div>
              <div><dt>Created by</dt><dd>{ticket.createdByName}</dd></div>
              <div><dt>Created</dt><dd>{formatDateTime(ticket.createdAt)}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDateTime(ticket.updatedAt)}</dd></div>
            </dl>

            <div className="actions">
              <button onClick={startEditing} disabled={busy}>Edit ticket</button>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Status</h2>

        {/* Buttons come from allowedTransitions on the response, not from a
            copy of the rule kept here. The frontend has no opinion about
            which moves are legal, so it cannot disagree with the backend. */}
        {ticket.allowedTransitions.length === 0 ? (
          <p className="muted">
            This ticket is {ticket.status}. No further status changes are possible.
          </p>
        ) : (
          <div className="actions">
            {ticket.allowedTransitions.map((next) => (
              <button
                key={next}
                disabled={busy}
                onClick={() => run(() => api.changeStatus(ticketId, next))}
              >
                Move to {next}
              </button>
            ))}
          </div>
        )}
      </section>

      <CommentSection
        ticketId={ticketId}
        comments={ticket.comments}
        currentUserId={currentUserId}
        onAdded={load}
      />
    </>
  );
}
