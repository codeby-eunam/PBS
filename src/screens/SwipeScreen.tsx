import { Bookmark, Heart, RotateCcw, Share2, Trophy, X } from "lucide-react";
import type { CommunityPhoto, ReviewWithPhotos, Vendor } from "../types";

export function SwipeScreen({
  vendor,
  position,
  total,
  reviews,
  photos,
  photosOpen,
  onBack,
  onSkip,
  onLike,
  onSave,
}: {
  vendor: Vendor;
  position: number;
  total: number;
  reviews: ReviewWithPhotos[];
  photos: CommunityPhoto[];
  photosOpen: boolean;
  onBack: () => void;
  onSkip: () => void;
  onLike: () => void;
  onSave: () => void;
}) {
  const photo = photosOpen ? photos[0] : undefined;
  const lines = reviews
    .map((review) => review.comment || review.reason)
    .filter((line): line is string => Boolean(line));
  return (
    <>
      <button className="back" onClick={onBack}>
        ‹ Back
      </button>
      <div className="progress">
        {position} / {total}
      </div>
      <article className="swipe-text-card">
        {photo && (
          <img
            className="swipe-community-photo"
            src={photo.imageUrl}
            alt={`${vendor.name} community food photo`}
          />
        )}
        <header>
          <h1>{vendor.name}</h1>
        </header>
        <div className="vendor-facts">
          <div>
            <small>Cuisine</small>
            <b>
              {vendor.cuisines.join(" · ") || "Cuisine details coming soon"}
            </b>
          </div>
          <div>
            <small>Food type</small>
            <b>{vendor.foodTypes.join(" · ") || vendor.vendorType}</b>
          </div>
          <div>
            <small>Featured menu</small>
            <b>{vendor.menuItems[0] || "Menu details coming soon"}</b>
          </div>
        </div>
        <div className="swipe-line">
          <small>Current line</small>
          <b>{vendor.lineStatus || "No report yet"}</b>
        </div>
        {reviews.length >= 15 && lines[0] && (
          <blockquote className="rolling-review">“{lines[0]}”</blockquote>
        )}
      </article>
      <div className="swipe-actions text-actions">
        <button aria-label="Skip vendor" onClick={onSkip}>
          <X /> Skip
        </button>
        <button
          aria-label="Interested in vendor"
          className="love"
          onClick={onLike}
        >
          <Heart /> Interested
        </button>
      </div>
      <button className="save-progress" onClick={onSave}>
        <Bookmark /> Save Progress
      </button>
    </>
  );
}

export function SwipeResultsScreen({
  vendors,
  onMove,
  onTournament,
  onShare,
  onReset,
}: {
  vendors: Vendor[];
  onMove: () => void;
  onTournament: () => void;
  onShare: () => void;
  onReset: () => void;
}) {
  return (
    <div className="swipe-result">
      <header>
        <h1>Result</h1>
        <p>Liked Vendors ({vendors.length})</p>
      </header>
      <div className="result-vendors">
        {vendors.length ? (
          vendors.map((vendor) => (
            <div key={vendor.id}>
              <b>{vendor.name}</b>
              <small>{vendor.menuItems[0] || vendor.foodTypes[0]}</small>
            </div>
          ))
        ) : (
          <p>No vendors liked this round.</p>
        )}
      </div>
      <div className="result-actions">
        <button className="primary" disabled={!vendors.length} onClick={onMove}>
          <Bookmark /> Move to List
        </button>
        <button disabled={vendors.length < 2} onClick={onTournament}>
          <Trophy /> Start Tournament
        </button>
        <button onClick={onShare}>
          <Share2 /> Share
        </button>
        <button onClick={onReset}>
          <RotateCcw /> Reset Swipe
        </button>
      </div>
    </div>
  );
}
