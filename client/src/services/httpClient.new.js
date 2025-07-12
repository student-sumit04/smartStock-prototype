/**
 * HTTP Client Service
 *
 * This module provides a centralized HTTP client with interceptors,
 * error handling, and authentication.
 *
 * @module httpClient
 */

import axios from 'axios';
import { API_CONFIG, AUTH_CONSTANTS, ERROR_MESSAGES } from '../constants';
import { getStorageItem, removeStorageItem } from '../utils/storage';

// Create axios instance with default configuration
const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // Only use env variable
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add authentication token
httpClient.interceptors.request.use(
  (config) => {
    const token = getStorageItem('token') || localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request timestamp for debugging
    config.metadata = { startTime: new Date() };

    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  },
);

// Response interceptor to handle common responses and errors
httpClient.interceptors.response.use(
  (response) => {
    // Log request duration in development
    if (process.env.NODE_ENV === 'development') {
      const duration = new Date() - response.config.metadata.startTime;
      console.log(`API Request: ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
    }

    return response;
  },
  async (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      handleAuthError();
    }

    // Handle network errors
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timeout. Please try again.';
    } else if (error.code === 'ERR_NETWORK') {
      error.message = 'Network error. Please check your connection.';
    }

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }

    return Promise.reject(error);
  },
);

/**
 * Handle authentication errors by clearing tokens and redirecting
 */
const handleAuthError = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  // Redirect to login page
  window.location.href = '/login';
};

/**
 * Generic request function with retry logic
 * @param {Function} requestFn - The request function to execute
 * @param {number} [maxRetries=3] - Maximum number of retries
 * @returns {Promise} The request promise
 */
export const withRetry = async (requestFn, maxRetries = 3) => {
  let lastError;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const result = await requestFn();
      return result;
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (client errors)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        break;
      }

      // Don't retry on the last attempt
      if (i === maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, i), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Upload file with progress tracking
 * @param {string} url - The upload URL
 * @param {FormData} formData - The form data with file
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise} The upload promise
 */
export const uploadFile = (url, formData, onProgress) => {
  return httpClient.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );
        onProgress(percentCompleted);
      }
    },
  });
};

/**
 * Download file with proper headers
 * @param {string} url - The download URL
 * @param {string} filename - The filename for download
 * @returns {Promise} The download promise
 */
export const downloadFile = async (url, filename) => {
  const response = await httpClient.get(url, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data]);
  const downloadUrl = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(downloadUrl);
};

export default httpClient;
