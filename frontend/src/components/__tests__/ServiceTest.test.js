import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import ServiceTest from '../ServiceTest';
import { AuthProvider } from '../../context/AuthContext';

// Mock fetch
global.fetch = jest.fn();

// Mock the config
jest.mock('../../config', () => ({
  __esModule: true,
  default: () => ({
    USER_SERVICE_URL: 'http://localhost:8080',
    CHAT_SERVICE_URL: 'http://localhost:3001',
    POSTS_SERVICE_URL: 'http://localhost:8083',
    PROFILE_SERVICE_URL: 'http://localhost:8081'
  })
}));

const MockedServiceTest = () => (
  <BrowserRouter>
    <AuthProvider>
      <ServiceTest />
    </AuthProvider>
  </BrowserRouter>
);

describe('ServiceTest Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders service test component', () => {
    render(<MockedServiceTest />);
    
    expect(screen.getByText('Service Connectivity Test')).toBeInTheDocument();
    expect(screen.getByText('Retest Services')).toBeInTheDocument();
    expect(screen.getByText('Configuration:')).toBeInTheDocument();
    expect(screen.getByText('Test Results:')).toBeInTheDocument();
  });

  test('displays configuration', () => {
    render(<MockedServiceTest />);
    
    expect(screen.getByText(/"USER_SERVICE_URL": "http:\/\/localhost:8080"/)).toBeInTheDocument();
    expect(screen.getByText(/"CHAT_SERVICE_URL": "http:\/\/localhost:3001"/)).toBeInTheDocument();
  });

  test('retest button triggers service tests', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200
    });

    render(<MockedServiceTest />);
    
    const retestButton = screen.getByText('Retest Services');
    fireEvent.click(retestButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(4); // 4 services
    });
  });

  test('handles service test failures', async () => {
    fetch.mockRejectedValue(new Error('Network error'));

    render(<MockedServiceTest />);
    
    const retestButton = screen.getByText('Retest Services');
    fireEvent.click(retestButton);
    
    await waitFor(() => {
      expect(screen.getByText('User Service: FAILED')).toBeInTheDocument();
    });
  });
});
