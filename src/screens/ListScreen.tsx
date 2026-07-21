import {
  Bookmark,
  Check,
  Copy,
  Sparkles,
  Plus,
  Share2,
  X,
} from "lucide-react";
import { useState } from "react";
import type { UserList, Vendor } from "../types";

export function ListScreen({
  list,
  vendors,
  owned,
  onBack,
  onVendorOpen,
  onRemoveVendor,
  onMoveVendor,
  onPatch,
  onAddVendors,
  onDelete,
  onMoveList,
  onCopyList,
  onStartChoosing,
  onTastingList,
  onShare,
  onFetchAll,
  onPickManually,
}: {
  list: UserList;
  vendors: Vendor[];
  owned: boolean;
  onBack: () => void;
  onVendorOpen: (id: string) => void;
  onRemoveVendor: (id: string) => void;
  onMoveVendor: (index: number, delta: number) => void;
  onPatch: (patch: Partial<UserList>) => void;
  onAddVendors: () => void;
  onDelete: () => void;
  onMoveList: () => void;
  onCopyList: () => void;
  onStartChoosing: () => void;
  onTastingList: () => void;
  onShare: () => void;
  onFetchAll: () => void;
  onPickManually: () => void;
}) {
  return (
    <>
      <button className="back" onClick={onBack}>
        ‹ Back
      </button>
      <header>
        <h1>{list.title}</h1>
        <p>
          {vendors.length} vendors · {list.fetches} fetches
        </p>
      </header>
      {list.description && (
        <p className="list-description">{list.description}</p>
      )}
      {owned && (
        <ListEditor
          list={list}
          onPatch={onPatch}
          onAdd={onAddVendors}
          onMove={onMoveList}
          onCopy={onCopyList}
          onDelete={onDelete}
        />
      )}{" "}
      {vendors.map((vendor, index) =>
        owned ? (
          <article key={vendor.id} className="vendor-row text-card managed-row">
            <div onClick={() => onVendorOpen(vendor.id)}>
              <b>{vendor.name}</b>
              <p>
                {vendor.menuItems.slice(0, 2).join(" · ") ||
                  vendor.foodTypes.join(" · ")}
              </p>
            </div>
            <div className="row-tools">
              <button
                aria-label="Move up"
                onClick={() => onMoveVendor(index, -1)}
              >
                ↑
              </button>
              <button
                aria-label="Move down"
                onClick={() => onMoveVendor(index, 1)}
              >
                ↓
              </button>
              <button
                aria-label="Remove vendor"
                onClick={() => onRemoveVendor(vendor.id)}
              >
                <X />
              </button>
            </div>
          </article>
        ) : (
          <article
            key={vendor.id}
            className="vendor-row text-card"
            onClick={() => onVendorOpen(vendor.id)}
          >
            <div>
              <b>{vendor.name}</b>
              <p>
                {vendor.menuItems.slice(0, 2).join(" · ") ||
                  vendor.foodTypes.join(" · ")}
              </p>
            </div>
          </article>
        ),
      )}
      <div
        className={`actions ${owned ? "list-owned-actions" : "fetch-actions"}`}
      >
        {owned ? (
          <>
            <button className="primary" onClick={onStartChoosing} disabled={!vendors.length}>
              <Sparkles /> Start Choosing
            </button>
            <button onClick={onTastingList}>
              <Plus /> Tasting List
            </button>
            <button onClick={onShare}>
              <Share2 /> Share
            </button>
          </>
        ) : (
          <>
            <button className="primary" onClick={onFetchAll}>
              <Bookmark /> Fetch All
            </button>
            <button onClick={onPickManually}>
              <Check /> Pick Manually
            </button>
          </>
        )}
      </div>
    </>
  );
}

function ListEditor({
  list,
  onPatch,
  onAdd,
  onMove,
  onCopy,
  onDelete,
}: {
  list: UserList;
  onPatch: (patch: Partial<UserList>) => void;
  onAdd: () => void;
  onMove: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState<"title" | "description" | null>(null);
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description);
  return (
    <div className="list-editor">
      {editing === "title" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim()) {
              onPatch({ title: title.trim() });
              setEditing(null);
            }
          }}
        >
          <input
            aria-label="List title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button>Save title</button>
        </form>
      ) : (
        <button onClick={() => setEditing("title")}>Edit title</button>
      )}
      {editing === "description" ? (
        <form
          className="description-editor"
          onSubmit={(event) => {
            event.preventDefault();
            onPatch({ description: description.trim() });
            setEditing(null);
          }}
        >
          <textarea
            aria-label="List description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <button>Save description</button>
        </form>
      ) : (
        <button onClick={() => setEditing("description")}>
          Edit description
        </button>
      )}
      <button onClick={onAdd}>
        <Plus /> Add vendors
      </button>
      <button
        onClick={() =>
          onPatch({
            visibility: list.visibility === "public" ? "private" : "public",
          })
        }
      >
        {list.visibility === "public" ? "Make private" : "Make public"}
      </button>
      <button onClick={() => onPatch({ pinned: !list.pinned })}>
        {list.pinned ? "★ Unpin" : "☆ Pin"}
      </button>
      <button onClick={onMove}>Move</button>
      <button onClick={onCopy}>
        <Copy /> Copy
      </button>
      <button className="danger" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
