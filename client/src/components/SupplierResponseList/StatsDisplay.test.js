import React from 'react';
import { render, screen } from '@testing-library/react';
import { ResponseStats } from './utils';

describe('ResponseStats', () => {
  const mockResponse = {
    total_items: 100,
    covered_items: 75,
    missing_items: 25,
  };

  it('displays correct statistics', () => {
    render(<ResponseStats response={mockResponse} />);
    
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    
    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('Covered')).toBeInTheDocument();
    expect(screen.getByText('Missing')).toBeInTheDocument();
  });

  it('handles zero values', () => {
    const emptyResponse = {
      total_items: 0,
      covered_items: 0,
      missing_items: 0,
    };

    render(<ResponseStats response={emptyResponse} />);
    
    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(3);
  });
});