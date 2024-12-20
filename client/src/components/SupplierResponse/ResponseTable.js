import React, { memo } from 'react';
import PropTypes from 'prop-types';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Typography,
  Tooltip,
  IconButton,
  Chip,
  Box,
  Alert
} from '@mui/material';
import {
  Delete as DeleteIcon,
  SwapHoriz as SwapHorizIcon,
  ArrowForward as ArrowForwardIcon,
  PriceChange as PriceChangeIcon,
  InfoOutlined as InfoIcon
} from '@mui/icons-material';

const ResponseTable = memo(({ items = [], onDelete }) => {
  if (!Array.isArray(items)) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Invalid data format received
      </Alert>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ 
        py: 4, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 1
      }}>
        <InfoIcon color="action" sx={{ fontSize: 40 }} />
        <Typography color="text.secondary">
          No items to display
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Item ID</TableCell>
            <TableCell>Hebrew Description</TableCell>
            <TableCell>English Description</TableCell>
            <TableCell align="right">Price</TableCell>
            <TableCell align="right">Status</TableCell>
            <TableCell align="right">Type</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const isReference = item.itemType === 'replacement';
            const itemKey = item.itemKey || `${item.itemId}-${item.responseId}`;
            
            return (
              <TableRow key={itemKey}>
                <TableCell>
                  {isReference ? (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography>{item.itemId}</Typography>
                      <Tooltip title="Reference Change" arrow>
                        <ArrowForwardIcon color="info" fontSize="small" />
                      </Tooltip>
                      <Typography color="primary">
                        {item.newReferenceID}
                      </Typography>
                    </Stack>
                  ) : (
                    item.itemId
                  )}
                </TableCell>
                <TableCell>{item.hebrewDescription}</TableCell>
                <TableCell>{item.englishDescription}</TableCell>
                <TableCell align="right">
                  {item.priceQuoted ? `€${item.priceQuoted}` : '-'}
                </TableCell>
                <TableCell align="right">
                  <Chip
                    label={item.status || 'Pending'}
                    size="small"
                    color={item.status === 'Reference Changed' ? 'info' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right">
                  {isReference ? (
                    <Chip
                      icon={<SwapHorizIcon />}
                      label="Reference"
                      size="small"
                      color="info"
                      variant="outlined"
                      sx={{ minWidth: '110px' }}
                    />
                  ) : (
                    <Chip
                      icon={<PriceChangeIcon />}
                      label="Response"
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ minWidth: '110px' }}
                    />
                  )}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title={`Delete ${isReference ? 'reference' : 'response'}`} arrow>
                    <IconButton
                      size="small"
                      onClick={(e) => onDelete(e, item, isReference ? 'reference' : 'response')}
                      sx={{ 
                        '&:hover': { 
                          backgroundColor: 'rgba(211, 47, 47, 0.1)',
                          color: 'error.main',
                        },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
});

ResponseTable.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    itemId: PropTypes.string.isRequired,
    itemKey: PropTypes.string,
    responseId: PropTypes.string,
    hebrewDescription: PropTypes.string,
    englishDescription: PropTypes.string,
    priceQuoted: PropTypes.number,
    status: PropTypes.string,
    itemType: PropTypes.string,
    newReferenceID: PropTypes.string
  })),
  onDelete: PropTypes.func.isRequired
};

ResponseTable.displayName = 'ResponseTable';

export default ResponseTable;
