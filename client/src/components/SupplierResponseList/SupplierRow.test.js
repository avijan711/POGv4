import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SupplierRow from './SupplierRow';

describe('SupplierRow', () => {
  const mockResponse = {
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
  };

  it('displays supplier information correctly', () => {
    render(<SupplierRow response={mockResponse} />);
    
    expect(screen.getByText('Test Supplier')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
  });

  it('displays status chip correctly', () => {
    render(<SupplierRow response={mockResponse} />);
    
    const statusChip = screen.getByTestId('status-chip');
    expect(statusChip).toBeInTheDocument();
    expect(statusChip).toHaveStyle({
      backgroundColor: expect.any(String),
      color: expect.any(String),
    });
  });

  it('displays statistics correctly', () => {
    render(<SupplierRow response={mockResponse} />);
    
    expect(screen.getByText('10')).toBeInTheDocument(); // total items
    expect(screen.getByText('7')).toBeInTheDocument();  // covered items
    expect(screen.getByText('3')).toBeInTheDocument();  // missing items
  });

  it('calls onViewCovered when covered button is clicked', () => {
    const mockViewCovered = jest.fn();
    render(
      <SupplierRow
        response={mockResponse}
        onViewCovered={mockViewCovered}
      />,
    );
    
    fireEvent.click(screen.getByText(/Covered/));
    expect(mockViewCovered).toHaveBeenCalledWith(mockResponse);
  });

  it('calls onViewMissing when missing button is clicked', () => {
    const mockViewMissing = jest.fn();
    render(
      <SupplierRow
        response={mockResponse}
        onViewMissing={mockViewMissing}
      />,
    );
    
    fireEvent.click(screen.getByText(/Missing/));
    expect(mockViewMissing).toHaveBeenCalledWith(mockResponse);
  });

  it('disables buttons when disabled prop is true', () => {
    render(
      <SupplierRow
        response={mockResponse}
        disabled={true}
      />,
    );
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('enables buttons when disabled prop is false', () => {
    render(
      <SupplierRow
        response={mockResponse}
        disabled={false}
      />,
    );
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).not.toBeDisabled();
    });
  });
});