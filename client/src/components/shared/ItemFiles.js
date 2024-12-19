import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondary,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

function ItemFiles({ files, onDownload, onDelete, uploadProgress }) {
  if (!files?.length && !uploadProgress) {
    return (
      <Typography variant="body2" color="text.secondary">
        No files attached
      </Typography>
    );
  }

  return (
    <List dense>
      {files?.map((file) => (
        <ListItem
          key={file.id}
          secondaryAction={
            <Box>
              <IconButton 
                edge="end" 
                aria-label="download"
                onClick={() => onDownload(file)}
                sx={{ mr: 1 }}
              >
                <DownloadIcon />
              </IconButton>
              <IconButton 
                edge="end" 
                aria-label="delete"
                onClick={() => onDelete(file.id)}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          }
        >
          <ListItemText
            primary={file.description || file.file_path}
            secondary={new Date(file.upload_date).toLocaleDateString()}
          />
        </ListItem>
      ))}
      {uploadProgress > 0 && (
        <ListItem>
          <Box sx={{ width: '100%' }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        </ListItem>
      )}
    </List>
  );
}

export default ItemFiles;
