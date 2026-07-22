// Was defined three times across the components, twice identically.
// Pulled out during code review. See code-review-notes.md, finding 4.

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
