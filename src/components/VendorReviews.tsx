import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { createReviewId, deleteReview, reportContent, saveReviewWithPhotos, validateReviewPhotos } from '../lib/reviews';
import type { ReviewInput, ReviewLineStatus, ReviewWithPhotos, Vendor } from '../types';

const emptyInput: ReviewInput = {
  recommend: true,
  menu_name: '',
  price: null,
  reason: null,
  comment: null,
  line_status: null,
};

const waitForPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

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
  const [editing, setEditing] = useState<ReviewWithPhotos | null | undefined>();
  const recommendedCount = reviews.filter((review) => review.recommend).length;
  const recommendedPercent = reviews.length ? Math.round((recommendedCount / reviews.length) * 100) : 0;

  const openCreate = () => requireAuth(() => setEditing(null));
  const openEdit = (review: ReviewWithPhotos) => setEditing(review);
  const report = (targetType: 'review' | 'photo', targetId: string) => requireAuth(async () => {
    const reason = prompt(`Why are you reporting this ${targetType}?`);
    if (!reason?.trim()) return;
    try {
      await reportContent(targetType, targetId, reason.trim());
      notify('Report submitted for moderator review');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not submit report.');
    }
  });

  const remove = async (review: ReviewWithPhotos) => {
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
        {!unavailable && <div className={`recommend-summary${reviews.length ? '' : ' empty'}`} aria-live="polite">
          {loading ? <span>Calculating recommendation rate…</span> : reviews.length ? <>
            <div><strong>{recommendedPercent}%</strong><span>recommended</span></div>
            <div className="recommend-summary-detail"><b>{reviews.length} review{reviews.length === 1 ? '' : 's'}</b><span>{recommendedCount} recommend · {reviews.length - recommendedCount} do not</span></div>
            <div className="recommend-meter" role="progressbar" aria-label={`${recommendedPercent}% recommended`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={recommendedPercent}><span style={{width:`${recommendedPercent}%`}}/></div>
          </> : <><strong>—</strong><span>No recommendation data yet</span></>}
        </div>}
        {loading ? (
          <p className="empty-copy">Loading reviews…</p>
        ) : unavailable ? (
          <p className="empty-copy">There isn’t enough data to display reviews.</p>
        ) : reviews.length ? (
          reviews.map((review) => {
            const own = Boolean(user) && review.is_owner;
            return (
              <article key={review.id}>
                <b>{review.recommend ? 'Recommended' : 'Not recommended'} · {review.menu_name}</b>
                {review.reason && <p>{review.reason}</p>}
                {review.comment && <p>“{review.comment}”</p>}
                <small>
                  {review.price ? `${review.price} · reported by a visitor` : 'Price details coming soon'}
                  {' · '}{new Date(review.created_at).toLocaleDateString('en-US')}
                </small>
                {review.line_status && <small>Line: {review.line_status.replaceAll('_', ' ')}</small>}
                {review.photos.length > 0 && (
                  <div className="review-photo-grid">
                    {review.photos.map((photo) => (
                      <figure key={photo.id}>
                        <img src={photo.public_url} alt={`${vendor.name} visitor photo`} />
                        {!own && <button type="button" onClick={() => report('photo', photo.id)}>Report photo</button>}
                      </figure>
                    ))}
                  </div>
                )}
                {own && (
                  <div className="review-owner-actions">
                    <button type="button" onClick={() => openEdit(review)}>Edit</button>
                    <button type="button" onClick={() => void remove(review)}>Delete</button>
                  </div>
                )}
                {!own && <button className="content-report-button" type="button" onClick={() => report('review', review.id)}>Report review</button>}
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
  review: ReviewWithPhotos | null;
  close: () => void;
  saved: () => Promise<void>;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
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
  const [createId] = useState(() => review?.id ?? createReviewId());
  const [uploadProgress, setUploadProgress] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(Boolean(review));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const menuName = customMenu.trim() || input.menu_name.trim() || vendor.menuItems[0] || 'Overall experience';
    if (!user) {
      setError('Please log in before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');
    setUploadProgress('Saving review…');
    await waitForPaint();
    const payload = { ...input, menu_name: menuName };
    try {
      const result = await saveReviewWithPhotos({
        reviewId: persistedReviewId,
        createId,
        vendorId: vendor.id,
        userId: user.id,
        input: payload,
        files,
        onPhotoProgress: (completed, total) => setUploadProgress(`Processed photo ${completed} of ${total}…`),
      });
      setPersistedReviewId(result.reviewId);

      if (result.failedFiles.length) {
        setFiles(result.failedFiles);
        setError(`Review saved. Failed photos: ${result.failedFiles.map((file) => file.name).join(', ')}. Try again to upload only these photos.`);
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
      <div className="modal-card review-editor-card" role="dialog" aria-modal="true" aria-labelledby="review-editor-title">
        <button className="modal-close" type="button" onClick={close}>×</button>
        <div className="review-editor-header">
          <h2 id="review-editor-title">{review ? 'Edit Review' : 'Write Review'}</h2>
        </div>
        <form id="review-editor-form" className="review-editor-body" onSubmit={submit} noValidate>
          <p className="review-required-copy"><b>Quick review</b><span>Choose one option below. That’s all you need to submit.</span></p>
          <div className="recommend-toggle">
            <button type="button" className={input.recommend ? 'active' : ''} onClick={() => setInput({ ...input, recommend: true })}>Recommend</button>
            <button type="button" className={!input.recommend ? 'active' : ''} onClick={() => setInput({ ...input, recommend: false })}>Not Recommend</button>
          </div>
          <button className="review-details-toggle" type="button" aria-expanded={detailsOpen} aria-controls="review-optional-details" onClick={() => setDetailsOpen((open) => !open)}><span><b>{detailsOpen ? 'Hide details' : 'Add more details'}</b><small>Optional · menu, price, comment, line and photos</small></span><span aria-hidden="true">{detailsOpen ? '−' : '+'}</span></button>
          {detailsOpen && <div id="review-optional-details" className="review-optional-details">
            <label>Menu <span className="optional-label">Optional</span>
              <select value={input.menu_name} onChange={(event) => { setCustomMenu(''); setInput({ ...input, menu_name: event.target.value }); }}>
                <option value="">Choose a menu item</option>
                {vendor.menuItems.map((menu) => <option key={menu}>{menu}</option>)}
              </select>
            </label>
            <label>Other menu <span className="optional-label">Optional</span>
              <input value={customMenu} onChange={(event) => setCustomMenu(event.target.value)} placeholder="Enter a menu item" />
            </label>
            <label>Price paid <span className="optional-label">Optional</span>
              <input value={input.price ?? ''} onChange={(event) => setInput({ ...input, price: optional(event.target.value) })} placeholder="$18" />
            </label>
            <label>Why? <span className="optional-label">Optional</span>
              <textarea value={input.reason ?? ''} onChange={(event) => setInput({ ...input, reason: optional(event.target.value) })} />
            </label>
            <label>One-line review <span className="optional-label">Optional</span>
              <input value={input.comment ?? ''} onChange={(event) => setInput({ ...input, comment: optional(event.target.value) })} />
            </label>
            <label>Line status <span className="optional-label">Optional</span>
              <select value={input.line_status ?? ''} onChange={(event) => setInput({ ...input, line_status: (event.target.value || null) as ReviewLineStatus | null })}>
                {lineStatuses.map((status) => <option key={status} value={status}>{status ? status.replaceAll('_', ' ') : 'No line report yet'}</option>)}
              </select>
            </label>
            <label>Photos <span className="optional-label">Up to 3</span>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => {const selected=Array.from(event.target.files??[]);const validationError=validateReviewPhotos(selected,review?.photos.length??0);if(validationError){setError(validationError);event.target.value='';return}setError('');setFiles(selected)}} />
            </label>
            {files.length > 0 && <small>{files.map((file) => file.name).join(', ')}</small>}
          </div>}
          {uploadProgress && <p className="upload-progress" role="status">{uploadProgress}</p>}
          {error && <p className="field-error" role="alert">{error}</p>}
        </form>
        <div className="review-editor-footer">
          <button type="button" className="review-cancel" disabled={submitting} onClick={close}>Cancel</button>
          <button type="submit" form="review-editor-form" className="primary review-submit" disabled={submitting} aria-busy={submitting}>{submitting && <span className="button-spinner" aria-hidden="true"/>}{submitting ? 'Saving…' : 'Save Review'}</button>
        </div>
      </div>
    </div>
  );
}
