/**
 * Auto-generated TypeScript types from OpenAPI specification
 * Auction System API v1
 */

// ============ Enums ============

export enum UserRole {
  USER = "user",
  ADMIN = "admin"
}

export enum AccountStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended"
}

export enum AuctionStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  PENDING = "pending",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum BidStatus {
  ACTIVE = "active",
  OUTBID = "outbid",
  WON = "won",
  LOST = "lost",
  CANCELLED = "cancelled"
}

export enum PaymentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
  CANCELLED = "cancelled"
}

export enum ShippingStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SHIPPED = "shipped",
  DELIVERED = "delivered"
}

export enum ApprovalStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected"
}

// ============ Authentication Types ============

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface AccountCreate {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  dateOfBirth?: string | null; // ISO date format
  address?: string | null;
}

export interface AccountUpdate {
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
}

export interface UserResponse {
  accountID: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  role: UserRole;
  status: AccountStatus;
  lastLoginAt?: string | null;
  isAuthenticated: boolean;
}

export interface OTPVerificationRequest {
  otp_code: string;
  otp_token: string;
  username: string;
}

export interface RegistrationWithOTPResponse {
  success: boolean;
  message: string;
  otp_token?: string | null;
  expires_in?: number | null;
}

export interface OTPResendResponse {
  success: boolean;
  message: string;
  otp_token?: string | null;
  expires_in?: number | null;
}

export interface PasswordRecoveryRequest {
  username: string;
}

export interface PasswordRecoveryResponse {
  success: boolean;
  message: string;
  otp_token?: string | null;
  expires_in?: number | null;
}

export interface PasswordResetRequest {
  reset_token: string;
  new_password: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}

export interface ResetTokenResponse {
  success: boolean;
  message: string;
  reset_token?: string | null;
  expires_in?: number | null;
}

// ============ Auction Types ============

export interface Auction {
  auctionID: number;
  auctionName: string;
  productID: number;
  startDate: string; // ISO datetime
  endDate: string; // ISO datetime
  priceStep: number;
  auctionStatus?: string | null;
  bidWinnerID?: number | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface AuctionCreate {
  auctionName: string;
  productID: number;
  startDate: string;
  endDate: string;
  priceStep: number;
}

export interface AuctionUpdate {
  auctionName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  priceStep?: number | null;
  auctionStatus?: string | null;
}

export interface AuctionSearch {
  auctionName?: string | null;
  auctionStatus?: string | null;
  productType?: string | null;
  minPriceStep?: number | null;
  maxPriceStep?: number | null;
}

export interface AuctionResultUpdate {
  bidWinnerID: number;
}

// ============ Product Types ============

export interface ProductCreate {
  productName: string;
  productDescription: string;
  productType: string;
  imageUrl?: string | null;
  additionalImages?: string[] | null;
}

export interface ProductRejectRequest {
  rejectionReason: string;
}

export interface ProductStatusUpdate {
  shippingStatus: string;
}

// ============ Bid Types ============

export interface BidCreate {
  auctionID: number;
  bidPrice: number;
}

// ============ Payment Types ============

export interface PaymentCreate {
  auction_id: number;
  first_name: string;
  last_name: string;
  user_address: string;
  user_payment_method: string;
}

export interface PaymentStatusUpdate {
  payment_status: string;
}

// ============ Common Response Types ============

export interface MessageResponse {
  message: string;
}

export interface PaginatedResponse<T> {
  total: number;
  skip: number;
  limit: number;
  items: T[];
}

// ============ Error Types ============

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail: ValidationError[];
}

// ============ API Response Helpers ============

export type ApiResponse<T> = {
  data: T;
  status: number;
};

export type ApiError = {
  message: string;
  status: number;
  detail?: ValidationError[];
};

// ============ Query Parameters ============

export interface PaginationParams {
  skip?: number;
  limit?: number;
}

export interface AuctionListParams extends PaginationParams {
  status?: string;
}

export interface SearchAuctionsParams extends PaginationParams {
  auction_name?: string;
  auction_status?: string;
  product_type?: string;
  min_price_step?: number;
  max_price_step?: number;
}

