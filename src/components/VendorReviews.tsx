import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { createReview, deleteReview, updateReview, uploadReviewPhoto, validateReviewPhotos } from '../lib/reviews';
import type { Review, ReviewInput, ReviewLineStatus, ReviewWithPhotos, Vendor } from '../types';

const emptyInput: ReviewInput = {
  recommend: true,
  menu_name: '',
  price: null,
  reason: null,
  comment: null,
  line_status: null,
};

export function VendorReviews({
  vendor,
  reviews,
  loading,
  unavailable,
  refresh,
  notify,
}: {
  vendor: Vendor;
  reviews: ReviewWithPhotos[];
  loading: boolean;
  unavailable: boolean;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const { user, requireAuth } = useAuth();
  const [editing, setEditing] = useState<Review | null | undefined>();

  const openCreate = () => requireAuth(() => setEditing(null));
  const openEdit = (review: Review) => setEditing(review);

  const remove = async (review: Review) => {
    if (!user || !confirm('Delete this review?')) return;
    try {
      await deleteReview(review.id, user.id);
      await refresh();
      notify('Review deleted');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not delete review.');
    }
  };

  return (
    <>
      <section className="detail-section community-reviews">
        <div className="section-title">
          <h3>Community Reviews</h3>
          <button type="button" onClick={openCreate}>Write Review</button>
        </div>
        {loading ? (
          <p className="empty-copy">Loading reviews…</p>
        ) : unavailable ? (
          <p className="empty-copy">There isn’t enough data to display reviews.</p>
        ) : reviews.length ? (
          reviews.map((review) => {
            const own = user?.id === review.user_id;
            return (
              <article key={review.id}>
                <b>{review.recommend ? 'Recommended' : 'Not recommended'} · {review.menu_name}</b>
                {review.reason && <p>{review.reason}</p>}
                {review.comment && <p>“{review.comment}”</p>}
                <small>
                  {review.price ? `${review.price} · reported by a visitor` : 'Price not reported'}
                  {' · '}{new Date(review.created_at).toLocaleDateString('en-US')}
                </small>
                {review.line_status && <small>Line: {review.line_status.replaceAll('_', ' ')}</small>}
                {review.photos.length > 0 && (
                  <div className="review-photo-grid">
                    {review.photos.map((photo) => (
                      <img key={photo.id} src={photo.public_url} alt={`${vendor.name} visitor photo`} />
                    ))}
                  </div>
                )}
                {own && (
                  <div className="review-owner-actions">
                    <button type="button" onClick={() => openEdit(review)}>Edit</button>
                    <button type="button" onClick={() => void remove(review)}>Delete</button>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <p className="empty-copy">No community reviews yet.</p>
        )}
      </section>
      {editing !== undefined && (
        <ReviewEditor
          vendor={vendor}
          review={editing}
          close={() => setEditing(undefined)}
          saved={async () => {
            setEditing(undefined);
            await refresh();
            notify(editing ? 'Review updated' : 'Review submitted');
          }}
        />
      )}
    </>
  );
}

function ReviewEditor({
  vendor,
  review,
  close,
  saved,
}: {
  vendor: Vendor;
  review: Review | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [input, setInput] = useState<ReviewInput>(review ? {
    recommend: review.recommend,
    menu_name: review.menu_name,
    price: review.price,
    reason: review.reason,
    comment: review.comment,
    line_status: review.line_status,
  } : { ...emptyInput, menu_name: vendor.menuItems[0] ?? '' });
  const [customMenu, setCustomMenu] = useState(
    review && !vendor.menuItems.includes(review.menu_name) ? review.menu_name : '',
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [persistedReviewId, setPersistedReviewId] = useState<string | null>(review?.id ?? null);
  const [uploadProgress, setUploadProgress] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const menuName = customMenu.trim() || input.menu_name.trim();
    if (!menuName) {
      setError('Choose a menu item or enter one.');
      return;
    }
    if (!user) {
      setError('Please log in before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    const payload = { ...input, menu_name: menuName };
    try {
      let reviewId = persistedReviewId;
      if (!reviewId) {
        const created = await createReview(vendor.id, user.id, payload);
        reviewId = created.id;
        setPersistedReviewId(reviewId);
      } else if (review && !persistedReviewId) {
        await updateReview(review.id, user.id, payload);
      } else if (review && persistedReviewId === review.id) {
        await updateReview(review.id, user.id, payload);
      }

      const failed: File[] = [];
      const failedNames: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadProgress(`Uploading photo ${index + 1} of ${files.length}…`);
        try {
          await uploadReviewPhoto(reviewId, vendor.id, user.id, file);
        } catch {
          failed.push(file);
          failedNames.push(file.name);
        }
      }

      if (failed.length) {
        setFiles(failed);
        setError(`Review saved. Failed photos: ${failedNames.join(', ')}. Try again to upload only these photos.`);
        return;
      }
      await saved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save review.');
    } finally {
      setUploadProgress('');
      setSubmitting(false);
    }
  };

  const optional = (value: string) => value.trim() || null;
  const lineStatuses: Array<ReviewLineStatus | ''> = ['', 'NO_LINE', 'SHORT', 'LONG', 'SOLD_OUT'];

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="review-editor-title">
        <button className="modal-close" type="button" onClick={close}>×</button>
        <h2 id="review-editor-title">{review ? 'Edit Review' : 'Write Review'}</h2>
        <form onSubmit={submit} noValidate>
          <div className="recommend-toggle">
            <button type="button" className={input.recommend ? 'active' : ''} onClick={() => setInput({ ...input, recommend: true })}>Recommend</button>
            <button type="button" className={!input.recommend ? 'active' : ''} onClick={() => setInput({ ...input, recommend: false })}>Not Recommend</button>
          </div>
          <label>Menu
            <select value={input.menu_name} onChange={(event) => { setCustomMenu(''); setInput({ ...input, menu_name: event.target.value }); }}>
              <option value="">Choose a menu item</option>
              {vendor.menuItems.map((menu) => <option key={menu}>{menu}</option>)}
            </select>
          </label>
          <label>Or enter a menu
            <input value={customMenu} onChange={(event) => setCustomMenu(event.target.value)} />
          </label>
          <label>Price paid (optional)
            <input value={input.price ?? ''} onChange={(event) => setInput({ ...input, price: optional(event.target.value) })} placeholder="$18" />
          </label>
          <label>Reason (optional)
            <textarea value={input.reason ?? ''} onChange={(event) => setInput({ ...input, reason: optional(event.target.value) })} />
          </label>
          <label>One-line review (optional)
            <input value={input.comment ?? ''} onChange={(event) => setInput({ ...input, comment: optional(event.target.value) })} />
          </label>
          <label>Line status (optional)
            <select value={input.line_status ?? ''} onChange={(event) => setInput({ ...input, line_status: (event.target.value || null) as ReviewLineStatus | null })}>
              {lineStatuses.map((status) => <option key={status} value={status}>{status ? status.replaceAll('_', ' ') : 'Not reported'}</option>)}
            </select>
          </label>
          <label>Photos (optional, up to 3)
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                const validationError = validateReviewPhotos(selected);
                if (validationError) {
                  setError(validationError);
                  event.target.value = '';
                  return;
                }
                setError('');
                setFiles(selected);
              }}
            />
          </label>
          {files.length > 0 && <small>{files.map((file) => file.name).join(', ')}</small>}
          {uploadProgress && <p className="upload-progress" role="status">{uploadProgress}</p>}
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="primary modal-action" disabled={submitting}>{submitting ? 'Saving…' : 'Save Review'}</button>
        </form>
      </div>
    </div>
  );
}
