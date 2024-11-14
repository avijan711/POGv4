# Inventory Management System

A comprehensive system for managing inventory items, handling inquiries, and tracking reference changes.

## Features

### 1. Inventory Management
- View and manage inventory items
- Track stock levels, sales history, and retail prices
- Support for both Hebrew and English descriptions
- Import markup and HS code tracking

### 2. Inquiry System
- Create and manage inquiries
- Upload Excel files with item details
- Track requested quantities
- View inquiry history and status

### 3. Reference Change Management
- Track item replacements and updates
- Two types of reference changes:
  - User changes (via Excel upload)
  - Supplier changes (via supplier responses)
- Visual indicators:
  - Orange background for items being replaced
  - Green background for new reference items
- Clear source attribution for changes

## File Upload Format

### Required Excel Columns
- `Item ID`: Unique identifier for each item
- `Hebrew Description`: Item description in Hebrew
- `Requested Quantity`: Number of items being requested

### Optional Columns
- `English Description`: Item description in English
- `Import Markup`: Value between 1.00 and 2.00 (e.g., 1.30 for 30% markup)
- `HS Code`: Harmonized System code
- `Current Stock`: Current inventory level
- `Sold This Year`: Sales for current year
- `Sold Last Year`: Sales for previous year
- `Retail Price`: Price in ILS
- `New Reference ID`: ID of the item that replaces this item
- `Reference Notes`: Additional information about the reference change

## Reference Changes

### Types of Changes

1. User Changes (Excel Upload)
- Source shows as "Changed by user"
- Created when uploading Excel files with reference changes
- New reference items are automatically created if they don't exist

2. Supplier Changes (Future Feature)
- Will show as "Changed by supplier X" (where X is supplier name)
- Will be created through supplier response system

### Visual Indicators

- Items being replaced:
  - Orange background
  - Arrow (→) pointing to new reference
  - Shows change source

- New reference items:
  - Green background
  - Arrow (←) pointing back to original item
  - Shows change source

## Setup

### Prerequisites
- Node.js
- SQLite

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd inventory-management
```

2. Install dependencies:
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. Set up the database:
```bash
cd ../server
npm run setup-db
```

4. Configure environment variables:
- Create `.env` file in server directory
- Set required variables (see `.env.example`)

### Running the Application

1. Start the server:
```bash
cd server
npm start
```

2. Start the client:
```bash
cd client
npm start
```

The application will be available at `http://localhost:3000`

## Usage

### Managing Inventory

1. View inventory:
- Navigate to "Inventory" section
- Use search to filter items
- Click items for detailed view

2. Add/Edit items:
- Use "Add Item" button for new items
- Click edit icon on existing items

### Creating Inquiries

1. Upload Excel file:
- Navigate to "File Upload" section
- Select Excel file with required columns
- Enter inquiry number
- Submit upload

2. View inquiries:
- Navigate to "Inquiries" section
- Click on inquiry for detailed view
- View reference changes and item details

### Reference Changes

1. Via Excel Upload:
- Include "New Reference ID" in Excel file
- Add optional "Reference Notes"
- System will:
  - Create new items if needed
  - Establish reference relationship
  - Mark as "Changed by user"

2. Future: Via Supplier Response
- Will handle supplier-initiated changes
- Will track supplier information
- Will mark as "Changed by supplier X"

## Support

For issues or questions:
1. Check existing issues in GitHub repository
2. Create new issue with detailed description
3. Include relevant error messages and steps to reproduce

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Create pull request with description of changes

## License

[License information]
