import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
vi.mock('./StudioView', () => ({
  default: () => <div data-testid="studio-view" />,
}));
vi.mock('../hooks/useServerConfig', () => ({
  useServerConfig: () => ({ updateVideoConfig: vi.fn() }),
}));
import App from './App';

describe('App', () => {
  it('renders studio header', () => {
    render(<App />);
    expect(screen.getByText(/Trackeovrconia Studio/i)).toBeInTheDocument();
  });
});
