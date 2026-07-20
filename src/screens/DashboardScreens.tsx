import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bookmark,
  ChevronRight,
  Heart,
  LogOut,
  Plus,
  Settings,
  Trophy,
  X,
} from "lucide-react";
import type { UserList, Vendor } from "../types";

function Header({ title, sub }: { title: string; sub?: string }) {
  return (
    <header>
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </header>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="content-section">
      <h3>{title}</h3>
      <div className="section-content">{children}</div>
    </section>
  );
}

function ListCard({ list, onOpen }: { list: UserList; onOpen: () => void }) {
  return (
    <article className="list-card text-card" onClick={onOpen}>
      <div>
        <b>{list.title}</b>
        {list.description && <p>{list.description}</p>}
        <small>
          {list.vendorIds.length} vendors · {list.fetches} fetches ·{" "}
          {list.visibility}
          {list.fetched ? " · fetched" : ""}
        </small>
      </div>
      <ChevronRight />
    </article>
  );
}

export function ListsScreen({
  lists,
  query,
  loading,
  error,
  onQuery,
  onOpen,
}: {
  lists: UserList[];
  query: string;
  loading: boolean;
  error: boolean;
  onQuery: (value: string) => void;
  onOpen: (id: string) => void;
}) {
  const visible = lists.filter((list) =>
    list.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <Header title="Lists" sub="Curated from current Supabase vendors" />
      <label className="search">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search lists"
        />
      </label>
      <Section title="Public lists">
        {loading ? (
          <p className="no-results">Loading lists...</p>
        ) : error ? (
          <p className="no-results" role="alert">
            Lists could not be loaded because vendor data is unavailable.
          </p>
        ) : visible.length ? (
          visible.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onOpen={() => onOpen(list.id)}
            />
          ))
        ) : (
          <p className="no-results">No matching results.</p>
        )}
      </Section>
    </>
  );
}

export function PicksScreen({
  lists,
  likedCount,
  played,
  history,
  onOpen,
  onLiked,
  onCreate,
}: {
  lists: UserList[];
  likedCount: number;
  played: number;
  history: { event: string; at: number }[];
  onOpen: (id: string) => void;
  onLiked: () => void;
  onCreate: () => void;
}) {
  const owned = lists.filter((list) => !list.fetched);
  const fetched = lists.filter((list) => list.fetched);
  return (
    <>
      <Header title="My Picks" sub="Everything you saved" />
      <div className="statline">
        <span>
          {lists.length}
          <small>Lists</small>
        </span>
        <span>
          {likedCount}
          <small>Likes</small>
        </span>
        <span>
          {played}
          <small>Played</small>
        </span>
      </div>
      <Section title="My Lists">
        {owned.map((list) => (
          <ListCard key={list.id} list={list} onOpen={() => onOpen(list.id)} />
        ))}
      </Section>
      <Section title="Fetched Lists">
        {fetched.length ? (
          fetched.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onOpen={() => onOpen(list.id)}
            />
          ))
        ) : (
          <p className="no-results">No fetched lists yet.</p>
        )}
      </Section>
      <Section title="Liked Vendors">
        <ListCard
          list={{
            id: "liked",
            title: "Liked Vendors",
            description: "Vendors liked during swipe sessions.",
            vendorIds: Array.from({ length: likedCount }, (_, index) =>
              String(index),
            ),
            visibility: "private",
            fetches: 0,
          }}
          onOpen={onLiked}
        />
      </Section>
      <Section title="History">
        {history.length ? (
          history.map((item, index) => (
            <div className="history-row" key={`${item.at}-${index}`}>
              <b>{item.event.replace("_", " ")}</b>
              <time>{timeAgo(item.at)}</time>
            </div>
          ))
        ) : (
          <p className="no-results">No recent activity.</p>
        )}
      </Section>
      <button className="wide" onClick={onCreate}>
        <Plus /> Create new list
      </button>
    </>
  );
}

export function LikedScreen({
  vendors,
  onBack,
  onOpen,
  onRemove,
  onSwipe,
  onTournament,
  onMove,
}: {
  vendors: Vendor[];
  onBack: () => void;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onSwipe: () => void;
  onTournament: () => void;
  onMove: () => void;
}) {
  return (
    <>
      <button className="back" onClick={onBack} aria-label="Back">
        <ArrowLeft />
      </button>
      <Header
        title="Liked Vendors"
        sub={`${vendors.length} vendors · system list`}
      />
      {vendors.map((vendor) => (
        <article className="vendor-row text-card managed-row" key={vendor.id}>
          <div onClick={() => onOpen(vendor.id)}>
            <b>{vendor.name}</b>
            <p>
              {vendor.menuItems.slice(0, 2).join(" · ") ||
                vendor.foodTypes.join(" · ")}
            </p>
          </div>
          <div className="row-tools">
            <button aria-label="Move up">
              <ArrowUp />
            </button>
            <button aria-label="Move down">
              <ArrowDown />
            </button>
            <button
              aria-label="Remove vendor"
              onClick={() => onRemove(vendor.id)}
            >
              <X />
            </button>
          </div>
        </article>
      ))}
      <div className="actions">
        <button className="primary" onClick={onSwipe}>
          <Heart /> Start Swipe
        </button>
        <button onClick={onTournament}>
          <Trophy /> Start Tournament
        </button>
        <button onClick={onMove}>
          <Bookmark /> Move to List
        </button>
      </div>
    </>
  );
}

export function ProfileScreen({
  displayName,
  userId,
  totalFetches,
  listCount,
  likeCount,
  played,
  publicLists,
  submittedCount,
  flaggedCount,
  issueCount,
  onOpen,
  onLogout,
}: {
  displayName: string;
  userId?: string;
  totalFetches: number;
  listCount: number;
  likeCount: number;
  played: number;
  publicLists: UserList[];
  submittedCount: number;
  flaggedCount: number;
  issueCount: number;
  onOpen: (id: string) => void;
  onLogout: () => void;
}) {
  return (
    <>
      <Header title="Profile" />
      <div className="profile">
        <div className="avatar">{displayName.slice(0, 1).toUpperCase()}</div>
        <h2>{displayName}</h2>
        <p>{userId ? `@${userId}` : "User ID unavailable"}</p>
      </div>
      <div className="statline">
        <span>
          {totalFetches}
          <small>Total fetches</small>
        </span>
        <span>
          {listCount}
          <small>Lists created</small>
        </span>
        <span>
          {likeCount}
          <small>Swipe likes</small>
        </span>
        <span>
          {played}
          <small>Tournaments</small>
        </span>
      </div>
      <Section title="Recent public lists">
        {publicLists.slice(0, 2).map((list) => (
          <ListCard key={list.id} list={list} onOpen={() => onOpen(list.id)} />
        ))}
      </Section>
      <section className="settings-panel">
        <h3>Settings</h3>
        <button>
          <Settings /> Profile preferences
        </button>
        <button onClick={onLogout}>
          <LogOut /> Log out
        </button>
      </section>
      <section className="admin-panel">
        <h3>Moderator queue</h3>
        <p>{submittedCount} vendor submissions</p>
        <p>{flaggedCount} flagged reviews</p>
        <p>{issueCount} incorrect-info reports</p>
        <small>
          Local demo only · connect an authenticated backend for production
          moderation.
        </small>
      </section>
    </>
  );
}

function timeAgo(at: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60_000));
  return minutes < 1 ? "just now" : `${minutes}m ago`;
}
