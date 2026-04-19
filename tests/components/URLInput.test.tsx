// tests/components/URLInput.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import URLInput from '@/renderer/components/URLInput';

describe('URLInput', () => {
  it('renders with placeholder', () => {
    render(<URLInput onURL={() => {}} />);
    expect(screen.getByPlaceholderText(/paste youtube url/i)).toBeInTheDocument();
  });

  it('calls onURL when form submitted', () => {
    const onURL = vi.fn();
    render(<URLInput onURL={onURL} />);
    const input = screen.getByPlaceholderText(/paste youtube url/i);
    fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=abc' } });
    fireEvent.submit(screen.getByRole('form'));
    expect(onURL).toHaveBeenCalledWith('https://youtube.com/watch?v=abc');
  });

  it('disables button when loading', () => {
    render(<URLInput onURL={() => {}} loading />);
    expect(screen.getByText('ANALYZING...')).toBeDisabled();
  });

  it('does not submit empty input', () => {
    const onURL = vi.fn();
    render(<URLInput onURL={onURL} />);
    fireEvent.submit(screen.getByRole('form'));
    expect(onURL).not.toHaveBeenCalled();
  });

  it('uses initialValue if provided', () => {
    render(<URLInput onURL={() => {}} initialValue="https://youtube.com/abc" />);
    expect(screen.getByDisplayValue('https://youtube.com/abc')).toBeInTheDocument();
  });

  it('updates value when initialValue changes', () => {
    const { rerender } = render(<URLInput onURL={() => {}} initialValue="first" />);
    expect(screen.getByDisplayValue('first')).toBeInTheDocument();
    
    rerender(<URLInput onURL={() => {}} initialValue="second" />);
    expect(screen.getByDisplayValue('second')).toBeInTheDocument();
  });
});
