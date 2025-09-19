import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Check if we're in development mode using Vite's environment variables
const isDevelopment = import.meta.env.DEV;

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  },
  withCredentials: true, // Important for cookies, authorization headers with CORS
  timeout: 10000, // 10 seconds
});

// Request interceptor for adding auth token if needed
apiClient.interceptors.request.use(
  (config) => {
    if (isDevelopment) {
      console.group('API Request');
      console.log('URL:', config.url);
      console.log('Method:', config.method?.toUpperCase());
      console.log('Headers:', config.headers);
      console.log('Data:', config.data);
      console.groupEnd();
    }
    
    // Add any auth token here if needed
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => {
    if (isDevelopment) {
      console.group('API Response');
      console.log('URL:', response.config.url);
      console.log('Status:', response.status);
      console.log('Headers:', response.headers);
      console.log('Data:', response.data);
      console.groupEnd();
    }
    return response;
  },
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error('API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
          headers: error.config?.headers
        }
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Request Error:', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
          headers: error.config?.headers
        }
      });
    } else {
      // Something happened in setting up the request
      console.error('API Setup Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Keep track of the health check interval
let healthCheckInterval: NodeJS.Timeout | null = null;

// Health check function with increased timeout
export const checkHealth = async (): Promise<{ status: string; timestamp: string; service: string }> => {
  try {
    const response = await apiClient.get('/api/health', {
      timeout: 5000, // Shorter timeout for health check
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    return response.data;
  } catch (error) {
    // Don't throw error, just return a status indicating the backend might be sleeping
    return {
      status: 'unavailable',
      timestamp: new Date().toISOString(),
      service: 'accounting-helper-api'
    };
  }
};

// Start health checks
export const startHealthChecks = (onStatusChange?: (status: string) => void) => {
  // Clear any existing interval
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // Initial check
  checkHealth().then(health => {
    onStatusChange?.(health.status);
  });

  // Set up periodic checking
  const checkAndUpdateStatus = async () => {
    const health = await checkHealth();
    const isBackendReady = health.status === 'ok';
    onStatusChange?.(health.status);
    
    // If backend is not ready, set a faster interval (5 seconds)
    if (!isBackendReady && healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = setInterval(checkAndUpdateStatus, 5000); // 5 seconds
    }
    // If backend becomes ready, switch to slower interval (5 minutes)
    else if (isBackendReady && healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = setInterval(checkAndUpdateStatus, 5 * 60 * 1000); // 5 minutes
    }
  };
  
  // Initial interval setup (check more frequently by default)
  healthCheckInterval = setInterval(checkAndUpdateStatus, 5000); // Start with 5 seconds

  // Return cleanup function
  return () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
  };
};

// API functions
export const downloadTemplate = async (): Promise<void> => {
  try {
    // Create a new axios instance without the baseURL to handle absolute URLs
    const downloadClient = axios.create({
      withCredentials: true,
      responseType: 'blob',
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    const response = await downloadClient.get(
      `${API_BASE_URL}/api/template`,
      {
        responseType: 'blob',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      }
    );

    // Create a URL for the blob
    const url = window.URL.createObjectURL(new Blob([response.data]));
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = url;
    
    // Get the filename from the content disposition header or use a default
    const contentDisposition = response.headers['content-disposition'];
    let filename = `accounting_template_${new Date().toISOString().slice(0, 10)}.xlsx`;
    
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    
    // Set the download attribute and filename
    link.setAttribute('download', filename);
    
    // Append to body, trigger download, and clean up
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 100);
    
  } catch (error) {
    console.error('Error downloading template:', error);
    throw error;
  }
};

export const uploadFile = async (file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await apiClient.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

export const saveTransactions = async (data: any): Promise<void> => {
  try {
    console.log('Saving transactions:', JSON.stringify(data, null, 2));
    
    const response = await apiClient.post('/api/save', data, {
      responseType: 'blob', // Important for file download
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Create a download link and trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const contentDisposition = response.headers['content-disposition'];
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1].replace(/"/g, '')
      : 'transactions.xlsx';
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    window.URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error saving transactions:', error);
    throw error;
  }
};
