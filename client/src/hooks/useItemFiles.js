import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export function useItemFiles(itemId) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        if (!itemId) return;
        loadFiles();
    }, [itemId]);

    const loadFiles = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/items/${itemId}/files`);
            setFiles(response.data);
        } catch (err) {
            console.error('Error loading files:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const uploadFiles = async (files) => {
        setError(null);
        setUploadProgress(0);
        
        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('files', file);
        });

        try {
            await axios.post(
                `${API_BASE_URL}/api/items/${itemId}/files`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                    onUploadProgress: (progressEvent) => {
                        const progress = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        setUploadProgress(progress);
                    }
                }
            );

            // Reload files after successful upload
            await loadFiles();
            setUploadProgress(0);
            return true;
        } catch (err) {
            console.error('Error uploading files:', err);
            setError(err.message);
            setUploadProgress(0);
            return false;
        }
    };

    const deleteFile = async (fileId) => {
        setError(null);
        try {
            await axios.delete(`${API_BASE_URL}/api/items/${itemId}/files/${fileId}`);
            // Reload files after successful deletion
            await loadFiles();
            return true;
        } catch (err) {
            console.error('Error deleting file:', err);
            setError(err.message);
            return false;
        }
    };

    const downloadFile = async (fileId, fileName) => {
        setError(null);
        try {
            const response = await axios.get(
                `${API_BASE_URL}/api/items/${itemId}/files/${fileId}/download`,
                { responseType: 'blob' }
            );

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            
            // Append to html link element page
            document.body.appendChild(link);
            
            // Start download
            link.click();
            
            // Clean up and remove the link
            link.parentNode.removeChild(link);
            return true;
        } catch (err) {
            console.error('Error downloading file:', err);
            setError(err.message);
            return false;
        }
    };

    return {
        files,
        loading,
        error,
        uploadProgress,
        uploadFiles,
        deleteFile,
        downloadFile,
        refresh: loadFiles
    };
}
