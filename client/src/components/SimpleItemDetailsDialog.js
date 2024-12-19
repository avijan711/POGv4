import React, { useState, useCallback, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Grid,
    Chip,
    Divider,
    Paper,
    Stack,
    IconButton,
    Tooltip,
    Snackbar,
    Alert,
    Popover,
    TextField,
    Tabs,
    Tab,
    useTheme,
} from '@mui/material';
import {
    LocalOffer as LocalOfferIcon,
    Business as BusinessIcon,
    AttachMoney as AttachMoneyIcon,
    Info as InfoIcon,
    Notes as NotesIcon,
    Public as PublicIcon,
    ContentCopy as ContentCopyIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    AttachFile as AttachFileIcon,
    ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useItemFiles } from '../hooks/useItemFiles';
import { useSupplierPrices } from '../hooks/useSupplierPrices';
import ItemFiles from './shared/ItemFiles';
import PriceHistoryTab from './ItemDetailsDialog/PriceHistoryTab';
import SupplierPricingTile from './shared/SupplierPricingTile';

function TabPanel({ children, value, index, ...other }) {
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`item-tabpanel-${index}`}
            aria-labelledby={`item-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ pt: 2 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

function SimpleItemDetailsDialog({ open, onClose, item, onItemClick }) {
    const theme = useTheme();
    const [showCopySuccess, setShowCopySuccess] = useState(false);
    const [priceHistoryAnchor, setPriceHistoryAnchor] = useState(null);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesContent, setNotesContent] = useState(item?.notes || '');
    const [dragActive, setDragActive] = useState(false);
    const [priceHistory, setPriceHistory] = useState([]);
    const [showUploadSuccess, setShowUploadSuccess] = useState(false);
    const [currentTab, setCurrentTab] = useState(0);

    // Parse reference change if it exists
    let referenceChange = null;
    try {
        referenceChange = item?.reference_change ? 
            (typeof item.reference_change === 'string' ? 
                JSON.parse(item.reference_change) : 
                item.reference_change) : 
            null;
    } catch (e) {
        console.error('Error parsing reference_change:', e);
    }

    const {
        files,
        loading: filesLoading,
        error: filesError,
        uploadProgress,
        uploadFiles,
        deleteFile,
        downloadFile
    } = useItemFiles(item?.item_id);

    const {
        prices: supplierPrices,
        suppliers,
        loading: pricesLoading,
        error: pricesError,
        hasMore: hasMorePrices,
        loadMore: loadMorePrices,
        updateFilters,
        filters
    } = useSupplierPrices(item?.item_id);

    useEffect(() => {
        if (item?.item_id) {
            // Fetch price history
            axios.get(`${API_BASE_URL}/api/items/${item.item_id}/price-history`)
                .then(response => {
                    setPriceHistory(response.data);
                })
                .catch(error => {
                    console.error('Error fetching price history:', error);
                });

            // Reset notes content when item changes
            setNotesContent(item.notes || '');
            setIsEditingNotes(false);
        }
    }, [item?.item_id, item?.notes]);

    if (!item) return null;

    const formatPrice = (price) => {
        if (!price) return '₪0.00';
        return `₪${Number(price).toFixed(2)}`;
    };

    const formatDate = (date) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString();
    };

    const handleCopyItemId = async () => {
        try {
            await navigator.clipboard.writeText(item.item_id);
            setShowCopySuccess(true);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const success = await uploadFiles(files);
            if (success) {
                setShowUploadSuccess(true);
            }
        }
    };

    const handleFileSelect = async (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            const success = await uploadFiles(files);
            if (success) {
                setShowUploadSuccess(true);
            }
        }
    };

    const handleSaveNotes = async () => {
        try {
            await axios.patch(`${API_BASE_URL}/api/items/${item.item_id}`, {
                notes: notesContent
            });
            setIsEditingNotes(false);
        } catch (error) {
            console.error('Error saving notes:', error);
        }
    };

    const SectionTitle = ({ icon: Icon, title, onEdit, canEdit }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Icon color="primary" />
            <Typography variant="subtitle1" fontWeight="bold">
                {title}
            </Typography>
            {canEdit && (
                <IconButton 
                    size="small" 
                    onClick={() => {
                        if (isEditingNotes) {
                            handleSaveNotes();
                        } else {
                            setIsEditingNotes(true);
                        }
                    }} 
                    sx={{ ml: 'auto' }}
                >
                    {isEditingNotes ? <SaveIcon /> : <EditIcon />}
                </IconButton>
            )}
        </Box>
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 2,
                    bgcolor: item?.has_reference_change ? theme.palette.warning.light : 'grey.100',
                    p: 2,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: item?.has_reference_change ? theme.palette.warning.main : 'grey.300'
                }}>
                    {/* Item ID and Copy Button */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h4" component="div" sx={{ 
                            fontWeight: 'bold',
                            color: item?.has_reference_change ? theme.palette.warning.dark : 'primary.main',
                            letterSpacing: '0.5px'
                        }}>
                            {item.item_id}
                        </Typography>
                        <Tooltip title="Copy Item ID">
                            <IconButton onClick={handleCopyItemId} size="small">
                                <ContentCopyIcon />
                            </IconButton>
                        </Tooltip>

                        {/* New Item Link - Show when there's a replacing item */}
                        {referenceChange && (
                            <Button
                                variant="contained"
                                color="warning"
                                startIcon={<ArrowForwardIcon />}
                                onClick={() => onItemClick?.(referenceChange.new_reference_id)}
                                sx={{
                                    ml: 2,
                                    bgcolor: theme.palette.warning.main,
                                    '&:hover': {
                                        bgcolor: theme.palette.warning.dark
                                    }
                                }}
                            >
                                New ID: {referenceChange.new_reference_id}
                            </Button>
                        )}
                    </Box>
                    
                    {/* Hebrew Description */}
                    <Typography variant="h5" sx={{ 
                        color: item?.has_reference_change ? theme.palette.warning.dark : 'text.primary',
                        fontWeight: 500,
                        direction: 'rtl'  // Right-to-left for Hebrew
                    }}>
                        {item.hebrew_description}
                    </Typography>

                    {/* Reference Change Info */}
                    {referenceChange && (
                        <Typography variant="body2" color="warning.dark">
                            This item has been replaced. Please use the new item ID.
                        </Typography>
                    )}
                </Box>
            </DialogTitle>
            <DialogContent>
                <Tabs 
                    value={currentTab} 
                    onChange={(e, newValue) => setCurrentTab(newValue)}
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab label="Basic Info" />
                    <Tab label="Price History" />
                    <Tab label="Supplier Pricing" />
                </Tabs>

                <TabPanel value={currentTab} index={0}>
                    <Grid container spacing={3}>
                        {/* Pricing Section */}
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 2, height: '100%' }}>
                                <SectionTitle icon={AttachMoneyIcon} title="Pricing" />
                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        <Typography variant="body2" color="text.secondary">Current Retail Price</Typography>
                                        <Box 
                                            onClick={(e) => setPriceHistoryAnchor(e.currentTarget)}
                                            sx={{ 
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    bgcolor: 'action.hover',
                                                    borderRadius: 1
                                                },
                                                p: 1
                                            }}
                                        >
                                            <Typography variant="h6" color="primary.main">
                                                {formatPrice(item.retail_price)}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="text.secondary">Import Markup</Typography>
                                        <Typography>{item.import_markup?.toFixed(2) || 'N/A'}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="text.secondary">Last Updated</Typography>
                                        <Typography>{formatDate(item.last_price_update)}</Typography>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>

                        {/* Info Section */}
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 2, height: '100%' }}>
                                <SectionTitle icon={InfoIcon} title="Information" />
                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        <Typography variant="body2" color="text.secondary">English Description</Typography>
                                        <Typography>{item.english_description}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="text.secondary">HS Code</Typography>
                                        <Typography>{item.hs_code || 'N/A'}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="text.secondary">Origin</Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <PublicIcon fontSize="small" color="action" />
                                            <Typography>{item.origin || 'N/A'}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Divider sx={{ my: 1 }} />
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">In Stock</Typography>
                                                <Typography>{item.qty_in_stock || 0}</Typography>
                                            </Box>
                                            <Divider orientation="vertical" flexItem />
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Sold This Year</Typography>
                                                <Typography>{item.sold_this_year || 0}</Typography>
                                            </Box>
                                            <Divider orientation="vertical" flexItem />
                                            <Box>
                                                <Typography variant="body2" color="text.secondary">Sold Last Year</Typography>
                                                <Typography>{item.sold_last_year || 0}</Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>

                        {/* Notes Section */}
                        <Grid item xs={12} md={6}>
                            <Paper 
                                sx={{ 
                                    p: 2, 
                                    height: '100%',
                                    position: 'relative',
                                    ...(dragActive && {
                                        borderColor: 'primary.main',
                                        borderStyle: 'dashed',
                                        bgcolor: 'action.hover'
                                    })
                                }}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                <SectionTitle 
                                    icon={NotesIcon} 
                                    title="Notes" 
                                    canEdit={true}
                                />
                                {isEditingNotes ? (
                                    <Box sx={{ position: 'relative' }}>
                                        <TextField
                                            multiline
                                            fullWidth
                                            minRows={4}
                                            value={notesContent}
                                            onChange={(e) => setNotesContent(e.target.value)}
                                            placeholder="Enter notes here..."
                                            variant="outlined"
                                        />
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="subtitle2" gutterBottom>
                                                Attached Files
                                            </Typography>
                                            <ItemFiles
                                                files={files}
                                                onDownload={downloadFile}
                                                onDelete={deleteFile}
                                                uploadProgress={uploadProgress}
                                            />
                                            <Box 
                                                sx={{ 
                                                    mt: 2,
                                                    p: 2,
                                                    border: '2px dashed',
                                                    borderColor: 'grey.300',
                                                    borderRadius: 1,
                                                    textAlign: 'center',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <input
                                                    type="file"
                                                    multiple
                                                    style={{ display: 'none' }}
                                                    id="file-upload"
                                                    onChange={handleFileSelect}
                                                />
                                                <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
                                                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                                                        <AttachFileIcon color="action" />
                                                        <Typography variant="body2" color="text.secondary">
                                                            Drag & drop files here or click to upload
                                                        </Typography>
                                                    </Stack>
                                                </label>
                                            </Box>
                                        </Box>
                                    </Box>
                                ) : (
                                    <Box>
                                        <Typography sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                                            {notesContent || 'No notes available'}
                                        </Typography>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Attached Files
                                        </Typography>
                                        <ItemFiles
                                            files={files}
                                            onDownload={downloadFile}
                                            onDelete={deleteFile}
                                            uploadProgress={uploadProgress}
                                        />
                                    </Box>
                                )}
                            </Paper>
                        </Grid>

                        {/* Promotions Section */}
                        <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 2, height: '100%' }}>
                                <SectionTitle icon={LocalOfferIcon} title="Promotions" />
                                {item.promotions?.length > 0 ? (
                                    <Stack spacing={2}>
                                        {item.promotions.map((promo, index) => (
                                            <Box key={index}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <Chip
                                                        icon={<LocalOfferIcon />}
                                                        label={formatPrice(promo.price)}
                                                        color="secondary"
                                                        variant="outlined"
                                                    />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {formatDate(promo.start_date)} - {formatDate(promo.end_date)}
                                                    </Typography>
                                                </Box>
                                                {promo.supplier_name && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <BusinessIcon fontSize="small" color="action" />
                                                        <Typography variant="body2">{promo.supplier_name}</Typography>
                                                    </Box>
                                                )}
                                                {index < item.promotions.length - 1 && <Divider sx={{ my: 1 }} />}
                                            </Box>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Typography color="text.secondary" variant="body2">No active promotions</Typography>
                                )}
                            </Paper>
                        </Grid>
                    </Grid>
                </TabPanel>

                <TabPanel value={currentTab} index={1}>
                    <PriceHistoryTab priceHistory={priceHistory} />
                </TabPanel>

                <TabPanel value={currentTab} index={2}>
                    <SupplierPricingTile
                        item={item}
                        supplierPrices={supplierPrices}
                        suppliers={suppliers}
                        onLoadMore={loadMorePrices}
                        hasMore={hasMorePrices}
                        loading={pricesLoading}
                        onUpdateFilters={updateFilters}
                        filters={filters}
                    />
                </TabPanel>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>

            {/* Price History Popover */}
            <Popover
                open={Boolean(priceHistoryAnchor)}
                anchorEl={priceHistoryAnchor}
                onClose={() => setPriceHistoryAnchor(null)}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <Box sx={{ p: 2, maxWidth: 300 }}>
                    <Typography variant="subtitle2" gutterBottom>Price History</Typography>
                    <Stack spacing={1}>
                        {priceHistory.map((record, index) => (
                            <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2">{formatDate(record.date)}</Typography>
                                <Typography variant="body2" color="primary">
                                    {formatPrice(record.ils_retail_price)}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            </Popover>

            {/* Copy Success Snackbar */}
            <Snackbar
                open={showCopySuccess}
                autoHideDuration={2000}
                onClose={() => setShowCopySuccess(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" sx={{ width: '100%' }}>
                    Item ID copied to clipboard
                </Alert>
            </Snackbar>

            {/* Upload Success Snackbar */}
            <Snackbar
                open={showUploadSuccess}
                autoHideDuration={2000}
                onClose={() => setShowUploadSuccess(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" sx={{ width: '100%' }}>
                    Files uploaded successfully
                </Alert>
            </Snackbar>
        </Dialog>
    );
}

export default SimpleItemDetailsDialog;
