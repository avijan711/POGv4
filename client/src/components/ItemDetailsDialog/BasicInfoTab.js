import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Divider,
  Chip,
  IconButton,
  TextField,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  RemoveCircleOutline as NoChangeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { formatIlsPrice } from '../../utils/priceUtils';
import { API_BASE_URL } from '../../config';

function NoteDialog({ open, onClose, onSave, initialNote = '' }) {
  const [note, setNote] = useState(initialNote);

  const handleSave = () => {
    onSave(note);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initialNote ? 'Edit Note' : 'Add Note'}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          multiline
          rows={4}
          fullWidth
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter your note here..."
          variant="outlined"
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button 
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={!note.trim()}
          sx={{ minWidth: 100 }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function BasicInfoTab({ itemDetails, onUpdateNotes }) {
  const [notes, setNotes] = useState(() => {
    try {
      return itemDetails?.notes ? JSON.parse(itemDetails.notes) : [];
    } catch {
      return [];
    }
  });
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  if (!itemDetails) return null;

  const salesTrend = itemDetails.soldThisYear > itemDetails.soldLastYear ? 'up' :
                    itemDetails.soldThisYear < itemDetails.soldLastYear ? 'down' : 'same';

  const getTrendIcon = () => {
    switch(salesTrend) {
      case 'up': return <TrendingUpIcon color="success" />;
      case 'down': return <TrendingDownIcon color="error" />;
      default: return <NoChangeIcon color="action" />;
    }
  };

  const getSalesTrendLabel = () => {
    const diff = itemDetails.soldThisYear - itemDetails.soldLastYear;
    const percentChange = ((diff / itemDetails.soldLastYear) * 100).toFixed(1);
    return diff === 0 ? 'No Change' : 
           `${diff > 0 ? '+' : ''}${percentChange}% vs Last Year`;
  };

  const handleAddNote = () => {
    setEditingNote(null);
    setNoteDialogOpen(true);
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setNoteDialogOpen(true);
  };

  const handleDeleteNote = (noteId) => {
    const updatedNotes = notes.filter(note => note.id !== noteId);
    setNotes(updatedNotes);
    onUpdateNotes(JSON.stringify(updatedNotes));
  };

  const handleSaveNote = (noteText) => {
    let updatedNotes;
    if (editingNote) {
      updatedNotes = notes.map(note => 
        note.id === editingNote.id 
          ? { ...note, text: noteText, lastModified: new Date().toISOString() }
          : note
      );
    } else {
      const newNote = {
        id: Date.now(),
        text: noteText,
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      updatedNotes = [...notes, newNote];
    }
    setNotes(updatedNotes);
    onUpdateNotes(JSON.stringify(updatedNotes));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {/* Left Column - Basic Information */}
        <Grid item xs={6}>
          <Stack spacing={2}>
            <Paper 
              elevation={2}
              sx={{ 
                p: 2,
                bgcolor: 'background.default',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 2
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">Stock Information</Typography>
              <Box sx={{ mt: 1 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Current Stock</Typography>
                    <Typography variant="h6">{itemDetails.qtyInStock}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Status</Typography>
                    <Chip 
                      label={itemDetails.qtyInStock > 0 ? 'In Stock' : 'Out of Stock'}
                      color={itemDetails.qtyInStock > 0 ? 'success' : 'error'}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Paper>

            <Paper 
              elevation={2}
              sx={{ 
                p: 2,
                bgcolor: 'background.default',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 2
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">Sales Information</Typography>
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">This Year</Typography>
                    <Typography variant="h6">{itemDetails.soldThisYear}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Last Year</Typography>
                    <Typography variant="h6">{itemDetails.soldLastYear}</Typography>
                  </Grid>
                </Grid>
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getTrendIcon()}
                  <Typography variant="body2" color="text.secondary">
                    {getSalesTrendLabel()}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {itemDetails.image && (
              <Paper 
                elevation={2}
                sx={{ 
                  p: 2,
                  bgcolor: 'background.default',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 2
                }}
              >
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Product Image
                </Typography>
                <Box
                  component="img"
                  src={`${API_BASE_URL}/uploads/${itemDetails.image}`}
                  alt={itemDetails.itemID}
                  sx={{
                    width: '100%',
                    height: 200,
                    objectFit: 'contain',
                    mt: 1
                  }}
                />
              </Paper>
            )}
          </Stack>
        </Grid>

        {/* Right Column - Pricing and Notes */}
        <Grid item xs={6}>
          <Stack spacing={2}>
            <Paper 
              elevation={2}
              sx={{ 
                p: 2,
                bgcolor: 'background.default',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 2
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">Current Price</Typography>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1 }}>
                <Typography variant="h6">
                  {formatIlsPrice(itemDetails.retailPrice) || 'No Price Set'}
                </Typography>
                {itemDetails.lastPriceUpdate && (
                  <Typography variant="caption" color="text.secondary">
                    Updated: {new Date(itemDetails.lastPriceUpdate).toLocaleDateString()}
                  </Typography>
                )}
              </Stack>
            </Paper>

            <Paper 
              elevation={2}
              sx={{ 
                p: 2,
                bgcolor: 'background.default',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 2
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">Import Markup</Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                {itemDetails.importMarkup.toFixed(2)} ({((itemDetails.importMarkup - 1) * 100).toFixed(0)}%)
              </Typography>
            </Paper>

            <Paper 
              elevation={2}
              sx={{ 
                p: 2,
                bgcolor: 'background.default',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 2,
                minHeight: '200px'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                <Button
                  startIcon={<AddIcon />}
                  variant="contained"
                  size="small"
                  onClick={handleAddNote}
                >
                  Add Note
                </Button>
              </Box>

              {notes.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No notes available
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {notes.map((note) => (
                    <Paper
                      key={note.id}
                      elevation={1}
                      sx={{
                        p: 2,
                        bgcolor: '#f8f9fa',
                        border: '1px solid rgba(0,0,0,0.05)',
                        borderRadius: 1
                      }}
                    >
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                        {note.text}
                      </Typography>
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 1 
                      }}>
                        <Typography variant="caption" color="text.secondary">
                          Last modified: {new Date(note.lastModified).toLocaleDateString()}
                        </Typography>
                        <Box>
                          <IconButton
                            size="small"
                            onClick={() => handleEditNote(note)}
                            sx={{ mr: 1 }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteNote(note.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>
        </Grid>
      </Grid>

      {/* Note Dialog */}
      <NoteDialog
        open={noteDialogOpen}
        onClose={() => {
          setNoteDialogOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
        initialNote={editingNote?.text}
      />
    </Box>
  );
}

export default BasicInfoTab;
