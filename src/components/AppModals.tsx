import { Check, Plus, Search, Share2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { UserList, Vendor, VendorType } from "../types";

export function Modal({
  children,
  close,
}: {
  children: ReactNode;
  close: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div className="modal-card">
        <button className="modal-close" onClick={close}>
          <X />
        </button>
        {children}
      </div>
    </div>
  );
}

export function ListPickerModal({
  title,
  lists,
  recentIds,
  close,
  select,
  create,
  togglePin,
}: {
  title: string;
  lists: UserList[];
  recentIds: string[];
  close: () => void;
  select: (id: string) => void;
  create: (title: string) => void;
  togglePin: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const normalized = query.trim().toLowerCase();
  const recent = recentIds
    .slice(0, 5)
    .map((id) => lists.find((list) => list.id === id))
    .filter((list): list is UserList => Boolean(list));
  const recentSet = new Set(recent.map((list) => list.id));
  const pinned = lists.filter((list) => list.pinned && !recentSet.has(list.id));
  const excluded = new Set([...recent, ...pinned].map((list) => list.id));
  const group = (label: string, items: UserList[]) =>
    items.length ? (
      <section className="picker-group">
        <h3>{label}</h3>
        {items.map((list) => (
          <div className="picker-row" key={list.id}>
            <button className="picker-select" onClick={() => select(list.id)}>
              <span>{list.pinned ? "📌" : "♡"}</span>
              {list.title}
            </button>
            <button
              className="pin-button"
              aria-label={`${list.pinned ? "Unpin" : "Pin"} ${list.title}`}
              onClick={() => togglePin(list.id)}
            >
              {list.pinned ? "★" : "☆"}
            </button>
          </div>
        ))}
      </section>
    ) : null;
  const matches = lists.filter((list) =>
    list.title.toLowerCase().includes(normalized),
  );
  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        className="list-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="list-picker-title"
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2 id="list-picker-title">{title}</h2>
          <button aria-label="Close list picker" onClick={close}>
            <X />
          </button>
        </div>
        {!normalized && (
          <>
            {group("Recently Used", recent)}
            {group("Pinned Lists", pinned)}
            {group(
              "All Lists",
              lists.filter((list) => !excluded.has(list.id)),
            )}
          </>
        )}
        <label className="picker-search">
          <Search />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Lists..."
          />
        </label>
        {normalized && group("Search Results", matches)}
        {normalized && !matches.length && (
          <p className="no-results">No matching lists.</p>
        )}
        {creating ? (
          <form
            className="create-inline"
            onSubmit={(event) => {
              event.preventDefault();
              if (newTitle.trim()) create(newTitle.trim());
            }}
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="List name"
            />
            <button className="primary">Create & Save</button>
          </form>
        ) : (
          <button className="create-list" onClick={() => setCreating(true)}>
            <Plus /> Create New List
          </button>
        )}
      </div>
    </div>
  );
}

export function AddVendorModal({
  close,
  add,
}: {
  close: () => void;
  add: (vendor: Vendor) => void;
}) {
  const [name, setName] = useState("");
  const [menu, setMenu] = useState("");
  const [vendorType, setVendorType] = useState<VendorType>("food");
  const [cuisines, setCuisines] = useState("");
  const [foodTypes, setFoodTypes] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [error, setError] = useState("");
  return (
    <Modal close={close}>
      <h2>Add a vendor</h2>
      <p className="modal-copy">
        Submissions are saved for review on this device.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) {
            setError("Enter a vendor name.");
            return;
          }
          add({
            id: "submitted-" + Date.now(),
            name: name.trim(),
            vendorType,
            cuisines: split(cuisines),
            foodTypes: split(foodTypes),
            menuItems: split(menu),
            dietaryTags: [],
            description: null,
            reviewCount: 0,
            reviewSnippets: [],
            lineStatus: null,
            instagramUrl: instagramUrl.trim() || null,
            source: "User submission",
            isActive: true,
          });
        }}
      >
        <label>
          Vendor name
          <input
            autoFocus
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
          />
          {error && <span className="field-error">{error}</span>}
        </label>
        <label>
          Menu items
          <input
            value={menu}
            onChange={(event) => setMenu(event.target.value)}
          />
        </label>
        <label>
          Vendor type
          <select
            value={vendorType}
            onChange={(event) =>
              setVendorType(event.target.value as VendorType)
            }
          >
            {["food", "drink", "dessert", "shopping", "game"].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Cuisines
          <input
            value={cuisines}
            onChange={(event) => setCuisines(event.target.value)}
          />
        </label>
        <label>
          Food types
          <input
            value={foodTypes}
            onChange={(event) => setFoodTypes(event.target.value)}
          />
        </label>
        <label>
          Instagram URL
          <input
            type="url"
            value={instagramUrl}
            onChange={(event) => setInstagramUrl(event.target.value)}
          />
        </label>
        <button className="primary modal-action">Submit vendor</button>
      </form>
    </Modal>
  );
}

