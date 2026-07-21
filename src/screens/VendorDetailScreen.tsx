import { useRef, useState } from "react";
import { Bookmark, Check, Flag, ImagePlus, Share2, Trash2, X } from "lucide-react";
import { VendorReviews } from "../components/VendorReviews";
import type { WaitReport } from "../features/lineReports";
import type { CommunityPhoto, ReviewWithPhotos, Vendor } from "../types";

type Props = {
  vendor: Vendor;
  saved: boolean;
  history: WaitReport[];
  deviceId: string;
  canUndoLineReport: boolean;
  reviews: ReviewWithPhotos[];
  reviewsLoading: boolean;
  reviewsUnavailable: boolean;
  photos: CommunityPhoto[];
  photoUploadsOpen: boolean;
  lineReportsOpen: boolean;
  onBack: () => void;
  onSave: () => void;
  onUndoLineReport: () => void;
  onLineReport: (status: WaitReport["status"]) => void;
  onRefreshReviews: () => Promise<void>;
  onNotify: (message: string) => void;
  onReportIssue?: (message: string) => void;
  canManageImage?: boolean;
  onImageUpload?: (file: File) => Promise<void>;
  onImageDelete?: () => Promise<void>;
  decisionActions?: {
    onChoose: () => void;
    onPass?: () => void;
  };
};

