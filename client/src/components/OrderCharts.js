import React from 'react';
import { Box, Paper } from '@mui/material';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, Title);

// Generate colors for chart segments
const generateColors = (count) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // Use golden angle approximation for better distribution
    colors.push(`hsl(${hue}, 70%, 60%)`);
  }
  return colors;
};

const OrderCharts = ({ supplierGroups, selectedSuppliers, calculateSupplierSummary, quantities, temporaryPrices }) => {
  // Filter and process data for selected suppliers
  const selectedSupplierData = Object.entries(supplierGroups)
    .filter(([key]) => selectedSuppliers[key])
    .map(([key, group]) => {
      const summary = calculateSupplierSummary(group, quantities, temporaryPrices);
      return {
        name: group.isPromotion ? `${group.supplierName} (${group.promotionName})` : group.supplierName,
        itemCount: summary.winningItems,
        totalValue: summary.totalValue
      };
    })
    .filter(data => data.itemCount > 0);

  // Generate colors for the charts
  const colors = generateColors(selectedSupplierData.length);

  // Prepare data for items distribution chart
  const itemsChartData = {
    labels: selectedSupplierData.map(d => d.name),
    datasets: [{
      data: selectedSupplierData.map(d => d.itemCount),
      backgroundColor: colors,
      borderColor: colors.map(c => c.replace('60%', '50%')),
      borderWidth: 1
    }]
  };

  // Prepare data for value distribution chart
  const valueChartData = {
    labels: selectedSupplierData.map(d => d.name),
    datasets: [{
      data: selectedSupplierData.map(d => d.totalValue),
      backgroundColor: colors,
      borderColor: colors.map(c => c.replace('60%', '50%')),
      borderWidth: 1
    }]
  };

  // Common chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 15,
          padding: 15,
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const dataset = context.dataset;
            const value = dataset.data[context.dataIndex];
            const label = context.label;
            const total = dataset.data.reduce((acc, val) => acc + val, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            
            if (dataset === valueChartData.datasets[0]) {
              return `${label}: €${value.toFixed(2)} (${percentage}%)`;
            }
            return `${label}: ${value} items (${percentage}%)`;
          }
        }
      }
    }
  };

  if (selectedSupplierData.length === 0) {
    return null;
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      gap: 2, 
      mt: 2,
      height: '300px'
    }}>
      <Paper sx={{ flex: 1, p: 2 }}>
        <Pie data={itemsChartData} options={{
          ...options,
          plugins: {
            ...options.plugins,
            title: {
              display: true,
              text: 'Items Distribution',
              font: {
                size: 14,
                weight: 'bold'
              }
            }
          }
        }} />
      </Paper>
      <Paper sx={{ flex: 1, p: 2 }}>
        <Pie data={valueChartData} options={{
          ...options,
          plugins: {
            ...options.plugins,
            title: {
              display: true,
              text: 'Value Distribution',
              font: {
                size: 14,
                weight: 'bold'
              }
            }
          }
        }} />
      </Paper>
    </Box>
  );
};

export default OrderCharts;
