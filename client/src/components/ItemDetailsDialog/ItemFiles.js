import React from 'react';
import {
    Box,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Typography,
    Tooltip,
    LinearProgress,
} from '@mui/material';
import {
    InsertDriveFile as FileIcon,
    Download as DownloadIcon,
    Delete as DeleteIcon,
    Description as DocIcon,
    Image as ImageIcon,
    PictureAsPdf as PdfIcon,
    TableChart as SpreadsheetIcon,
} from '@mui/icons-material';

function getFileIcon(fileType) {
    if (fileType?.includes('image')) return ImageIcon;
    if (fileType?.includes('pdf')) return PdfIcon;
    if (fileType?.includes('spreadsheet') || fileType?.includes('excel')) return SpreadsheetIcon;
    if (fileType?.includes('document') || fileType?.includes('text')) return DocIcon;
    return FileIcon;
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default function ItemFiles({ files, onDownload, onDelete, uploadProgress }) {
    return (
        <Box>
            {uploadProgress > 0 && (
                <Box sx={{ width: '100%', mb: 2 }}>
                    <LinearProgress variant="determinate" value={uploadProgress} />
                    <Typography variant="caption" color="text.secondary">
                        Uploading: {uploadProgress}%
                    </Typography>
                </Box>
            )}
            
            {files.length > 0 ? (
                <List dense>
                    {files.map((file) => {
                        const FileIconComponent = getFileIcon(file.file_type);
                        
                        return (
                            <ListItem
                                key={file.id}
                                sx={{
                                    bgcolor: 'background.paper',
                                    mb: 0.5,
                                    borderRadius: 1,
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                    },
                                }}
                            >
                                <ListItemIcon>
                                    <FileIconComponent color="primary" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={file.description || file.file_path}
                                    secondary={
                                        <Typography variant="caption" color="text.secondary">
                                            {formatDate(file.upload_date)}
                                        </Typography>
                                    }
                                />
                                <ListItemSecondaryAction>
                                    <Tooltip title="Download">
                                        <IconButton
                                            edge="end"
                                            onClick={() => onDownload(file.id, file.description || file.file_path)}
                                            size="small"
                                        >
                                            <DownloadIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            edge="end"
                                            onClick={() => onDelete(file.id)}
                                            size="small"
                                            sx={{ ml: 1 }}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </ListItemSecondaryAction>
                            </ListItem>
                        );
                    })}
                </List>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No files attached
                </Typography>
            )}
        </Box>
    );
}
