export interface ApiResponse<T> {
  status: 'SUCCESS' | 'ERROR';
  data: T;
  error?: ErrorDetail;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: Record<string, string>;
  traceId?: string;
}

export interface PaginationMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
