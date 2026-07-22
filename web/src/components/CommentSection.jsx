import { useState } from 'react';
import { api } from '../api.js';
import { formatDateTime } from '../formatDate.js';

export default function CommentSection({ ticketId, comments, currentUserId, onAdded }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await api.addComment(ticketId, { message, createdBy: currentUserId });
      setMessage('');
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <h2>Comments</h2>

      {comments.length === 0 && <p className="muted">No comments yet.</p>}

      <ul className="comments">
        {comments.map((comment) => (
          <li key={comment.id}>
            <div className="comment-meta">
              <strong>{comment.createdByName}</strong>
              <span className="muted">{formatDateTime(comment.createdAt)}</span>
            </div>
            <p>{comment.message}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={submit}>
        {error && <p className="error-box">{error}</p>}

        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a comment"
          maxLength={2000}
          aria-label="Comment message"
        />

        <div className="actions">
          <button type="submit" className="primary" disabled={saving || message.trim() === ''}>
            {saving ? 'Adding…' : 'Add comment'}
          </button>
        </div>
      </form>
    </section>
  );
}
