import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Compare as CompareIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

function ComparisonList() {
  const navigate = useNavigate();
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState('customNumber');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    fetchComparisons();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedComparisons = [...comparisons].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    if (sortField === 'date') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    } else if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue === bValue) return 0;
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />;
  };

  const fetchComparisons = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/inquiries?status=in_comparison`);
      setComparisons(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching comparisons:', err);
      setError('Failed to load comparisons. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartComparison = (inquiryId) => {
    if (inquiryId) {
      navigate(`/comparisons/${inquiryId}`);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Comparisons
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell 
                onClick={() => handleSort('customNumber')}
                sx={{ cursor: 'pointer' }}
              >
                Inquiry Number <SortIcon field="customNumber" />
              </TableCell>
              <TableCell 
                onClick={() => handleSort('date')}
                sx={{ cursor: 'pointer' }}
              >
                Date <SortIcon field="date" />
              </TableCell>
              <TableCell 
                align="right"
                onClick={() => handleSort('itemCount')}
                sx={{ cursor: 'pointer' }}
              >
                Items <SortIcon field="itemCount" />
              </TableCell>
              <TableCell 
                align="right"
                onClick={() => handleSort('supplierCount')}
                sx={{ cursor: 'pointer' }}
              >
                Suppliers <SortIcon field="supplierCount" />
              </TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedComparisons.length === 0 ? (
              <TableRow key="no-comparisons">
                <TableCell colSpan={5} align="center">
                  No comparisons in progress
                </TableCell>
              </TableRow>
            ) : (
              sortedComparisons.map((comparison) => (
                <TableRow key={comparison.inquiry_id}>
                  <TableCell>{comparison.inquiry_number}</TableCell>
                  <TableCell>{new Date(comparison.date).toLocaleString()}</TableCell>
                  <TableCell align="right">{comparison.item_count}</TableCell>
                  <TableCell align="right">{comparison.responded_suppliers_count || 0}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Start Comparison">
                      <IconButton 
                        size="small"
                        onClick={() => handleStartComparison(comparison.inquiry_id)}
                        color="primary"
                      >
                        <CompareIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default ComparisonList;