export interface TransactionListParams extends PaginationParams {
  transaction_type?: "deposit" | "payment";
}

export interface PaymentListParams extends PaginationParams {
  payment_type?: string;
}

// ============ Product Types (Extended) ============

export interface Product {
  product_id: number;
  product_name: string;
  product_description: string;
  product_type: string;
  initial_price?: number | null;
  image_url?: string | null;
  additional_images?: string[] | null;
  approval_status?: ApprovalStatus | string | null;
  shipping_status?: ShippingStatus | string | null;
  rejection_reason?: string | null;
  suggested_by_user_id?: number | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ProductWithOwner extends Product {
  owner_username?: string;
  owner_email?: string;
}

export interface ProductUpdate {
  productName?: string | null;
  productDescription?: string | null;
  productType?: string | null;
  imageUrl?: string | null;
  additionalImages?: string[] | null;
  shippingStatus?: string | null;
  approvalStatus?: string | null;
  rejectionReason?: string | null;
}

// ============ Bid Types (Extended) ============

export interface Bid {
  bidID: number;
  auctionID: number;
  bidderID: number;
  bidPrice: number;
  bidTime: string;
  bidStatus?: BidStatus | string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface BidWithDetails extends Bid {
  bidder_name?: string;
  auction_name?: string;
  product_name?: string;
}

export interface BidStatusResponse {
  has_bid: boolean;
  highest_bid?: Bid | null;
  user_bid?: Bid | null;
  is_winning: boolean;
}

// ============ Payment Types (Extended) ============

export interface Payment {
  paymentID: number;
  auctionID: number;
  accountID: number;
  paymentAmount: number;
  paymentStatus: PaymentStatus | string;
  paymentMethod?: string | null;
  transactionID?: string | null;
  firstName: string;
  lastName: string;
  userAddress: string;
  userPaymentMethod: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface PaymentWithDetails extends Payment {
  auction_name?: string;
  product_name?: string;
  user_username?: string;
}

export interface PaymentStatusResponse {
  success: boolean;
  data: {
    payment_id: number;
    auction_id: number;
    payment_status: string;
    payment_type: string;
    amount: number;
    created_at: string;
    is_pending: boolean;
    is_completed: boolean;
    is_failed: boolean;
  };
}

// ============ Participation Types ============

export interface Participation {
  participationID: number;
  auctionID: number;
  accountID: number;
  depositAmount: number;
  depositStatus: string;
  depositTransactionID?: string | null;
  registrationDate: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ParticipationWithDetails extends Participation {
  auctionName?: string;
  auctionStatus?: string;
  productName?: string;
  startDate?: string;
  endDate?: string;
}

// ============ Bank Transaction Types ============

export interface BankTransaction {
  transactionID: string;
  accountID: number;
  transactionType: "deposit" | "payment";
  amount: number;
  status: "pending" | "completed" | "failed";
  auctionID?: number | null;
  paymentID?: number | null;
  qrCode?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface DepositResponse {
  success: boolean;
  message: string;
  transactionID: string;
  amount: number;
  qrCode: string;
  status: string;
}

export interface PaymentTransactionResponse {
  success: boolean;
  message: string;
  transactionId: string;
  amount: number;
  qrCode?: string | null;
  status: string;
}

// ============ Paginated Response Types ============

export interface AuctionListResponse {
  total: number;
  skip: number;
  limit: number;
  items: Auction[];
}

export interface BidListResponse {
  total: number;
  skip: number;
  limit: number;
  items: BidWithDetails[];
}

export interface ProductListResponse {
  success: boolean;
  data: ProductWithOwner[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface PaymentListResponse {
  success: boolean;
  data: PaymentWithDetails[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface ParticipationListResponse {
  total: number;
  skip: number;
  limit: number;
  items: ParticipationWithDetails[];
}

export interface TransactionListResponse {
  total: number;
  skip: number;
  limit: number;
  items: BankTransaction[];
}

// ============ Auction Detail Response ============

export interface AuctionDetailResponse {
  auction: Auction;
  product: Product;
  highestBid?: Bid | null;
  totalBids: number;
  totalParticipants: number;
  userParticipation?: Participation | null;
  userHighestBid?: Bid | null;
  timeRemaining?: number | null; // seconds
  formattedStartDate?: string;
  formattedEndDate?: string;
  formattedPriceStep?: string;
}

// ============ Status Response Types ============

export interface AuctionCompletionStatus {
  auction: Auction;
  product: Product;
  winner?: UserResponse | null;
  winning_bid?: Bid | null;
  payment?: Payment | null;
  shipping_status?: string | null;
  completion_percentage: number;
}

export interface ProductStatusResponse {
  product: Product;
  auction?: Auction | null;
  payment?: Payment | null;
  shipping_status: string;
  estimated_delivery?: string | null;
}

// ============ Participant Response ============

export interface ParticipantInfo {
  account_id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  deposit_status: string;
  registration_date: string;
  total_bids: number;
  highest_bid_amount?: number | null;
}

export interface AuctionParticipantsResponse {
  auction_id: number;
  auction_name: string;
  total_participants: number;
  participants: ParticipantInfo[];
}

// ============ Search Response Types ============

export interface SearchAuctionResult extends Auction {
  productName?: string;
  productType?: string;
  productImage?: string;
  highestBidPrice?: number | null;
  totalBids: number;
  timeRemaining?: number | null;
}

export interface SearchAuctionsResponse {
  total: number;
  skip: number;
  limit: number;
  items: SearchAuctionResult[];
  filters_applied: AuctionSearch;
}

// ============ SSE Event Types ============

export interface SSEAuctionUpdate {
  event: "auction_update" | "new_bid" | "auction_ended" | "error";
  data: AuctionUpdateData | NewBidData | AuctionEndedData | ErrorData;
}

export interface AuctionUpdateData {
  auction_id: number;
  current_price: number;
  total_bids: number;
  time_remaining: number;
  highest_bidder?: string;
}

export interface NewBidData {
  bid_id: number;
  auction_id: number;
  bidder_name: string;
  bid_price: number;
  bid_time: string;
}

export interface AuctionEndedData {
  auction_id: number;
  winner_id?: number | null;
  final_price?: number | null;
  total_bids: number;
}

export interface ErrorData {
  message: string;
  code?: string;
}

// ============ Notification Types ============

export interface Notification {
  notification_id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  related_auction_id?: number | null;
  related_bid_id?: number | null;
  related_payment_id?: number | null;
}

export interface NotificationCreate {
  userID: number;
  auctionID?: number | null;
  notificationType: string;
  title: string;
  message: string;
}

export interface NotificationResponse {
  notification_id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  auction_id?: number | null;
  auction_name?: string | null;
  time_ago: string;
  created_at: string;
  read_at?: string | null;
}

export interface NotificationListResponse {
  success: boolean;
  data: {
    items: NotificationResponse[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

export interface UnreadCountResponse {
  success: boolean;
  count: number;
  has_unread: boolean;
}

export interface OTPStatusResponse {
  pending_verification: boolean;
  username?: string | null;
  expires_in?: number | null;
}

// ============ Image Response Types ============

export interface ImageUploadResponse {
  success: boolean;
  message: string;
  image_url: string;
  image_id?: number;
}

export interface MultipleImageUploadResponse {
  success: boolean;
  message: string;
  image_urls: string[];
  image_ids?: number[];
}

export interface ImageInfo {
  filename: string;
  image_path: string;
  image_url: string;
  size: string;
  size_bytes: number;
  modified_time?: string;
}

export interface ImageListResponse {
  success: boolean;
  data: {
    images: ImageInfo[];
    total_count: number;
    total_storage: string;
    total_storage_bytes: number;
    storage_path: string;
    product_id?: number | null;
  };
}

export interface ImageDeleteResponse {
  success: boolean;
  message: string;
  deleted_path: string;
}

export interface ImageFormatsResponse {
  success: boolean;
  data: {
    supported_formats: string[];
    max_file_size: string;
    max_file_size_bytes: number;
    max_files_per_request: number;
    features: string[];
  };
}

export interface SamplesResponse {
  success: boolean;
  message: string;
  data: {
    samples_location: string;
    note: string;
  };
}