export function CreateListModal({
  close,
  create,
}: {
  close: () => void;
  create: (input: {
    title: string;
    description: string;
    visibility: "public" | "private";
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [error, setError] = useState("");
  return (
    <Modal close={close}>
      <h2>Create a list</h2>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) {
            setError("Enter a list title.");
            return;
          }
          create({
            title: title.trim(),
            description: description.trim(),
            visibility,
          });
        }}
      >
        <label>
          Title
          <input
            autoFocus
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setError("");
            }}
          />
          {error && <span className="field-error">{error}</span>}
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <fieldset className="visibility-options">
          <legend>Visibility</legend>
          <label>
            <input
              type="radio"
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
            />
            Public
          </label>
          <label>
            <input
              type="radio"
              checked={visibility === "private"}
              onChange={() => setVisibility("private")}
            />
            Private
          </label>
        </fieldset>
        <button className="primary modal-action">Create list</button>
      </form>
    </Modal>
  );
}

export function VendorPickerModal({
  vendors,
  close,
  add,
}: {
  vendors: Vendor[];
  close: () => void;
  add: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const matches = vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Modal close={close}>
      <div className="vendor-picker-heading">
        <span className="vendor-picker-icon"><Plus /></span>
        <div>
          <h2>Add vendors</h2>
          <p className="modal-copy">Choose vendors to add to this list.</p>
        </div>
      </div>
      <label className="vendor-picker-search">
        <Search />
        <input
          aria-label="Search vendors"
          placeholder="Search vendors"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="vendor-picker-summary">
        <span>{matches.length} vendors</span>
        <b>{selected.length} selected</b>
      </div>
      <div className="manual-list vendor-picker-list">
        {matches.map((vendor) => (
          <label
            key={vendor.id}
            className={selected.includes(vendor.id) ? "selected" : ""}
          >
            <input
              type="checkbox"
              checked={selected.includes(vendor.id)}
              onChange={() =>
                setSelected((current) =>
                  current.includes(vendor.id)
                    ? current.filter((id) => id !== vendor.id)
                    : [...current, vendor.id],
                )
              }
            />
            <span className="vendor-picker-check"><Check /></span>
            <span className="vendor-picker-copy">
              <b>{vendor.name}</b>
              <small>
                {vendor.menuItems.slice(0, 2).join(" · ") ||
                  vendor.foodTypes.join(" · ")}
              </small>
            </span>
          </label>
        ))}
        {!matches.length && (
          <p className="vendor-picker-empty">No vendors match “{query}”.</p>
        )}
      </div>
      <button
        className="primary modal-action vendor-picker-action"
        disabled={!selected.length}
        onClick={() => add(selected)}
      >
        Add {selected.length} vendors
      </button>
    </Modal>
  );
}

export function ManualFetchModal({
  list,
  vendors,
  close,
  fetch,
}: {
  list: UserList;
  vendors: Vendor[];
  close: () => void;
  fetch: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <Modal close={close}>
      <h2>Pick manually</h2>
      <p>
        Choose vendors from <b>{list.title}</b>.
      </p>
      <div className="manual-list">
        {vendors.map((vendor) => (
          <label key={vendor.id}>
            <input
              type="checkbox"
              checked={selected.includes(vendor.id)}
              onChange={() =>
                setSelected((current) =>
                  current.includes(vendor.id)
                    ? current.filter((id) => id !== vendor.id)
                    : [...current, vendor.id],
                )
              }
            />
            <span>{vendor.name}</span>
          </label>
        ))}
      </div>
      <button
        className="primary modal-action"
        disabled={!selected.length}
        onClick={() => fetch(selected)}
      >
        <Check /> Fetch {selected.length} vendors
      </button>
    </Modal>
  );
}

export function ShareModalView({
  label,
  hash,
  close,
  shared,
}: {
  label: string;
  hash: string;
  close: () => void;
  shared: () => void;
}) {
  return (
    <Modal close={close}>
      <h2>Share your picks</h2>
      <p>Invite friends to explore “{label}”.</p>
      <button
        className="primary modal-action"
        onClick={async () => {
          await shareContent(label, hash);
          shared();
        }}
      >
        <Share2 /> Share or copy link
      </button>
    </Modal>
  );
}
export function SurveyModal({
  close,
  answer,
}: {
  close: () => void;
  answer: (yes: boolean) => void;
}) {
  return (
    <Modal close={close}>
      <h2>Would you use this again?</h2>
      <div className="survey-actions">
        <button onClick={() => answer(false)}>Not yet</button>
        <button className="primary" onClick={() => answer(true)}>
          Yes
        </button>
      </div>
    </Modal>
  );
}

const split = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
async function shareContent(title: string, hash: string) {
  const url = `${location.origin}${location.pathname}${hash}`;
  const data = { title, text: `Check out ${title} at Bite of Seattle`, url };
  if (navigator.share) await navigator.share(data);
  else await navigator.clipboard.writeText(url);
}