export function VendorDetailScreen(props: Props) {
  const { vendor, photos, history } = props;
  const imageInput = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const galleryImages = [
    ...(vendor.galleryImageUrls ?? (vendor.featuredImageUrl ? [vendor.featuredImageUrl] : [])),
    ...photos.map((photo) => photo.imageUrl),
  ].filter((imageUrl, index, images) => images.indexOf(imageUrl) === index).slice(0, 4);
  const hasPhotos = galleryImages.length > 0;
  return (
    <>
      <button className="back" onClick={props.onBack}>
        ‹ Back
      </button>
      {hasPhotos ? (
        <div className="community-gallery">
          {galleryImages.map((imageUrl, index) => (
            <img
              key={`${imageUrl}-${index}`}
              src={imageUrl}
              alt={`${vendor.name} food photo ${index + 1}`}
            />
          ))}
        </div>
      ) : (
        <InstagramLink url={vendor.instagramUrl} />
      )}
      <header>
        <h1>{vendor.name}</h1>
      </header>
      {props.canManageImage && (
        <section className="vendor-image-admin">
          <input
            ref={imageInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file || !props.onImageUpload) return;
              setImageBusy(true);
              setImageError("");
              void props.onImageUpload(file)
                .catch((error: unknown) =>
                  setImageError(
                    error instanceof Error ? error.message : "Could not upload image.",
                  ),
                )
                .finally(() => setImageBusy(false));
            }}
          />
          <button
            type="button"
            disabled={imageBusy}
            onClick={() => imageInput.current?.click()}
          >
            <ImagePlus /> {vendor.imagePath ? "Replace image" : "Upload image"}
          </button>
          {vendor.imagePath && props.onImageDelete && (
            <button
              type="button"
              disabled={imageBusy}
              onClick={() => {
                if (!confirm("Delete this vendor image?")) return;
                setImageBusy(true);
                setImageError("");
                void props.onImageDelete?.()
                  .catch((error: unknown) =>
                    setImageError(
                      error instanceof Error ? error.message : "Could not delete image.",
                    ),
                  )
                  .finally(() => setImageBusy(false));
              }}
            >
              <Trash2 /> Delete image
            </button>
          )}
          {imageBusy && <small>Saving image...</small>}
          {imageError && <small className="field-error">{imageError}</small>}
        </section>
      )}
      <div className="vendor-facts">
        <span>
          {vendor.cuisines.join(" · ") || friendlyVendorType(vendor.vendorType)}
        </span>
        <span>{vendor.foodTypes.join(" · ")}</span>
      </div>
      <div className="detail-actions">
        {props.decisionActions && (
          <>
            <button className="primary" onClick={props.decisionActions.onChoose}>
              <Check /> Choose
            </button>
            {props.decisionActions.onPass ? <button onClick={props.decisionActions.onPass}>
              <X /> Pass
            </button> : <small>This is the only option in this list.</small>}
          </>
        )}
        <button className="primary" onClick={props.onSave}>
          <Bookmark fill={props.saved ? "currentColor" : "none"} />{" "}
          {props.saved ? "Manage lists" : "Save to List"}
        </button>
        <button
          onClick={() => shareContent(vendor.name, `#vendor-${vendor.id}`)}
        >
          <Share2 /> Share
        </button>
      </div>
      <section className="detail-section">
        <h3>Menu</h3>
        {vendor.menuItems.length ? (
          <ul>
            {vendor.menuItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">Menu details have not been reported.</p>
        )}
      </section>
      <section className="detail-section current-line">
        <h3>Current Line</h3>
        <div className="current-line-label">
          <span
            className={
              "dot " +
              (vendor.lineStatus || "").replace(/ /g, "-").toLowerCase()
            }
          />
          <b>{lineLabel(vendor.lineStatus)}</b>
          <small>
            {history[0]
              ? `Reported ${timeAgo(history[0].at)}`
              : "No community report yet"}
          </small>
        </div>
        <div className="wait-buttons">
          {(["No line", "Short", "Busy", "Sold out"] as const).map((status) => (
            <button
              key={status}
              disabled={!props.lineReportsOpen}
              className={vendor.lineStatus === status ? "active" : ""}
              aria-pressed={vendor.lineStatus === status}
              onClick={() => props.onLineReport(status)}
            >
              {status === "Busy"
                ? "Long"
                : status === "Sold out"
                  ? "Sold Out"
                  : status}
            </button>
          ))}
        </div>
        {props.lineReportsOpen && (
          <p className="line-report-note">
            No login needed. A new choice within 3 minutes updates your previous
            report.
          </p>
        )}
        {props.canUndoLineReport && (
          <button
            className="undo-line-report"
            type="button"
            onClick={props.onUndoLineReport}
          >
            Undo my recent report
          </button>
        )}
        {!props.lineReportsOpen && (
          <p className="event-note line-report-note">
            Line updates are available July 24–26, 2026, from 11 AM to 8 PM
            (Seattle time).
          </p>
        )}
        {history.length > 0 && (
          <div className="line-history">
            <b>Recent reports</b>
            {history.slice(0, 5).map((item, index) => (
              <div key={item.id || `${item.at}-${index}`}>
                <span>
                  {lineLabel(item.status)}
                  {item.deviceId === props.deviceId && <small> · You</small>}
                </span>
                <time>
                  {new Date(item.at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            ))}
          </div>
        )}
      </section>
      <VendorReviews
        vendor={vendor}
        reviews={props.reviews}
        loading={props.reviewsLoading}
        unavailable={props.reviewsUnavailable}
        refresh={props.onRefreshReviews}
        notify={props.onNotify}
      />
      <section className="detail-section community-photos">
        <h3>Community Photos</h3>
        {hasPhotos ? (
          <p className="empty-copy">
            {photos.length} community{" "}
            {photos.length === 1 ? "photo is" : "photos are"} shown above.
          </p>
        ) : (
          <div className="empty-copy">
            <p>No community photos yet.</p>
            <p>Visitors can upload photos during the event.</p>
          </div>
        )}
      </section>
      <div className="contribute-actions">
        <button disabled={!props.photoUploadsOpen}>
          <ImagePlus /> Upload Photo
        </button>
      </div>
      {!props.photoUploadsOpen && (
        <p className="event-note">
          Photo uploads open during Bite of Seattle, July 24–26.
        </p>
      )}
      {hasPhotos && <InstagramLink url={vendor.instagramUrl} />}
      <div className="source-box">
        <b>Vendor data source</b>
        <p>{vendor.source}</p>
        {props.onReportIssue && (
          <button
            onClick={() => {
              const message = prompt("What information is incorrect?");
              if (message) props.onReportIssue?.(message);
            }}
          >
            <Flag /> Report incorrect info
          </button>
        )}
      </div>
    </>
  );
}

function lineLabel(status: Vendor["lineStatus"]) {
  return status === "Busy" || status === "Very busy"
    ? "Long"
    : status || "No report yet";
}
function friendlyVendorType(type: Vendor["vendorType"]) {
  return (
    {
      food: "Food",
      drink: "Drink",
      dessert: "Dessert",
      shopping: "Shopping",
      game: "Game",
    } as const
  )[type];
}
function timeAgo(at: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60_000));
  return minutes < 1 ? "Just now" : `${minutes} min ago`;
}
function safeInstagramUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (url.protocol === "https:" || url.protocol === "http:") &&
      (host === "instagram.com" || host.endsWith(".instagram.com"))
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function InstagramLink({ url }: { url: string | null }) {
  const href = safeInstagramUrl(url);
  return href ? (
    <a
      className="instagram-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      View on Instagram
    </a>
  ) : null;
}
async function shareContent(title: string, hash: string) {
  const url = `${location.origin}${location.pathname}${hash}`;
  const data = { title, text: `Check out ${title} at Bite of Seattle`, url };
  if (navigator.share) await navigator.share(data);
  else await navigator.clipboard.writeText(url);
}
