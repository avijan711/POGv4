import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Typography,
  Stack,
  Chip,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { formatDate } from './utils';
import ResponseTable from './ResponseTable';

const ResponseAccordion = ({
  response,
  onDelete,
  onShowStats,
  isLoading,
}) => {
  const handleShowExtraItems = (e) => {
    e.stopPropagation();
    onShowStats(
      'Extra Items',
      response.items.filter(item => item.itemType === 'promotion'),
      'extra'
    );
  };

  const handleShowMissingItems = (e) => {
    e.stopPropagation();
    const missingItems = response.items.filter(item => !item.priceQuoted);
    onShowStats(
      'Missing Items',
      missingItems,
      'missing'
    );
  };

  const handleShowReplacements = (e) => {
    e.stopPropagation();
    const replacements = response.items.filter(item => item.itemType === 'replacement');
    onShowStats(
      'Replacement Items',
      replacements,
      'replacements'
    );
  };

  const missingItemsCount = response.items.filter(item => !item.priceQuoted).length;
  const extraItemsCount = response.extraItemsCount || 0;
  const replacementsCount = response.replacementsCount || 0;

  return (
    <Accordion 
      sx={{ 
        mb: 1,
        '&:before': {
          display: 'none',
        },
        backgroundColor: '#fff'
      }}
    >
      <AccordionSummary 
        expandIcon={<ExpandMoreIcon />}
        sx={{
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
          },
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          width: '100%',
          pr: 2
        }}>
          <Box>
            <Typography variant="subtitle1">
              {response.supplierName} - {formatDate(response.date)}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              <Typography variant="body2" color="textSecondary">
                {response.itemCount} items
              </Typography>
              
              {missingItemsCount > 0 && (
                <Chip
                  label={`Missing: ${missingItemsCount}`}
                  color="error"
                  size="small"
                  icon={<WarningIcon />}
                  onClick={handleShowMissingItems}
                />
              )}
              
              {!response.isPromotion && (
                <>
                  {extraItemsCount > 0 && (
                    <Chip
                      label={`Extra: ${extraItemsCount}`}
                      color="warning"
                      size="small"
                      onClick={handleShowExtraItems}
                    />
                  )}
                  {replacementsCount > 0 && (
                    <Chip
                      label={`Replacements: ${replacementsCount}`}
                      color="info"
                      size="small"
                      onClick={handleShowReplacements}
                    />
                  )}
                </>
              )}
            </Stack>
          </Box>
          <IconButton 
            size="small"
            onClick={(e) => onDelete(e, response, 'bulk')}
            sx={{ 
              '&:hover': { 
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                color: 'error.main',
              },
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </AccordionSummary>
      <AccordionDetails onClick={(e) => e.stopPropagation()}>
        {isLoading ? (
          <Box sx={{ width: '100%', py: 2 }}>
            <LinearProgress />
          </Box>
        ) : (
          <ResponseTable 
            items={response.items} 
            onDelete={onDelete}
          />
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default ResponseAccordion;
