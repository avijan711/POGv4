import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SupplierResponseList from './SupplierResponseList';

describe('SupplierResponseList Delete Functionality', () => {
  const mockResponses = [
    {
      id: 1,
      supplier: {
        name: 'Test Supplier',
        contact_name: 'John Doe',
        email: 'john@test.com',
      },
      status: 'pending',
      total_items: 10,
      covered_items: 7,
      missing_items: 3,
    },
  ];

  it('calls onDelete when delete button is clicked', () => {
    const mockDelete = jest.fn();
    render(
      <SupplierResponseList
        responses={mockResponses}
        onDelete={mockDelete}
      />,
    );
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);
    
    expect(mockDelete).toHaveBeenCalledWith(mockResponses[0]);
  });

  it('disables delete button when disabled prop is true', () => {
    render(
      <SupplierResponseList
        responses={mockResponses}
        onDelete={() => {}}
        disabled={true}
      />,
    );
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });

  it('enables delete button when disabled prop is false', () => {
    render(
      <SupplierResponseList
        responses={mockResponses}
        onDelete={() => {}}
        disabled={false}
      />,
    );
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).not.toBeDisabled();
  });

  it('shows tooltip on disabled delete button hover', () => {
    render(
      <SupplierResponseList
        responses={mockResponses}
        onDelete={() => {}}
        disabled={true}
      />,
    );
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.mouseOver(deleteButton);
    
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});