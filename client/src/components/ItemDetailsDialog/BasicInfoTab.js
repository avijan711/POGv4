import React, { useState, useRef, useEffect } from 'react';
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
  DialogActions,
  Link,
  Alert,
  useTheme,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  RemoveCircleOutline as NoChangeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  SwapHoriz as SwapHorizIcon,
  Store as StoreIcon,
  Person as PersonIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { formatIlsPrice } from '../../utils/priceUtils';
import { API_BASE_URL } from '../../config';

function NoteDialog({ open, onClose, onSave, initialNote = '' }) {
  const [note, setNote] = useState(initialNote);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

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
          inputRef={inputRef}
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

function BasicInfoTab({ itemDetails, onUpdateNotes, onItemClick }) {
  const theme = useTheme();
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
    if (!itemDetails.soldThisYear || !itemDetails.soldLastYear) return 'No Data';
    const diff = itemDetails.soldThisYear - itemDetails.soldLastYear;
    if (itemDetails.soldLastYear === 0) return `${itemDetails.soldThisYear > 0 ? '+' : ''}${itemDetails.soldThisYear}`;
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
          : note,
      );
    } else {
      const newNote = {
        id: Date.now(),
        text: noteText,
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      };
      updatedNotes = [...notes, newNote];
    }
    setNotes(updatedNotes);
    onUpdateNotes(JSON.stringify(updatedNotes));
  };

  const getSourceIcon = (source, supplierName) => {
    if (source === 'supplier') {
      return (
        <Tooltip title={`Changed by ${supplierName || 'supplier'}`}>
          <StoreIcon fontSize="small" color="warning" />
        </Tooltip>
      );
    }
    if (source === 'user') {
      return (
        <Tooltip title="Changed by user">
          <PersonIcon fontSize="small" color="warning" />
        </Tooltip>
      );
    }
    return null;
  };

  // Parse reference change if it's a string
  let referenceChange = null;
  try {
    referenceChange = itemDetails.reference_change ? 
      (typeof itemDetails.reference_change === 'string' ? 
        JSON.parse(itemDetails.reference_change) : 
        itemDetails.reference_change) : 
      null;
  } catch (e) {
    console.error('Error parsing reference_change:', e);
  }

  // Get referencing items
  const referencingItems = itemDetails.referencing_items ? 
    (typeof itemDetails.referencing_items === 'string' ? 
      itemDetails.referencing_items.split(',') : 
      itemDetails.referencing_items) : 
    [];

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Replacement Information Section */}
        {(referenceChange || referencingItems.length > 0) && (
          <Paper 
            elevation={3}
            sx={{ 
              p: 3,
              bgcolor: referenceChange ? '#fff3e0' : '#e8f5e9',
              border: '2px solid',
              borderColor: referenceChange ? 'warning.main' : 'success.main',
              borderRadius: 2,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background Pattern */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '30%',
              opacity: 0.1,
              background: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(0,0,0,0.1) 10px,
                rgba(0,0,0,0.1) 20px
              )`,
            }} />

            <Stack spacing={2}>
              {/* Header */}
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 'bold',
                    color: referenceChange ? theme.palette.warning.main : theme.palette.success.main,
                  }}
                >
                  {referenceChange ? 'Item Replacement Information' : 'New Reference Item'}
                </Typography>
                <SwapHorizIcon color={referenceChange ? 'warning' : 'success'} fontSize="large" />
              </Stack>

              {/* Connection Visual */}
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2,
                  bgcolor: 'rgba(255,255,255,0.9)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 2,
                }}
              >
                {referenceChange && (
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                      <Stack spacing={1}>
                        <Typography variant="subtitle2" color="text.secondary">Current Item</Typography>
                        <Box sx={{ 
                          p: 1.5, 
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'warning.light',
                          borderRadius: 1,
                        }}>
                          <Typography variant="h6" color="warning.dark">
                            {itemDetails.item_id}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ direction: 'rtl', mt: 0.5 }}>
                            {itemDetails.hebrew_description}
                          </Typography>
                        </Box>
                      </Stack>

                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ArrowForwardIcon color="warning" sx={{ fontSize: 30 }} />
                      </Box>

                      <Stack spacing={1}>
                        <Typography variant="subtitle2" color="text.secondary">Replaced By</Typography>
                        <Box 
                          component={Button}
                          onClick={() => onItemClick(referenceChange.new_reference_id)}
                          sx={{ 
                            p: 1.5, 
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: 'warning.light',
                            borderRadius: 1,
                            textAlign: 'left',
                            textTransform: 'none',
                            minWidth: 200,
                          }}
                        >
                          <Typography variant="h6" color="warning.dark">
                            {referenceChange.new_reference_id}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ direction: 'rtl', mt: 0.5 }}>
                            {referenceChange.new_description}
                          </Typography>
                        </Box>
                      </Stack>
                    </Stack>

                    <Stack direction="row" spacing={2} alignItems="center">
                      <Chip
                        icon={getSourceIcon(referenceChange.source, referenceChange.supplier_name)}
                        label={referenceChange.source === 'supplier' ? 
                          `Changed by ${referenceChange.supplier_name || 'supplier'}` : 
                          'Changed by user'
                        }
                        color="warning"
                        variant="outlined"
                      />
                      <Typography variant="body2" color="text.secondary">
                        on {new Date(referenceChange.change_date).toLocaleDateString()}
                      </Typography>
                    </Stack>

                    {referenceChange.notes && (
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{
                          mt: 1,
                          p: 1,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          fontStyle: 'italic',
                        }}
                      >
                        {referenceChange.notes}
                      </Typography>
                    )}
                  </Stack>
                )}

                {referencingItems.length > 0 && (
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" color="success.dark" sx={{ fontWeight: 'medium' }}>
                      This is a new reference item that replaces:
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      {referencingItems.map((itemId, index) => (
                        <Button
                          key={itemId}
                          variant="outlined"
                          color="success"
                          onClick={() => onItemClick(itemId)}
                          startIcon={<SwapHorizIcon />}
                          sx={{ textTransform: 'none' }}
                        >
                          {itemId}
                        </Button>
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Paper>
        )}

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
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">Stock Information</Typography>
                <Box sx={{ mt: 1 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Current Stock</Typography>
                      <Typography variant="h6">{itemDetails.qty_in_stock || 0}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Status</Typography>
                      <Chip 
                        label={(itemDetails.qty_in_stock || 0) > 0 ? 'In Stock' : 'Out of Stock'}
                        color={(itemDetails.qty_in_stock || 0) > 0 ? 'success' : 'error'}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Paper>

              {/* Sales Information Paper */}
              <Paper 
                elevation={2}
                sx={{ 
                  p: 2,
                  bgcolor: 'background.default',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">Sales Information</Typography>
                <Box sx={{ mt: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">This Year</Typography>
                      <Typography variant="h6">{itemDetails.sold_this_year || 0}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Last Year</Typography>
                      <Typography variant="h6">{itemDetails.sold_last_year || 0}</Typography>
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
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Product Image
                  </Typography>
                  <Box
                    component="img"
                    src={`${API_BASE_URL}/uploads/${itemDetails.image}`}
                    alt={itemDetails.item_id}
                    sx={{
                      width: '100%',
                      height: 200,
                      objectFit: 'contain',
                      mt: 1,
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
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">Current Price</Typography>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1 }}>
                  <Typography variant="h6">
                    {formatIlsPrice(itemDetails.retail_price) || 'No Price Set'}
                  </Typography>
                  {itemDetails.last_price_update && (
                    <Typography variant="caption" color="text.secondary">
                      Updated: {new Date(itemDetails.last_price_update).toLocaleDateString()}
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
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">Import Markup</Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {itemDetails.import_markup ? (
                    <>
                      {itemDetails.import_markup.toFixed(2)} ({((itemDetails.import_markup - 1) * 100).toFixed(0)}%)
                    </>
                  ) : (
                    'Not Set'
                  )}
                </Typography>
              </Paper>

              <Paper 
                elevation={2}
                sx={{ 
                  p: 2,
                  bgcolor: 'background.default',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 2,
                  minHeight: '200px',
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
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                          {note.text}
                        </Typography>
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mt: 1, 
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
      </Stack>
    </Box>
  );
}

export default BasicInfoTab;
