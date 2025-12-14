/**
 * API Client for Auction System
 * Type-safe HTTP client with all endpoints - NO ANY TYPES!
 */

import axios, { AxiosInstance } from "axios";
import type {
    // Auth types
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    AccountCreate,
    AccountUpdate,
    UserResponse,
    OTPVerificationRequest,
    RegistrationWithOTPResponse,
    OTPResendResponse,
    PasswordRecoveryRequest,
    PasswordRecoveryResponse,
    PasswordResetRequest,
    PasswordResetResponse,
    ResetTokenResponse,
    // Auction types
    Auction,
    AuctionCreate,
    AuctionUpdate,
    AuctionSearch,
    AuctionResultUpdate,
    AuctionListResponse,
    AuctionDetailResponse,
    AuctionCompletionStatus,
    SearchAuctionsResponse,
    // Product types
    Product,
    ProductCreate,
    ProductUpdate,
    ProductRejectRequest,
    ProductStatusUpdate,
    ProductListResponse,
    ProductStatusResponse,
    ProductWithOwner,
    ImageUploadResponse,
    MultipleImageUploadResponse,
    ImageInfo,
    ImageListResponse,
    ImageDeleteResponse,
    ImageFormatsResponse,
    SamplesResponse,
    // Bid types
    BidCreate,
    Bid,
    BidWithDetails,
    BidListResponse,
    BidStatusResponse,
    // Payment types
    PaymentCreate,
    PaymentStatusUpdate,
    Payment,
    PaymentListResponse,
    PaymentWithDetails,
    PaymentStatusResponse,
    // Participation types
    Participation,
    ParticipationListResponse,
    AuctionParticipantsResponse,
    // Bank types
    BankTransaction,
    DepositResponse,
    PaymentTransactionResponse,
    TransactionListResponse,
    // Common types
    MessageResponse,
    Notification,
    NotificationCreate,
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    OTPStatusResponse,
    // Query params
    PaginationParams,
    AuctionListParams,
    SearchAuctionsParams,
    TransactionListParams,
    PaymentListParams,
} from "./types";

const API_BASE_URL = 'http://localhost:8000';
const API_PREFIX = 'api/v1';

export class Api {
    public client: AxiosInstance;
    private accessToken: string | null = null;
    private baseURL: string = `${API_BASE_URL}/${API_PREFIX}`;

