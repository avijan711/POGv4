import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MissingItemsDialog from './MissingItemsDialog';

describe('MissingItemsDialog', () => {
  const mockItems = [
    {
      inquiry_item_id: 1,
      item_id: 'ITEM1',
      hebrew_description: 'Test Item 1',
      english_description: 'Test Item 1 EN',
      requested_qty: 5,
      updated_at: '2023-01-01'
    },
    {
      inquiry_item_id: 2,
      item_id: 'ITEM2',
      hebrew_description: 'Test Item 2',
      english_description: 'Test Item 2 EN',
      requested_qty: 3,
      updated_at: '2023-01-02'
    }
  ];

  it('displays dialog title with supplier name', () => {
    render(
      <MissingItemsDialog
        open={true}
        items={mockItems}
        supplierName="Test Supplier"
      />
    );
    
    expect(screen.getByText('Missing Items - Test Supplier')).toBeInTheDocument();
  });

  it('displays all item details correctly', () => {
    render(
      <MissingItemsDialog
        open={true}
        items={mockItems}
        supplierName="Test Supplier"
      />
    );
    
    expect(screen.getByText('ITEM1')).toBeInTheDocument();
    expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    expect(screen.getByText('Test Item 1 EN')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    
    expect(screen.getByText('ITEM2')).toBeInTheDocument();
    expect(screen.getByText('Test Item 2')).toBeInTheDocument();
    expect(screen.getByText('Test Item 2 EN')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const mockClose = jest.fn();
    render(
      <MissingItemsDialog
        open={true}
        items={mockItems}
        supplierName="Test Supplier"
        onClose={mockClose}
      />
    );
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(mockClose).toHaveBeenCalled();
  });

  it('shows formatted dates with tooltips', () => {
    render(
      <MissingItemsDialog
        open={true}
        items={mockItems}
        supplierName="Test Supplier"
      />
    );
    
    // Check for formatted dates
    expect(screen.getByText('Jan 1, 2023')).toBeInTheDocument();
    expect(screen.getByText('Jan 2, 2023')).toBeInTheDocument();
    
    // Check tooltips
    const dates = screen.getAllByText(/Jan \d, 2023/);
    dates.forEach(date => {
      fireEvent.mouseOver(date);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  it('handles empty items array', () => {
    render(
      <MissingItemsDialog
        open={true}
        items={[]}
        supplierName="Test Supplier"
      />
    );
    
    // Should still render table headers
    expect(screen.getByText('Item ID')).toBeInTheDocument();
    expect(screen.getByText('Hebrew Description')).toBeInTheDocument();
    expect(screen.getByText('English Description')).toBeInTheDocument();
    expect(screen.getByText('Requested Qty')).toBeInTheDocument();
    expect(screen.getByText('Last Updated')).toBeInTheDocument();
  });
});