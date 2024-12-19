import axios from 'axios';
import { API_BASE_URL } from '../config';
import { dataDebug } from './debug';

// Create axios instance with default config
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Accept': 'application/json'
    },
    validateStatus: status => {
        return status >= 200 && status < 300; // Default success status validation
    }
});

// Add request interceptor
axiosInstance.interceptors.request.use(
    (config) => {
        // Ensure credentials are included
        config.withCredentials = true;
        
        // Log request data
        dataDebug.log('Making request:', {
            url: config.url,
            method: config.method,
            data: config.data
        });

        // If sending FormData, let the browser set the Content-Type
        if (config.data instanceof FormData) {
            dataDebug.log('FormData detected, removing Content-Type header');
            delete config.headers['Content-Type'];
            
            // Log FormData contents
            dataDebug.log('FormData contents:');
            for (let [key, value] of config.data.entries()) {
                dataDebug.log(`  ${key}:`, value);
            }
        } else {
            // For JSON requests, set the Content-Type
            config.headers['Content-Type'] = 'application/json';
        }
        
        return config;
    },
    (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    }
);

// Add response interceptor
axiosInstance.interceptors.response.use(
    (response) => {
        // Log successful response
        dataDebug.log('Received response:', {
            url: response.config.url,
            status: response.status,
            data: response.data
        });
        return response;
    },
    (error) => {
        // Handle response errors here
        if (error.response) {
            // Server responded with error status
            dataDebug.error('Response error:', {
                url: error.config.url,
                status: error.response.status,
                data: error.response.data
            });
            if (error.response.status === 401) {
                // Handle unauthorized
                console.error('Unauthorized access');
            }
        } else if (error.request) {
            // Request was made but no response received
            dataDebug.error('Request error:', error.request);
        } else {
            // Something else happened
            dataDebug.error('Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
