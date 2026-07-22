import { useEffect, useState } from 'react';
import { api } from './api.js';
import TicketList from './components/TicketList.jsx';
import TicketDetail from './components/TicketDetail.jsx';
import CreateTicketForm from './components/CreateTicketForm.jsx';

// There is no authentication — that is a Stretch item and was left out on
// purpose. The API still needs to know who is acting, so the user is picked
// here and passed as createdBy. This is not security and is recorded as a
// known limitation in the README.
export default function App() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  // Which view is showing. Null means the list. This is the whole of the
  // navigation, which is why there is no router.
  const [openTicketId, setOpenTicketId] = useState(null);
  // Bumped after a change, so the list refetches instead of being patched
  // by hand. One source of truth for what is on screen: the server.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    api
      .listUsers()
      .then((list) => {
        setUsers(list);
        setCurrentUserId(list[0]?.id ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="state">Loading…</p>;

  // A failure here means the app cannot work at all, so it replaces the page
  // rather than showing a banner over an empty shell.
  if (error) {
    return (
      <div className="state error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Support Tickets</h1>
        <label>
          Acting as
          <select
            value={currentUserId ?? ''}
            onChange={(e) => setCurrentUserId(Number(e.target.value))}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </label>
      </header>

      <main>
        {openTicketId ? (
          <TicketDetail
            ticketId={openTicketId}
            users={users}
            currentUserId={currentUserId}
            onBack={() => setOpenTicketId(null)}
            // The list is stale once a ticket changes, so it refetches when
            // the user goes back.
            onChanged={() => setReloadKey((n) => n + 1)}
          />
        ) : (
          <>
            <div className="toolbar">
              <button className="primary" onClick={() => setCreating(true)} disabled={creating}>
                New ticket
              </button>
            </div>

            {creating && (
              <CreateTicketForm
                users={users}
                currentUserId={currentUserId}
                onCancel={() => setCreating(false)}
                onCreated={(ticket) => {
                  setCreating(false);
                  setReloadKey((n) => n + 1);
                  setOpenTicketId(ticket.id);
                }}
              />
            )}

            <TicketList reloadKey={reloadKey} onOpen={setOpenTicketId} />
          </>
        )}
      </main>
    </div>
  );
}
