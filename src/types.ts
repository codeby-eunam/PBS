export type VendorType = "food" | "drink" | "dessert" | "shopping" | "game";
export type LineStatus =
  null | "No line" | "Short" | "Busy" | "Very busy" | "Sold out";
export type ReviewLineStatus = "NO_LINE" | "SHORT" | "LONG" | "SOLD_OUT";
export type Review = {
  id: string;
  vendor_id: string;
  user_id: string;
  recommend: boolean;
  menu_name: string;
  price: string | null;
  reason: string | null;
  comment: string | null;
  line_status: ReviewLineStatus | null;
  created_at: string;
  updated_at: string;
  flagged?: never;
};
export type ReviewInput = Pick<
  Review,
  "recommend" | "menu_name" | "price" | "reason" | "comment" | "line_status"
>;
export type ReviewPhoto = {
  id: string;
  review_id: string;
  user_id: string;
  storage_path: string;
  created_at: string;
};
export type ReviewPhotoWithUrl = Omit<ReviewPhoto, "user_id"> & {
  public_url: string;
};
export type ReviewWithPhotos = Omit<Review, "user_id"> & {
  is_owner: boolean;
  photos: ReviewPhotoWithUrl[];
};
export type CommunityPhoto = {
  vendorId: string;
  reviewId: string;
  imageUrl: string;
  createdAt: number;
};
export type Vendor = {
  id: string;
  name: string;
  vendorType: VendorType;
  cuisines: string[];
  foodTypes: string[];
  menuItems: string[];
  dietaryTags: string[];
  description: string | null;
  reviewCount: number;
  reviewSnippets: string[];
  lineStatus: LineStatus;
  instagramUrl: string | null;
  source: string;
  isActive: boolean;
  imagePath?: string | null;
  featuredImageUrl?: string;
};
export type UserList = {
  id: string;
  remoteId?: string;
  title: string;
  description: string;
  vendorIds: string[];
  visibility: "public" | "private";
  fetched?: boolean;
  fetches: number;
  pinned?: boolean;
};
