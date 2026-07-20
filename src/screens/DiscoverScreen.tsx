import type { RefObject } from "react";
import { Bookmark, ChevronRight, Plus, Search } from "lucide-react";
import type { CommunityPhoto, UserList, Vendor } from "../types";

type Props = {
  vendors: Vendor[];
  photos: CommunityPhoto[];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  query: string;
  visibleCount: number;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  lists: UserList[];
  signedIn: boolean;
  onQueryChange: (value: string) => void;
  onVendorOpen: (id: string) => void;
  onVendorSave: (id: string) => void;
  onAddVendor: () => void;
};

export function DiscoverScreen({vendors,photos,loading,loadingMore,error,query,visibleCount,loadMoreRef,lists,signedIn,onQueryChange,onVendorOpen,onVendorSave,onAddVendor}:Props){
  const normalizedQuery=query.trim().toLocaleLowerCase();
  const matches=vendors.filter(vendor=>!normalizedQuery||[vendor.name,...vendor.cuisines,...vendor.foodTypes].some(value=>value.toLocaleLowerCase().includes(normalizedQuery)));
  const menuMatches=normalizedQuery?vendors.filter(vendor=>vendor.menuItems.some(item=>item.toLocaleLowerCase().includes(normalizedQuery))):[];
  const photoByVendor=new Map([...photos].sort((a,b)=>b.createdAt-a.createdAt).map(photo=>[photo.vendorId,photo]));
  return <div className="discover-screen">
    <header><h1>Discover</h1><p>Find vendors and menus</p></header>
    <label className="search"><Search/><input value={query} onChange={event=>onQueryChange(event.target.value)} placeholder="Search vendors, cuisines, or menus"/></label>
    <section className="content-section"><h3>Vendors</h3><div className="section-content">
      {loading?<div className="vendor-skeleton" aria-label="Loading vendors" aria-busy="true">{[1,2,3].map(item=><div key={item}><span/><span/><span/></div>)}</div>:error&&!vendors.length?<p className="no-results" role="alert">Vendors could not be loaded. Please try again.</p>:matches.length?matches.slice(0,visibleCount).map(vendor=><VendorResult key={vendor.id} vendor={vendor} photo={photoByVendor.get(vendor.id)} saved={signedIn&&lists.some(list=>list.vendorIds.includes(vendor.id))} open={()=>onVendorOpen(vendor.id)} save={()=>onVendorSave(vendor.id)}/>):<p className="no-results">No results found.</p>}
    </div></section>
    {!loading&&matches.length>visibleCount&&<div ref={loadMoreRef} className="no-results">Scroll for more vendors</div>}
    {loadingMore&&<p className="no-results">Loading more vendors...</p>}
    {normalizedQuery&&<section className="content-section"><h3>Menus</h3><div className="section-content">{menuMatches.length?menuMatches.flatMap(vendor=>vendor.menuItems.filter(item=>item.toLocaleLowerCase().includes(normalizedQuery)).map(item=><button className="menu-row text-card" key={`${vendor.id}-${item}`} onClick={()=>onVendorOpen(vendor.id)}><span><b>{item}</b><small>{vendor.name}</small></span><ChevronRight/></button>)):<p className="no-results">No results found.</p>}</div></section>}
    <button className="add-vendor" onClick={onAddVendor}><Plus/> Add Vendor</button>
  </div>;
}

function VendorResult({vendor,photo,saved,open,save}:{vendor:Vendor;photo?:CommunityPhoto;saved:boolean;open:()=>void;save:()=>void}){
  return <article className="vendor-row text-card"><button className="vendor-main" onClick={open}>{photo&&<img className="vendor-thumbnail" src={photo.imageUrl} alt="" loading="lazy"/>}<span><b>{vendor.name}</b><small>{vendor.menuItems[0]||vendor.foodTypes[0]||vendor.cuisines[0]||vendor.vendorType}</small></span><ChevronRight/></button><button className="vendor-save" aria-label={`Save ${vendor.name}`} onClick={save}><Bookmark fill={saved?"currentColor":"none"}/></button></article>;
}
