import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SupplierResponseList from './SupplierResponseList';

describe('SupplierResponseList Dialog Interactions', () => {
  const mockResponses = [
    {
      id: 1,
      supplier: {
        name: 'Test Supplier',
        contact_name: 'John Doe',
        email: 'john@test.com'
      },
      status: 'pending',
      total_items: 10,
      covered_items: 7,
      missing_items: 3,
      covered_items_data: [
        {
          inquiry_item_id: 1,
          item_id: 'ITEM1',
          hebrew_description: 'Test Item 1',
          english_description: 'Test Item 1 EN',
          requested_qty: 5,
          supplier_price: 100,
          updated_at: '2023-01-01'
        }
      ],
      missing_items_data: [
        {
          inquiry_item_id: 2,
          item_id: 'ITEM2',
          hebrew_description: 'Test Item 2',
          english_description: 'Test Item 2 EN',
          requested_qty: 3,
          updated_at: '2023-01-01'
        }
      ]
    }
  ];

  it('opens covered items dialog when clicking covered button', () => {
    render(<SupplierResponseList responses={mockResponses} />);
    
    const coveredButton = screen.getByText(/Covered \(7\)/);
    fireEvent.click(coveredButton);
    
    expect(screen.getByText('Covered Items - Test Supplier')).toBeInTheDocument();
    expect(screen.getByText('ITEM1')).toBeInTheDocument();
  });

  it('opens missing items dialog when clicking missing button', () => {
    render(<SupplierResponseList responses={mockResponses} />);
    
    const missingButton = screen.getByText(/Missing \(3\)/);
    fireEvent.click(missingButton);
    
    expect(screen.getByText('Missing Items - Test Supplier')).toBeInTheDocument();
    expect(screen.getByText('ITEM2')).toBeInTheDocument();
  });

  it('closes dialogs when clicking close button', () => {
    render(<SupplierResponseList responses={mockResponses} />);
    
    // Open and close covered items dialog
    fireEvent.click(screen.getByText(/Covered \(7\)/));
    expect(screen.getByText('Covered Items - Test Supplier')).toBeInTheDocument();
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(screen.queryByText('Covered Items - Test Supplier')).not.toBeInTheDocument();
  });

  it('disables covered button when no covered items', () => {
    const noItemsResponse = [{
      ...mockResponses[0],
      covered_items: 0,
      covered_items_data: []
    }];
    
    render(<SupplierResponseList responses={noItemsResponse} />);
    
    const coveredButton = screen.getByText(/Covered \(0\)/);
    expect(coveredButton).toBeDisabled();
  });

  it('disables missing button when no missing items', () => {
    const noItemsResponse = [{
      ...mockResponses[0],
      missing_items: 0,
      missing_items_data: []
    }];
    
    render(<SupplierResponseList responses={noItemsResponse} />);
    
    const missingButton = screen.getByText(/Missing \(0\)/);
    expect(missingButton).toBeDisabled();
  });
});