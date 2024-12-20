const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Create realistic sample data
const data = [
  {
    'Item ID': 'BRK001',
    'Hebrew Description': 'רפידות בלם קדמי',
    'English Description': 'Front Brake Pads',
    'Import Markup': 1.30,
    'HS Code': '8708302100',
    'Current Stock': 45,
    'Sold This Year': 120,
    'Sold Last Year': 98,
    'Retail Price': 249.99,
    'Requested Quantity': 30,
    'New Reference ID': 'BRK001-NEW',
    'Reference Notes': 'Updated version with improved material'
  },
  {
    'Item ID': 'FLT002',
    'Hebrew Description': 'מסנן שמן',
    'English Description': 'Oil Filter',
    'Import Markup': 1.25,
    'HS Code': '8421230000',
    'Current Stock': 78,
    'Sold This Year': 245,
    'Sold Last Year': 212,
    'Retail Price': 49.99,
    'Requested Quantity': 100,
    'New Reference ID': '',
    'Reference Notes': ''
  },
  {
    'Item ID': 'BAT003',
    'Hebrew Description': 'מצבר 60 אמפר',
    'English Description': '60Ah Battery',
    'Import Markup': 1.35,
    'HS Code': '8507100000',
    'Current Stock': 15,
    'Sold This Year': 89,
    'Sold Last Year': 76,
    'Retail Price': 599.99,
    'Requested Quantity': 20,
    'New Reference ID': 'BAT003-PLUS',
    'Reference Notes': 'Upgraded to higher capacity battery'
  },
  {
    'Item ID': 'SPK004',
    'Hebrew Description': 'מצתים',
    'English Description': 'Spark Plugs Set',
    'Import Markup': 1.28,
    'HS Code': '8511100000',
    'Current Stock': 120,
    'Sold This Year': 320,
    'Sold Last Year': 280,
    'Retail Price': 129.99,
    'Requested Quantity': 50,
    'New Reference ID': '',
    'Reference Notes': ''
  },
  {
    'Item ID': 'BLT005',
    'Hebrew Description': 'חגורת תזמון',
    'English Description': 'Timing Belt',
    'Import Markup': 1.32,
    'HS Code': '8409910000',
    'Current Stock': 25,
    'Sold This Year': 65,
    'Sold Last Year': 58,
    'Retail Price': 179.99,
    'Requested Quantity': 15,
    'New Reference ID': '',
    'Reference Notes': ''
  }
];

function createSampleFile() {
  // Create workbook and worksheet
  const workbook = xlsx.utils.book_new();

  // Convert data to worksheet format
  const ws_data = [
    // Header row
    ['Item ID', 'Hebrew Description', 'English Description', 'Import Markup', 'HS Code', 
     'Current Stock', 'Sold This Year', 'Sold Last Year', 'Retail Price', 'Requested Quantity', 
     'New Reference ID', 'Reference Notes'],
    // Data rows
    ...data.map(row => [
      row['Item ID'],
      row['Hebrew Description'],
      row['English Description'],
      row['Import Markup'],
      row['HS Code'],
      row['Current Stock'],
      row['Sold This Year'],
      row['Sold Last Year'],
      row['Retail Price'],
      row['Requested Quantity'],
      row['New Reference ID'],
      row['Reference Notes']
    ])
  ];

  const worksheet = xlsx.utils.aoa_to_sheet(ws_data);

  // Set column widths for better readability
  const colWidths = [
    { wch: 10 },  // Item ID
    { wch: 20 },  // Hebrew Description
    { wch: 20 },  // English Description
    { wch: 12 },  // Import Markup
    { wch: 12 },  // HS Code
    { wch: 12 },  // Current Stock
    { wch: 12 },  // Sold This Year
    { wch: 12 },  // Sold Last Year
    { wch: 12 },  // Retail Price
    { wch: 15 },  // Requested Quantity
    { wch: 15 },  // New Reference ID
    { wch: 30 }   // Reference Notes
  ];

  worksheet['!cols'] = colWidths;

  // Add worksheet to workbook with UTF-8 encoding for Hebrew support
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Sample Data');

  // Generate unique filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `sample_inventory_${timestamp}.xlsx`;
  const filepath = path.join(__dirname, filename);

  try {
    // Write file with UTF-8 encoding
    xlsx.writeFile(workbook, filepath, {
      type: 'buffer',
      codepage: 65001, // UTF-8 encoding for Hebrew support
      bookType: 'xlsx'
    });

    console.log(`Sample Excel file created successfully as: ${filename}`);
    console.log('You can rename this file to sample_inventory.xlsx after closing Excel');
    return filename;
  } catch (error) {
    console.error('Error creating sample file:', error);
    return null;
  }
}

// Execute this script to create a new sample file
if (require.main === module) {
  try {
    console.log('Creating sample Excel file...');
    const filename = createSampleFile();
    if (filename) {
      console.log('Done!');
    } else {
      console.error('Failed to create sample file');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

module.exports = { createSampleFile };
