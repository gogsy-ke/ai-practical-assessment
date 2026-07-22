import { useEffect, useState } from 'react';
import { api } from './api.js';
import TicketList from './components/TicketList.jsx';
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
            onCreated={() => {
              setCreating(false);
              setReloadKey((n) => n + 1);
            }}
          />
        )}

        <TicketList reloadKey={reloadKey} onOpen={(id) => console.log('open', id)} />
      </main>
    </div>
  );
}
