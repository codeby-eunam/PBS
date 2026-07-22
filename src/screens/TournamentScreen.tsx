import { X } from "lucide-react";
import type { ReviewWithPhotos, Vendor } from "../types";

export function TournamentScreen({
  left,
  right,
  leftReviews,
  rightReviews,
  picks,
  totalPicks,
  source,
  onPick,
  onExit,
}: {
  left: Vendor;
  right: Vendor;
  leftReviews: ReviewWithPhotos[];
  rightReviews: ReviewWithPhotos[];
  picks: number;
  totalPicks: number;
  source: string;
  onPick: (id: string) => void;
  onExit: () => void;
}) {
  return (
    <>
      <div className="tournament-nav">
        <button className="back" onClick={onExit}>
          ‹ Back
        </button>
        <button className="exit-tournament" onClick={onExit}>
          <X /> Exit
        </button>
      </div>
      <div className="round">
        <b>Tournament · Choose one</b>
        <span>From {source}</span>
        <progress value={picks} max={Math.max(1, totalPicks)} />
        <small>
          {picks} of {Math.max(1, totalPicks)} comparisons complete
        </small>
      </div>
      <div className="versus">
        <Candidate
          vendor={left}
          reviews={leftReviews}
          onPick={() => onPick(left.id)}
        />
        <b>VS</b>
        <Candidate
          vendor={right}
          reviews={rightReviews}
          onPick={() => onPick(right.id)}
        />
      </div>
    </>
  );
}

function Candidate({
  vendor,
  reviews,
  onPick,
}: {
  vendor: Vendor;
  reviews: ReviewWithPhotos[];
  onPick: () => void;
}) {
  const price =
    reviews.find((review) => review.price?.trim())?.price ||
    "Price details coming soon";
  return (
    <article className="compare">
      {vendor.featuredImageUrl && (
        <img className="compare-photo" src={vendor.featuredImageUrl} alt={`${vendor.name} food`} />
      )}
      <h2>{vendor.name}</h2>
      <div className="compare-facts">
        <small>Featured menu</small>
        <b>{vendor.menuItems[0] || "Menu details coming soon"}</b>
        <small>Cuisine</small>
        <span>
          {vendor.cuisines.join(" · ") || "Cuisine details coming soon"}
        </span>
        <small>Food type</small>
        <span>{vendor.foodTypes.join(" · ") || vendor.vendorType}</span>
        <small>Price</small>
        <span>{price}</span>
        <small>Current line</small>
        <span>{vendor.lineStatus || "No report yet"}</span>
      </div>
      <button className="primary choose-vendor" onClick={onPick}>
        Choose {vendor.name}
      </button>
    </article>
  );
}
