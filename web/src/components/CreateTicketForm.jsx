import { useState } from 'react';
import { api, ApiError } from '../api.js';

const EMPTY = { title: '', description: '', priority: 'Medium', assignedTo: '' };

export default function CreateTicketForm({ users, priorities, currentUserId, onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const ticket = await api.createTicket({
        title: form.title,
        description: form.description,
        priority: form.priority,
        assignedTo: form.assignedTo === '' ? null : Number(form.assignedTo),
        createdBy: currentUserId,
      });
      setForm(EMPTY);
      onCreated(ticket);
    } catch (err) {
      // The backend message is shown as it is. It already names the field and
      // the limit, so rewriting it here would only make the two disagree.
      setError(err instanceof ApiError ? err : new ApiError({ code: 'UNKNOWN', message: String(err) }));
    } finally {
      // In finally, so a failure clears the saving state too. Otherwise the
      // form stays disabled and the user cannot correct the mistake.
      setSaving(false);
    }
  }

  const invalid = (field) => (error?.field === field ? 'invalid' : '');

  return (
    <form className="panel" onSubmit={submit}>
      <h2>New ticket</h2>

      {error && <p className="error-box">{error.message}</p>}

      <label className="field">
        Title
        <input
          className={invalid('title')}
          value={form.title}
          onChange={set('title')}
          maxLength={200}
          placeholder="Short summary of the problem"
        />
      </label>

      <label className="field">
        Description
        <textarea rows={3} className={invalid('description')} value={form.description} onChange={set('description')} />
      </label>

      <div className="row">
        <label className="field">
          Priority
          <select className={invalid('priority')} value={form.priority} onChange={set('priority')}>
            {priorities.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>

        <label className="field">
          Assign to
          <select className={invalid('assignedTo')} value={form.assignedTo} onChange={set('assignedTo')}>
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="actions">
        {/* Disabled while empty as a convenience. The backend rejects an empty
            title regardless, and there is a test for that. */}
        <button type="submit" className="primary" disabled={saving || form.title.trim() === ''}>
          {saving ? 'Creating…' : 'Create ticket'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}
