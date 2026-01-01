import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE_URL = '/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await useAuthStore.getState().refreshTokens();
        
        // Retry original request with new token
        const { accessToken } = useAuthStore.getState();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API functions
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
};

export const groupsApi = {
  list: () => api.get('/groups'),
  get: (id: string) => api.get(`/groups/${id}`),
  create: (data: any) => api.post('/groups', data),
  update: (id: string, data: any) => api.patch(`/groups/${id}`, data),
  delete: (id: string) => api.delete(`/groups/${id}`),
  getMembers: (id: string) => api.get(`/groups/${id}/members`),
  inviteMember: (id: string, data: { email: string; role: string }) =>
    api.post(`/groups/${id}/invite`, data),
};

export const savingsApi = {
  create: (data: any) => api.post('/savings', data),
  get: (groupId: string) => api.get(`/savings/${groupId}`),
  getSummary: (groupId: string) => api.get(`/savings/${groupId}/summary`),
  updateRules: (groupId: string, data: any) =>
    api.patch(`/savings/${groupId}/rules`, data),
  getStatement: (groupId: string, page?: number) =>
    api.get(`/savings/${groupId}/statement`, { params: { page } }),
};

export const contributionsApi = {
  create: (data: any) => api.post('/contributions', data),
  get: (id: string) => api.get(`/contributions/${id}`),
  getForGroup: (groupId: string, params?: { status?: string; page?: number }) =>
    api.get(`/contributions/group/${groupId}`, { params }),
  getMy: (groupId: string, page?: number) =>
    api.get(`/contributions/my/${groupId}`, { params: { page } }),
  approve: (id: string, notes?: string) =>
    api.post(`/contributions/${id}/approve`, { notes }),
  reject: (id: string, reason: string) =>
    api.post(`/contributions/${id}/reject`, { reason }),
  cancel: (id: string) => api.post(`/contributions/${id}/cancel`),
};

export const payoutsApi = {
  create: (data: any) => api.post('/savings/payouts', data),
  get: (id: string) => api.get(`/savings/payouts/${id}`),
  getForGroup: (groupId: string) => api.get(`/savings/${groupId}/payouts`),
  approve: (id: string, notes?: string) =>
    api.post(`/savings/payouts/${id}/approve`, { notes }),
};

export const notificationsApi = {
  list: (page?: number) => api.get('/notifications', { params: { page } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
};

export const documentsApi = {
  upload: (file: File, type: string, groupId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (groupId) formData.append('groupId', groupId);
    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getDownloadUrl: (id: string) => api.get(`/documents/${id}/download`),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

// Grocery API
export const groceryApi = {
  // Summary
  getSummary: (groupId: string) => 
    api.get(`/groups/${groupId}/grocery/summary`),

  // Products
  getProducts: (groupId: string, params?: { category?: string; active?: boolean; search?: string }) =>
    api.get(`/groups/${groupId}/grocery/products`, { params }),
  getProduct: (groupId: string, productId: string) =>
    api.get(`/groups/${groupId}/grocery/products/${productId}`),
  createProduct: (groupId: string, data: { name: string; unit: string; category: string; defaultSize?: number }) =>
    api.post(`/groups/${groupId}/grocery/products`, data),
  updateProduct: (groupId: string, productId: string, data: Partial<{ name: string; unit: string; category: string; defaultSize: number; active: boolean }>) =>
    api.patch(`/groups/${groupId}/grocery/products/${productId}`, data),
  deleteProduct: (groupId: string, productId: string) =>
    api.delete(`/groups/${groupId}/grocery/products/${productId}`),
  getCategories: () => api.get('/groups/any/grocery/products/categories'),

  // Purchases
  getPurchases: (groupId: string, params?: { startDate?: string; endDate?: string; status?: string }) =>
    api.get(`/groups/${groupId}/grocery/purchases`, { params }),
  getPurchase: (groupId: string, purchaseId: string) =>
    api.get(`/groups/${groupId}/grocery/purchases/${purchaseId}`),
  createPurchase: (groupId: string, data: {
    supplierName: string;
    purchaseDate: string;
    receiptDocumentId?: string;
    notes?: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  }) => api.post(`/groups/${groupId}/grocery/purchases`, data),
  approvePurchase: (groupId: string, purchaseId: string, notes?: string) =>
    api.post(`/groups/${groupId}/grocery/purchases/${purchaseId}/approve`, { notes }),
  rejectPurchase: (groupId: string, purchaseId: string, reason: string) =>
    api.post(`/groups/${groupId}/grocery/purchases/${purchaseId}/reject`, { reason }),

  // Stock
  getStock: (groupId: string, params?: { category?: string; search?: string }) =>
    api.get(`/groups/${groupId}/grocery/stock`, { params }),
  getStockMovements: (groupId: string, params?: { productId?: string; movementType?: string; startDate?: string; endDate?: string }) =>
    api.get(`/groups/${groupId}/grocery/stock/movements`, { params }),
  createAdjustment: (groupId: string, data: { productId: string; quantity: number; reason: string }) =>
    api.post(`/groups/${groupId}/grocery/stock/adjustments`, data),

  // Distributions
  getDistributions: (groupId: string, params?: { status?: string; startDate?: string; endDate?: string }) =>
    api.get(`/groups/${groupId}/grocery/distributions`, { params }),
  getDistribution: (groupId: string, distributionId: string) =>
    api.get(`/groups/${groupId}/grocery/distributions/${distributionId}`),
  createDistribution: (groupId: string, data: {
    distributionDate: string;
    allocationRule?: string;
    notes?: string;
    products: Array<{ productId: string; totalQuantity: number }>;
    overrides?: Array<{ memberId: string; productId: string; quantity: number; reason?: string }>;
  }) => api.post(`/groups/${groupId}/grocery/distributions`, data),
  updateDistributionStatus: (groupId: string, distributionId: string, status: string) =>
    api.patch(`/groups/${groupId}/grocery/distributions/${distributionId}/status`, { status }),

  // Distribution Items
  updateItemStatus: (itemId: string, status: string, note?: string) =>
    api.patch(`/grocery/distribution-items/${itemId}/status`, { status, note }),
  confirmItem: (itemId: string, idempotencyKey?: string, note?: string) =>
    api.post(`/grocery/distribution-items/${itemId}/confirm`, { idempotencyKey, note }),

  // Member endpoints
  getMyGroceryGroups: () => api.get('/me/grocery/groups'),
  getMyAllocations: (groupId: string) => api.get(`/me/grocery/groups/${groupId}/allocations`),
  getMyHistory: (groupId: string) => api.get(`/me/grocery/groups/${groupId}/history`),
  getMemberSummary: (groupId: string, memberId: string) =>
    api.get(`/groups/${groupId}/grocery/member/${memberId}/summary`),
};