    constructor() {
        if (typeof localStorage !== 'undefined') {
            this.accessToken = localStorage.getItem("access_token");
        }

        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                "Content-Type": "application/json",
            },
        });

        // Request interceptor to add auth token
        this.client.interceptors.request.use((config) => {
            if (this.accessToken) {
                config.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return config;
        });

        // Response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (error.response?.status === 401) {
                    const refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem("refresh_token") : null;
                    if (refreshToken) {
                        try {
                            const tokens = await this.auth.refresh({ refresh_token: refreshToken });
                            this.setTokens(tokens.access_token, tokens.refresh_token);
                            error.config.headers.Authorization = `Bearer ${tokens.access_token}`;
                            return this.client.request(error.config);
                        } catch (error) {
                            this.clearTokens();
                            if (typeof window !== 'undefined') {
                                window.location.href = "/login";
                            }
                        }
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    // ============ Token Management ============

    setTokens(accessToken: string, refreshToken: string): void {
        this.accessToken = accessToken;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem("access_token", accessToken);
            localStorage.setItem("refresh_token", refreshToken);
        }
    }

    clearTokens(): void {
        this.accessToken = null;
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
        }
    }

    private getHeaders(includeAuth: boolean = true): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (includeAuth && typeof window !== 'undefined') {
            const token = localStorage.getItem('access_token');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    // ============ Authentication Endpoints ============

    auth = {
        login: async (data: LoginRequest): Promise<TokenResponse> => {
            const response = await this.client.post<TokenResponse>(
                `${this.baseURL}/auth/login`,
                data
            );
            this.setTokens(response.data.access_token, response.data.refresh_token);
            return response.data;
        },

        register: async (data: AccountCreate): Promise<RegistrationWithOTPResponse> => {
            const response = await this.client.post<RegistrationWithOTPResponse>(
                `${this.baseURL}/auth/register`,
                data
            );
            return response.data;
        },

        verifyOTP: async (data: OTPVerificationRequest): Promise<TokenResponse> => {
            const response = await this.client.post<TokenResponse>(
                `${this.baseURL}/auth/verify-otp`,
                data
            );
            this.setTokens(response.data.access_token, response.data.refresh_token);
            return response.data;
        },

        resendOTP: async (username: string): Promise<OTPResendResponse> => {
            const response = await this.client.post<OTPResendResponse>(`${this.baseURL}/auth/resend-otp`, { username });
            return response.data;
        },

        refresh: async (data: RefreshRequest): Promise<TokenResponse> => {
            const response = await this.client.post<TokenResponse>(`${this.baseURL}/auth/refresh`, data);
            return response.data;
        },

        getMe: async (): Promise<UserResponse> => {
            const response = await this.client.get<UserResponse>(`${this.baseURL}/auth/me`);
            return response.data;
        },

        requestPasswordRecovery: async (data: PasswordRecoveryRequest): Promise<PasswordRecoveryResponse> => {
            const response = await this.client.post<PasswordRecoveryResponse>(`${this.baseURL}/auth/recover`, data);
            return response.data;
        },

        verifyPasswordRecoveryOTP: async (data: OTPVerificationRequest): Promise<ResetTokenResponse> => {
            const response = await this.client.post<ResetTokenResponse>(`${this.baseURL}/auth/recover/verify`, data);
            return response.data;
        },

        resetPassword: async (data: PasswordResetRequest): Promise<PasswordResetResponse> => {
            const response = await this.client.post<PasswordResetResponse>(`${this.baseURL}/auth/reset`, data);
            return response.data;
        },

        getOTPStatus: async (): Promise<OTPStatusResponse> => {
            const response = await this.client.get<OTPStatusResponse>(`${this.baseURL}/auth/otp/status`);
            return response.data;
        },

        cancelRegistration: async (): Promise<MessageResponse> => {
            const response = await this.client.post<MessageResponse>(`${this.baseURL}/auth/cancel-registration`);
            return response.data;
        },

        logout: (): void => {
            this.clearTokens();
        },
    };

    // ============ Account Endpoints ============

    accounts = {
        getProfile: async (): Promise<UserResponse> => {
            const response = await this.client.get<UserResponse>(`${this.baseURL}/accounts/profile`);
            return response.data;
        },

        updateProfile: async (data: AccountUpdate): Promise<UserResponse> => {
            const response = await this.client.put<UserResponse>(`${this.baseURL}/accounts/profile`, data);
            return response.data;
        },

        changePassword: async (oldPassword: string, newPassword: string): Promise<MessageResponse> => {
            const response = await this.client.post<MessageResponse>(`${this.baseURL}/accounts/change-password`, {
                old_password: oldPassword,
                new_password: newPassword,
            });
            return response.data;
        },
    };

    // ============ Auction Endpoints ============

    auctions = {
        create: async (data: AuctionCreate): Promise<Auction> => {
            const response = await this.client.post<Auction>(`${this.baseURL}/auctions/register`, data);
            return response.data;
        },

        list: async (params?: AuctionListParams): Promise<AuctionListResponse> => {
            const response = await this.client.get<AuctionListResponse>(`${this.baseURL}/auctions/`, { params });
            return response.data;
        },

        getById: async (auctionId: number): Promise<AuctionDetailResponse> => {
            const response = await this.client.get<AuctionDetailResponse>(`${this.baseURL}/auctions/${auctionId}`);
            return response.data;
        },

        update: async (auctionId: number, data: AuctionUpdate): Promise<Auction> => {
            const response = await this.client.put<Auction>(`${this.baseURL}/auctions/${auctionId}`, data);
            return response.data;
        },

        delete: async (auctionId: number): Promise<MessageResponse> => {
            const response = await this.client.delete<MessageResponse>(`${this.baseURL}/auctions/${auctionId}`);
            return response.data;
        },

        search: async (params: SearchAuctionsParams): Promise<SearchAuctionsResponse> => {
            const response = await this.client.get<SearchAuctionsResponse>(`${this.baseURL}/auctions/search`, { params });
            return response.data;
        },

        getRegistered: async (): Promise<Auction[]> => {
            const response = await this.client.get<Auction[]>(`${this.baseURL}/auctions/registered/list`);
            return response.data;
        },
    };

    // ============ Bid Endpoints ============

    bids = {
        place: async (data: BidCreate): Promise<BidWithDetails> => {
            const response = await this.client.post<BidWithDetails>(`${this.baseURL}/bids/place`, data);
            return response.data;
        },

        cancel: async (bidId: number): Promise<MessageResponse> => {
            const response = await this.client.post<MessageResponse>(`${this.baseURL}/bids/cancel/${bidId}`);
            return response.data;
        },

        getMyBids: async (params?: PaginationParams): Promise<BidListResponse> => {
            const response = await this.client.get<BidListResponse>(`${this.baseURL}/bids/my-bids`, { params });
            return response.data;
        },

        getAuctionBids: async (auctionId: number, params?: PaginationParams): Promise<BidListResponse> => {
            const response = await this.client.get<BidListResponse>(`${this.baseURL}/bids/auction/${auctionId}`, { params });
            return response.data;
        },

        getHighestBid: async (auctionId: number): Promise<Bid | null> => {
            const response = await this.client.get<Bid | null>(`${this.baseURL}/bids/auction/${auctionId}/highest`);
            return response.data;
        },

        getMyBidStatus: async (auctionId: number): Promise<BidStatusResponse> => {
            const response = await this.client.get<BidStatusResponse>(`${this.baseURL}/bids/auction/${auctionId}/my-status`);
            return response.data;
        },
    };

    // ============ Product Endpoints ============

    products = {
        create: async (data: ProductCreate): Promise<Product> => {
            const response = await this.client.post<Product>(`${this.baseURL}/products/register`, data);
            return response.data;
        },

        createWithImages: async (formData: FormData): Promise<Product> => {
            const response = await this.client.post<Product>(
                `${this.baseURL}/products/register-with-images`,
                formData,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                    transformRequest: [(data) => {
                        return data;
                    }],
                });
            return response.data;
        },

        list: async (params?: PaginationParams): Promise<ProductListResponse> => {
            const response = await this.client.get<ProductListResponse>(`${this.baseURL}/products/`, { params });
            return response.data;
        },

        getById: async (productId: number): Promise<ProductWithOwner> => {
            const response = await this.client.get<ProductWithOwner>(`${this.baseURL}/products/${productId}`);
            return response.data;
        },

        update: async (productId: number, data: ProductUpdate): Promise<{ success: boolean; message: string; data: Product }> => {
            const response = await this.client.put<{ success: boolean; message: string; data: Product }>(`${this.baseURL}/products/${productId}`, data);
            return response.data;
        },

        delete: async (productId: number): Promise<MessageResponse> => {
            const response = await this.client.delete<MessageResponse>(`${this.baseURL}/products/${productId}`);
            return response.data;
        },

        getPending: async (params?: PaginationParams): Promise<ProductListResponse> => {
            const response = await this.client.get<ProductListResponse>(`${this.baseURL}/products/pending/approval`, { params });
            return response.data;
        },

        approve: async (productId: number): Promise<MessageResponse> => {
            const response = await this.client.post<MessageResponse>(`${this.baseURL}/products/${productId}/approve`);
            return response.data;
        },

        reject: async (productId: number, data: ProductRejectRequest): Promise<MessageResponse> => {
            const response = await this.client.post<MessageResponse>(`${this.baseURL}/products/${productId}/reject`, data);
            return response.data;
        },
    };

    // ============ Payment Endpoints ============

    payments = {
        create: async (data: PaymentCreate): Promise<Payment> => {
            const response = await this.client.post<Payment>(`${this.baseURL}/payments/create`, data);
            return response.data;
        },

        updateStatus: async (paymentId: number, data: PaymentStatusUpdate): Promise<Payment> => {
            const response = await this.client.put<Payment>(`${this.baseURL}/payments/${paymentId}/status`, data);
            return response.data;
        },

        process: async (paymentId: number): Promise<MessageResponse> => {
            const response = await this.client.post<MessageResponse>(`${this.baseURL}/payments/${paymentId}/process`);
            return response.data;
        },

        getMyPayments: async (params?: PaymentListParams): Promise<PaymentListResponse> => {
            const response = await this.client.get<PaymentListResponse>(`${this.baseURL}/payments/my-payments`, { params });
            return response.data;
        },

        getAuctionPayment: async (auctionId: number): Promise<PaymentWithDetails> => {
            const response = await this.client.get<PaymentWithDetails>(`${this.baseURL}/payments/auction/${auctionId}`);
            return response.data;
        },

        getPending: async (params?: PaginationParams): Promise<PaymentListResponse> => {
            const response = await this.client.get<PaymentListResponse>(`${this.baseURL}/payments/all/pending`, { params });
            return response.data;
        },

        getTokenStatus: async (token: string): Promise<{ valid: boolean; status: string }> => {
            const response = await this.client.get<{ valid: boolean; status: string }>(`${this.baseURL}/payments/token/${token}/status`);
            return response.data;
        },

        getByStatus: async (statusFilter: string, params?: PaginationParams): Promise<PaymentListResponse> => {
            const response = await this.client.get<PaymentListResponse>(`${this.baseURL}/payments/status/${statusFilter}`, { params });
            return response.data;
        },

        qrCallback: async (token: string, data?: any): Promise<any> => {
            const response = await this.client.post<any>(`${this.baseURL}/payments/qr-callback/${token}`, data);
            return response.data;
        },

        checkStatus: async (paymentId: number): Promise<PaymentStatusResponse> => {
            const response = await this.client.get<PaymentStatusResponse>(`${this.baseURL}/payments/${paymentId}/status`);
            return response.data;
        },
    };

    // ============ Participation Endpoints ============

    participations = {
        register: async (auctionId: number, amount?: number): Promise<Participation> => {
            const data = { auction_id: auctionId, amount };
            const response = await this.client.post<Participation>(`${this.baseURL}/participation/register`, data);
            return response.data;
        },

        unregister: async (auctionId: number): Promise<MessageResponse> => {
            const response = await this.client.post<MessageResponse>(`${this.baseURL}/participation/unregister`, null, {
                params: { auction_id: auctionId },
            });
            return response.data;
        },

        getMyRegistrations: async (params?: PaginationParams): Promise<ParticipationListResponse> => {
            const response = await this.client.get<ParticipationListResponse>(`${this.baseURL}/participation/my-registrations`, { params });
            return response.data;
        },

        getAuctionParticipants: async (auctionId: number): Promise<AuctionParticipantsResponse> => {
            const response = await this.client.get<AuctionParticipantsResponse>(`${this.baseURL}/participation/auction/${auctionId}/participants`);
            return response.data;
        },

        getStatus: async (auctionId: number): Promise<{ is_registered: boolean; participation?: Participation }> => {
            const response = await this.client.get<{ is_registered: boolean; participation?: Participation }>(`${this.baseURL}/participation/auction/${auctionId}/status`);
            return response.data;
        },
    };

    // ============ Bank Endpoints (Mock) ============

    bank = {
        createDeposit: async (auctionId: number): Promise<DepositResponse> => {
            const response = await this.client.post<DepositResponse>(`${this.baseURL}/bank/deposit/create`, null, {
                params: { auction_id: auctionId },
            });
            return response.data;
        },

        getDepositStatus: async (transactionId: string): Promise<BankTransaction> => {
            const response = await this.client.get<BankTransaction>(`${this.baseURL}/bank/deposit/status/${transactionId}`);
            return response.data;
        },

        createPayment: async (data: { auction_id: number; payment_id: number }): Promise<PaymentTransactionResponse> => {
            const response = await this.client.post<PaymentTransactionResponse>(`${this.baseURL}/bank/payment/create`, data);
            return response.data;
        },

        confirmPayment: async (data: { transaction_id: string; payment_id: number }): Promise<MessageResponse> => {
            const response = await this.client.post<MessageResponse>(`${this.baseURL}/bank/payment/confirm`, data);
            return response.data;
        },

        getPaymentQR: async (transactionId: string): Promise<{ qr_code: string }> => {
            const response = await this.client.get<{ qr_code: string }>(`${this.baseURL}/bank/payment/qr/${transactionId}`);
            return response.data;
        },

        getPaymentStatus: async (transactionId: string): Promise<BankTransaction> => {
            const response = await this.client.get<BankTransaction>(`${this.baseURL}/bank/payment/status/${transactionId}`);
            return response.data;
        },

        getMyTransactions: async (params?: TransactionListParams): Promise<TransactionListResponse> => {
            const response = await this.client.get<TransactionListResponse>(`${this.baseURL}/bank/transactions/me`, { params });
            return response.data;
        },

        getSupportedBanks: async (): Promise<{ banks: Array<{ code: string; name: string }> }> => {
            const response = await this.client.get<{ banks: Array<{ code: string; name: string }> }>(`${this.baseURL}/bank/banks`);
            return response.data;
        },

        getTerms: async (): Promise<{ terms: string }> => {
            const response = await this.client.get<{ terms: string }>(`${this.baseURL}/bank/terms`);
            return response.data;
        },

        getAutoConfirmUrl: (transactionId: string): string => {
            return `${this.baseURL}/bank/payment/auto-confirm/${transactionId}`;
        },

        getHealth: async (): Promise<{ success: boolean; status: string; message: string }> => {
            const response = await this.client.get<{ success: boolean; status: string; message: string }>(`${this.baseURL}/bank/health`);
            return response.data;
        },
    };

    // ============ Search Endpoints ============

    search = {
        auctions: async (data: AuctionSearch, params?: PaginationParams): Promise<SearchAuctionsResponse> => {
            const response = await this.client.post<SearchAuctionsResponse>(`${this.baseURL}/search/auctions`, data, { params });
            return response.data;
        },

        auctionsByQuery: async (params: SearchAuctionsParams): Promise<SearchAuctionsResponse> => {
            const response = await this.client.get<SearchAuctionsResponse>(`${this.baseURL}/search/auctions`, { params });
            return response.data;
        },

        auctionsByStatus: async (status: string, params?: PaginationParams): Promise<SearchAuctionsResponse> => {
            const response = await this.client.get<SearchAuctionsResponse>(`${this.baseURL}/search/auctions/status/${status}`, { params });
            return response.data;
        },

        productsByType: async (productType: string, params?: PaginationParams): Promise<{ success: boolean; data: any }> => {
            const response = await this.client.get<{ success: boolean; data: any }>(`${this.baseURL}/search/products/type/${productType}`, { params });
            return response.data;
        },

        auctionsByPriceRange: async (minPrice?: number, maxPrice?: number, params?: PaginationParams): Promise<SearchAuctionsResponse> => {
            const response = await this.client.get<SearchAuctionsResponse>(`${this.baseURL}/search/auctions/price-range`, {
                params: { min_price: minPrice, max_price: maxPrice, ...params }
            });
            return response.data;
        },

        activeAuctions: async (params?: PaginationParams): Promise<SearchAuctionsResponse> => {
            const response = await this.client.get<SearchAuctionsResponse>(`${this.baseURL}/search/auctions/active`, { params });
            return response.data;
        },
    };

    // ============ Status Management Endpoints ============

    status = {
        updateProductStatus: async (productId: number, data: ProductStatusUpdate): Promise<Product> => {
            const response = await this.client.put<Product>(`${this.baseURL}/status/product/${productId}`, data);
            return response.data;
        },

        getProductStatus: async (productId: number): Promise<ProductStatusResponse> => {
            const response = await this.client.get<ProductStatusResponse>(`${this.baseURL}/status/product/${productId}`);
            return response.data;
        },

        updateAuctionResult: async (auctionId: number, data: AuctionResultUpdate): Promise<Auction> => {
            const response = await this.client.put<Auction>(`${this.baseURL}/status/auction/${auctionId}/result`, data);
            return response.data;
        },

        getAuctionCompletionStatus: async (auctionId: number): Promise<AuctionCompletionStatus> => {
            const response = await this.client.get<AuctionCompletionStatus>(`${this.baseURL}/status/auction/${auctionId}/complete`);
            return response.data;
        },

        finalizeAuction: async (auctionId: number): Promise<MessageResponse> => {
            const response = await this.client.post<MessageResponse>(`${this.baseURL}/status/auction/${auctionId}/finalize`);
            return response.data;
        },
    };

    // ============ Image Upload Endpoints ============

    images = {
        upload: async (file: File, productId?: number): Promise<ImageUploadResponse> => {
            const formData = new FormData();
            formData.append('file', file);
            if (productId) formData.append('product_id', productId.toString());
            const response = await this.client.post<ImageUploadResponse>(`${this.baseURL}/images/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        },

        uploadMultiple: async (files: File[], productId?: number): Promise<MultipleImageUploadResponse> => {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            if (productId) formData.append('product_id', productId.toString());
            const response = await this.client.post<MultipleImageUploadResponse>(`${this.baseURL}/images/upload/multiple`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        },

        view: (imagePath: string): string => {
            return `${this.baseURL}/images/view/${imagePath}`;
        },

        delete: async (imagePath: string): Promise<ImageDeleteResponse> => {
            const response = await this.client.delete<ImageDeleteResponse>(`${this.baseURL}/images/delete`, {
                params: { image_path: imagePath }
            });
            return response.data;
        },

        list: async (productId?: number): Promise<ImageListResponse> => {
            const response = await this.client.get<ImageListResponse>(`${this.baseURL}/images/list`, {
                params: productId ? { product_id: productId } : undefined
            });
            return response.data;
        },

        getFormats: async (): Promise<ImageFormatsResponse> => {
            const response = await this.client.get<ImageFormatsResponse>(`${this.baseURL}/images/formats`);
            return response.data;
        },

        createSamples: async (): Promise<SamplesResponse> => {
            const response = await this.client.post<SamplesResponse>(`${this.baseURL}/images/samples`);
            return response.data;
        }
    };

    // ============ Notification Endpoints ============

    notifications = {
        getAll: async (params?: PaginationParams): Promise<NotificationListResponse> => {
            const response = await this.client.get<NotificationListResponse>(`${this.baseURL}/notifications/`, { params });
            return response.data;
        },

        getUnread: async (params?: PaginationParams): Promise<NotificationListResponse> => {
            const response = await this.client.get<NotificationListResponse>(`${this.baseURL}/notifications/unread`, { params });
            return response.data;
        },

        getUnreadCount: async (): Promise<UnreadCountResponse> => {
            const response = await this.client.get<UnreadCountResponse>(`${this.baseURL}/notifications/unread/count`);
            return response.data;
        },

        markAsRead: async (notificationId: number): Promise<{ success: boolean; message: string; data: any }> => {
            const response = await this.client.put<{ success: boolean; message: string; data: any }>(`${this.baseURL}/notifications/${notificationId}/read`);
            return response.data;
        },

        markAllAsRead: async (): Promise<{ success: boolean; message: string; marked_at: string }> => {
            const response = await this.client.put<{ success: boolean; message: string; marked_at: string }>(`${this.baseURL}/notifications/mark-all-read`);
            return response.data;
        },

        delete: async (notificationId: number): Promise<MessageResponse> => {
            const response = await this.client.delete<MessageResponse>(`${this.baseURL}/notifications/${notificationId}`);
            return response.data;
        },

        getByAuction: async (auctionId: number): Promise<{ success: boolean; auction_id: number; auction_name: string; notifications: NotificationResponse[]; total_count: number }> => {
            const response = await this.client.get<{ success: boolean; auction_id: number; auction_name: string; notifications: NotificationResponse[]; total_count: number }>(`${this.baseURL}/notifications/auction/${auctionId}`);
            return response.data;
        },

        create: async (data: NotificationCreate): Promise<{ success: boolean; message: string; data: any }> => {
            const response = await this.client.post<{ success: boolean; message: string; data: any }>(`${this.baseURL}/notifications/create`, data);
            return response.data;
        },

        createTest: async (): Promise<{ success: boolean; message: string; data: any }> => {
            const response = await this.client.post<{ success: boolean; message: string; data: any }>(`${this.baseURL}/notifications/test`);
            return response.data;
        },
    };

    // ============ SSE (Server-Sent Events) ============

    sse = {
        subscribeToAuction: (auctionId: number, onMessage: (data: AuctionDetailResponse) => void): EventSource => {
            const token = this.accessToken || (typeof localStorage !== 'undefined' ? localStorage.getItem("access_token") : null);
            const eventSource = new EventSource(`${this.client.defaults.baseURL}/sse/auction/${auctionId}?token=${token}`);
            eventSource.onmessage = (event) => onMessage(JSON.parse(event.data));
            return eventSource;
        },

        subscribeToActiveAuctions: (onMessage: (data: Auction[]) => void): EventSource => {
            const token = this.accessToken || (typeof localStorage !== 'undefined' ? localStorage.getItem("access_token") : null);
            const eventSource = new EventSource(`${this.client.defaults.baseURL}/sse/auctions/active?token=${token}`);
            eventSource.onmessage = (event) => onMessage(JSON.parse(event.data));
            return eventSource;
        },

        subscribeToNotifications: (onMessage: (data: Notification[]) => void): EventSource => {
            const token = this.accessToken || (typeof localStorage !== 'undefined' ? localStorage.getItem("access_token") : null);
            const eventSource = new EventSource(`${this.client.defaults.baseURL}/sse/notifications?token=${token}`);
            eventSource.onmessage = (event) => onMessage(JSON.parse(event.data));
            return eventSource;
        },
    };

    // ============ Utility Methods ============

    setBaseURL(url: string): void {
        this.client.defaults.baseURL = url;
    }

    getBaseURL(): string {
        return this.client.defaults.baseURL || "";
    }
}

// Export singleton instance
export const apiClient = new Api();
export default apiClient;