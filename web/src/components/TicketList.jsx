import { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Cancelled'];

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function TicketList({ onOpen, reloadKey }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // A counter rather than re-setting an existing value. React bails out of a
  // state update when the new value is identical, so the effect would not
  // re-run and the retry button would do nothing.
  const [retryCount, setRetryCount] = useState(0);

  // The search box fires on every keystroke. Without this, typing "printer"
  // sends seven requests and the list flickers through seven results.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // Responses can arrive out of order: a slow request for "pri" can land
    // after a fast one for "printer" and overwrite the newer results with
    // older ones. This flag makes a superseded request throw its answer away.
    let current = true;

    setLoading(true);
    setError(null);

    api
      .listTickets({ search: debouncedSearch, status })
      .then((list) => current && setTickets(list))
      .catch((err) => current && setError(err.message))
      // In finally, so a failed request clears the loading state too.
      // Otherwise the list is stuck showing a spinner with no way out.
      .finally(() => current && setLoading(false));

    return () => {
      current = false;
    };
  }, [debouncedSearch, status, reloadKey, retryCount]);

  const filtered = debouncedSearch !== '' || status !== '';

  return (
    <>
      <div className="filters">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or description"
          aria-label="Search tickets"
        />

        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {filtered && (
          <button onClick={() => { setSearch(''); setStatus(''); }}>Clear</button>
        )}
      </div>

      {error && (
        <div className="state error">
          <p>{error}</p>
          <button onClick={() => setRetryCount((n) => n + 1)}>Retry</button>
        </div>
      )}

      {loading && !error && <p className="state">Loading tickets…</p>}

      {/* Two different empty states. "No tickets match" with a way to clear
          the filters is a different situation from an empty database, and
          showing the wrong one sends the user looking for the wrong problem. */}
      {!loading && !error && tickets.length === 0 && (
        <div className="state">
          {filtered ? (
            <>
              <p>No tickets match this search.</p>
              <button onClick={() => { setSearch(''); setStatus(''); }}>Clear filters</button>
            </>
          ) : (
            <p>No tickets yet. Create the first one.</p>
          )}
        </div>
      )}

      {!loading && !error && tickets.length > 0 && (
        <table className="tickets">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned to</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} onClick={() => onOpen(ticket.id)} tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(ticket.id)}>
                <td className="title">{ticket.title}</td>
                <td><span className={`badge ${ticket.status.replace(' ', '-').toLowerCase()}`}>{ticket.status}</span></td>
                <td>{ticket.priority}</td>
                <td>{ticket.assignedToName ?? <span className="muted">Unassigned</span>}</td>
                <td className="muted">{formatDate(ticket.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
