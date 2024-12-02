import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { formatIlsPrice } from '../../utils/priceUtils';

function PriceHistoryTab({ priceHistory = [] }) {
  const chartData = useMemo(() => {
    return priceHistory.map(record => ({
      date: new Date(record.date).toLocaleDateString(),
      price: record.retailPrice,
      stock: record.qtyInStock,
      soldThisYear: record.soldThisYear,
      soldLastYear: record.soldLastYear
    })).reverse();
  }, [priceHistory]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Paper sx={{ p: 1.5, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle2">{label}</Typography>
          {payload.map((entry, index) => (
            <Typography
              key={index}
              variant="body2"
              sx={{ color: entry.color }}
            >
              {entry.name}: {entry.name === 'Price' ? formatIlsPrice(entry.value) : entry.value}
            </Typography>
          ))}
        </Paper>
      );
    }
    return null;
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={3}>
        {/* Price Chart */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle1" gutterBottom>Price Trends</Typography>
          <Box sx={{ height: 300, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  yAxisId="price"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `₪${value}`}
                />
                <YAxis 
                  yAxisId="stock"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="price"
                  stroke="#2196f3"
                  name="Price"
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="stock"
                  type="monotone"
                  dataKey="stock"
                  stroke="#4caf50"
                  name="Stock"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Sales Chart */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle1" gutterBottom>Sales History</Typography>
          <Box sx={{ height: 300, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="soldThisYear"
                  stroke="#ff9800"
                  name="Sales This Year"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="soldLastYear"
                  stroke="#f44336"
                  name="Sales Last Year"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Detailed History Table */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
          <Typography variant="subtitle1" gutterBottom>Price History Details</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Stock</TableCell>
                  <TableCell align="right">Sales This Year</TableCell>
                  <TableCell align="right">Sales Last Year</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {priceHistory.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {new Date(record.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      {formatIlsPrice(record.retailPrice)}
                    </TableCell>
                    <TableCell align="right">
                      {record.qtyInStock}
                    </TableCell>
                    <TableCell align="right">
                      {record.soldThisYear}
                    </TableCell>
                    <TableCell align="right">
                      {record.soldLastYear}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
    </Box>
  );
}

export default PriceHistoryTab;
