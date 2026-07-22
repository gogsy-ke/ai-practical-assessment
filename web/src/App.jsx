import { useEffect, useState } from 'react';
import { api } from './api.js';

// There is no authentication — that is a Stretch item and was left out on
// purpose. The API still needs to know who is acting, so the user is picked
// here and passed as createdBy. This is not security and is recorded as a
// known limitation in the README.
export default function App() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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
        <p className="state">Ticket list is built in the next step.</p>
      </main>
    </div>
  );
}
