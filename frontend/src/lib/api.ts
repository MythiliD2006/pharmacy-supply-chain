import axios from "axios";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from cookie on every request
api.interceptors.request.use((config) => {
  const token = Cookies.get("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-redirect to /login on 401 (except when on /login or public /verify routes)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      const isPublic = window.location.pathname.startsWith("/login") || window.location.pathname.startsWith("/verify");
      if (!isPublic) {
        Cookies.remove("token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// Standard error parser for backend responses
export function getErrorMessage(err: unknown, fallback = "An error occurred. Please try again."): string {
  if (!err) return fallback;
  const axiosErr = err as {
    response?: {
      data?: {
        message?: string;
        error?: { code?: string; message?: string };
      };
    };
    message?: string;
  };

  return (
    axiosErr.response?.data?.error?.message ||
    axiosErr.response?.data?.message ||
    axiosErr.message ||
    fallback
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  role: "Manufacturer" | "Distributor" | "Wholesaler" | "Pharmacy";
  walletAddress: string;
  active: boolean;
}

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: "admin" | "participant";
  participant?: ParticipantInfo | null;
  participantId?: string; // alias
}

export interface Batch {
  _id: string;
  batchId: string;
  medicineName: string;
  description?: string;
  manufacturer: string;
  manufacturerName?: string;
  manufacturingDate: string;
  expiryDate: string;
  quantity: number;
  dataHash?: string | null;
  currentHolder?: string | null;
  currentHolderName?: string | null;
  currentHolderRole?: string | null;
  chainStatus?: "pending" | "confirmed";
  status?: "genuine" | "expired" | "invalid" | "pending";
  registerTxHash?: string | null;
  registerBlock?: number | null;
  registeredAt?: string | null;
  expired?: boolean;
  txHash?: string; // compatibility alias
}

export interface Transfer {
  _id: string;
  transferId: number;
  batchId: string;
  from: string;
  to: string;
  fromRole?: string | number | null;
  toRole?: string | number | null;
  fromName?: string | null;
  toName?: string | null;
  medicineName?: string | null;
  status: "Pending" | "Confirmed" | "Rejected" | "Cancelled";
  requestTxHash?: string | null;
  resolveTxHash?: string | null;
  txHash?: string | null;
  requestedAt: string;
  resolvedAt?: string | null;
}

export interface Participant {
  _id: string;
  name: string;
  walletAddress: string;
  role: "Manufacturer" | "Distributor" | "Wholesaler" | "Pharmacy" | string;
  active: boolean;
  location?: string;
  contactPhone?: string;
  registeredAt?: string;
  createdAt?: string;
  user?: {
    email: string;
    lastLoginAt?: string;
    active: boolean;
  };
  onChain?: {
    registered: boolean;
    txHash?: string | null;
    blockNumber?: number | null;
  };
}

export interface CustodyRecord {
  step?: number;
  from: string;
  to: string;
  fromRole: number | string;
  toRole: number | string;
  timestamp: number;
  fromName?: string | null;
  toName?: string | null;
  toLocation?: string | null;
  txHash?: string | null;
}

export interface VerifyResult {
  batchId: string;
  status: "VERIFIED" | "UNREGISTERED" | "EXPIRED" | "INCONSISTENT" | "genuine" | "expired" | "invalid";
  message: string;
  registered: boolean;
  expired: boolean;
  historyValid: boolean;
  dataHashValid?: boolean | null;
  batch?: Batch;
  currentHolder?: {
    address: string;
    name: string;
    role: string;
  };
  transferCount?: number;
  history?: CustodyRecord[];
  custodyHistory?: CustodyRecord[]; // alias for frontend views
  registration?: {
    txHash: string | null;
    blockNumber: number | null;
    timestamp: string | null;
  };
  daysToExpiry?: number;
  checkedAt?: string;
}

export interface PreparedTx {
  tx: {
    to: string;
    data: string;
    value?: string;
  };
  dataHash?: string;
  next?: string;
}

export interface AdminStats {
  batches: { total: number; expired: number };
  participants: { total: number; active: number; byRole: Record<string, number> };
  transfers: { total: number; byStatus: Record<string, number> };
  verifications: { total: number; byStatus: Record<string, number>; verifiedMedicines: number };
  invalidAttempts: { rejectedBeforeSigning: number; failedOnChain: number };
  chain?: any;
  sync?: any;
}

export interface RegisterBatchPayload {
  batchId: string;
  medicineName: string;
  description?: string;
  manufacturingDate: string;
  expiryDate: string;
  quantity: number;
}

export interface CreateParticipantPayload {
  name: string;
  walletAddress: string;
  role: "Manufacturer" | "Distributor" | "Wholesaler" | "Pharmacy";
  email: string;
  password: string;
  location?: string;
  contactPhone?: string;
}

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<{ token: string; user: User }>>("/auth/login", { email, password }),
  me: () => api.get<ApiResponse<{ user: User }>>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<ApiResponse<{ message: string }>>("/auth/change-password", { currentPassword, newPassword }),
};

// ─── Batches ───────────────────────────────────────────────────────────────
export const batchApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PaginatedResult<Batch>>>("/batches", { params }),
  get: (batchId: string) =>
    api.get<
      ApiResponse<{
        batch: Batch;
        status: string;
        statusMessage: string;
        history: any[];
        transfers: Transfer[];
        pendingTransfer: Transfer | null;
        isHolder: boolean;
        qrCode: string;
        verifyUrl: string;
      }>
    >(`/batches/${encodeURIComponent(batchId)}`),
  prepare: (data: RegisterBatchPayload) =>
    api.post<ApiResponse<PreparedTx>>("/batches/prepare", data),
  getQr: (batchId: string) =>
    api.get<ApiResponse<{ qrCode: string; verifyUrl: string }>>(`/batches/${encodeURIComponent(batchId)}/qr?format=dataurl`),
};

// ─── Transfers ─────────────────────────────────────────────────────────────
export const transferApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PaginatedResult<Transfer>>>("/transfers", { params }),
  get: (transferId: number | string) =>
    api.get<ApiResponse<{ transfer: Transfer }>>(`/transfers/${transferId}`),
  prepareRequest: (data: { batchId: string; to: string }) =>
    api.post<ApiResponse<{ tx: PreparedTx["tx"] }>>("/transfers/prepare", data),
  prepareAction: (transferId: number | string, action: "confirm" | "reject" | "cancel") =>
    api.post<ApiResponse<{ tx: PreparedTx["tx"] }>>(`/transfers/${transferId}/${action}/prepare`),
};

// ─── Transactions ──────────────────────────────────────────────────────────
export const transactionApi = {
  submit: (txHash: string) =>
    api.post<ApiResponse<{ transaction: any; batch: Batch | null; transfer: Transfer | null }>>(
      "/transactions",
      { txHash }
    ),
};

// ─── Verify (public) ───────────────────────────────────────────────────────
export const verifyApi = {
  verify: (batchId: string) =>
    api.get<ApiResponse<VerifyResult>>(`/verify/${encodeURIComponent(batchId)}`),
};

// ─── Participants ──────────────────────────────────────────────────────────
export const participantApi = {
  // admin only
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PaginatedResult<Participant>>>("/participants", { params }),
  // any logged in user (active directory for transfers)
  directory: (params?: { role?: string }) =>
    api.get<ApiResponse<{ items: Participant[] }>>("/participants/directory", { params }),
  add: (data: CreateParticipantPayload) =>
    api.post<ApiResponse<{ participant: Participant; user: any; transactions: string[] }>>(
      "/participants",
      data
    ),
  setStatus: (id: string, active: boolean) =>
    api.patch<ApiResponse<{ participant: Participant }>>(`/participants/${id}/status`, { active }),
  sync: (id: string) =>
    api.post<ApiResponse<{ participant: Participant; transaction: string }>>(`/participants/${id}/sync`),
};

// ─── Admin ─────────────────────────────────────────────────────────────────
export const adminApi = {
  stats: () => api.get<ApiResponse<AdminStats>>("/admin/stats"),
  batches: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PaginatedResult<Batch>>>("/admin/batches", { params }),
  transfers: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PaginatedResult<Transfer>>>("/admin/transfers", { params }),
  transactions: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PaginatedResult<any>>>("/admin/transactions", { params }),
  verifications: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<PaginatedResult<any>>>("/admin/verifications", { params }),
  sync: () => api.get<ApiResponse<any>>("/admin/sync"),
};

export default api;
