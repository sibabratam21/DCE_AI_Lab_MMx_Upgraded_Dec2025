/**
 * Test: Stale blocks UI until recalibrate finishes
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnhancedModelDetails } from './EnhancedModelDetails';
import { ModelRun } from '../types';

// Mock the selector service
jest.mock('../services/modelSelectors', () => ({
  selectActiveModelView: jest.fn(() => ({
    model: null,
    contrib: null,
    diag: null,
    consistent: false
  })),
  createModelDataStores: jest.fn(() => ({
    modelById: {},
    contributionsById: {},
    diagnosticsById: {}
  }))
}));

// Mock the channel utils
jest.mock('../utils/channelUtils', () => ({
  channelsMatch: jest.fn()
}));

import { channelsMatch } from '../utils/channelUtils';

describe('EnhancedModelDetails - Stale UI Blocking', () => {
  const mockModel: ModelRun = {
    id: 'test_model',
    algo: 'Bayesian Regression',
    rsq: 0.85,
    mape: 12.5,
    roi: 2.3,
    commentary: 'Test model',
    channels: ['TV', 'Radio', 'Digital'],
    details: [
      { 
        name: 'TV', 
        included: true, 
        contribution: 45, 
        roi: 2.5, 
        pValue: 0.01, 
        adstock: 0.8, 
        lag: 0, 
        transform: 'Log-transform' 
      }
    ],
    provenance: {
      features_hash: 'hash123',
      ranges_hash: 'hash456',
      algo: 'Bayesian',
      data_version: 'v1',
      timestamp: Date.now()
    },
    diagnostics: {
      weak_channels: [],
      sign_mismatch: [],
      overfit_risk: false,
      warning_count: 0,
      channel_diagnostics: []
    }
  };

  const defaultProps = {
    model: mockModel,
    models: [mockModel],
    onRecalibrate: jest.fn(),
    onRequestFinalize: jest.fn(),
    isRecalibrating: false,
    selectedChannels: ['TV', 'Radio', 'Digital'],
    isStale: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (channelsMatch as jest.Mock).mockReturnValue(true);
  });

  describe('Stale State Blocking', () => {
    it('should block UI when isStale=true and show recalibrate overlay', () => {
      render(<EnhancedModelDetails {...defaultProps} isStale={true} />);
      
      // Should show stale overlay
      expect(screen.getByText('Model Parameters Outdated')).toBeInTheDocument();
      expect(screen.getByText(/Feature parameters or channel selections have changed/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Recalibrate Now/i })).toBeInTheDocument();
      
      // Should NOT show normal model content
      expect(screen.queryByText('Channel Contribution')).not.toBeInTheDocument();
      expect(screen.queryByText('Model Diagnostics')).not.toBeInTheDocument();
      expect(screen.queryByText('Chosen Parameters')).not.toBeInTheDocument();
      expect(screen.queryByText('Active Model:')).not.toBeInTheDocument();
    });

    it('should block UI when channels mismatch and show channel mismatch overlay', async () => {
      // Mock channel mismatch
      (channelsMatch as jest.Mock).mockReturnValue(false);
      
      const mismatchedChannels = ['TV', 'Radio', 'Print'];
      render(<EnhancedModelDetails {...defaultProps} selectedChannels={mismatchedChannels} />);
      
      await waitFor(() => {
        expect(screen.getByText('Channel Mismatch Detected')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/This model was trained with different channels/)).toBeInTheDocument();
      expect(screen.getByText('[TV, Radio, Digital]')).toBeInTheDocument();
      expect(screen.getByText('[TV, Radio, Print]')).toBeInTheDocument();
      
      // Should NOT show normal model content
      expect(screen.queryByText('Channel Contribution')).not.toBeInTheDocument();
      expect(screen.queryByText('Model Diagnostics')).not.toBeInTheDocument();
    });

    it('should show normal UI when not stale and channels match', () => {
      (channelsMatch as jest.Mock).mockReturnValue(true);
      
      render(<EnhancedModelDetails {...defaultProps} isStale={false} />);
      
      // Should show normal content
      expect(screen.getByText('Active Model:')).toBeInTheDocument();
      expect(screen.queryByText('Model Parameters Outdated')).not.toBeInTheDocument();
      expect(screen.queryByText('Channel Mismatch Detected')).not.toBeInTheDocument();
    });

    it('should disable recalibrate button when isRecalibrating=true', () => {
      render(<EnhancedModelDetails {...defaultProps} isStale={true} isRecalibrating={true} />);
      
      const recalibrateButton = screen.getByRole('button', { name: /Training/i });
      expect(recalibrateButton).toBeDisabled();
      expect(recalibrateButton).toHaveTextContent('Training...');
    });

    it('should call onRecalibrate when recalibrate button clicked', () => {
      const mockOnRecalibrate = jest.fn();
      
      render(
        <EnhancedModelDetails 
          {...defaultProps} 
          isStale={true} 
          onRecalibrate={mockOnRecalibrate} 
        />
      );
      
      const recalibrateButton = screen.getByRole('button', { name: /Recalibrate Now/i });
      fireEvent.click(recalibrateButton);
      
      expect(mockOnRecalibrate).toHaveBeenCalledTimes(1);
    });

    it('should block UI until recalibrate finishes', async () => {
      const mockOnRecalibrate = jest.fn();
      
      const { rerender } = render(
        <EnhancedModelDetails 
          {...defaultProps} 
          isStale={true} 
          isRecalibrating={false}
          onRecalibrate={mockOnRecalibrate} 
        />
      );
      
      // Initially shows stale overlay
      expect(screen.getByText('Model Parameters Outdated')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Recalibrate Now/i })).toBeEnabled();
      
      // Click recalibrate
      const recalibrateButton = screen.getByRole('button', { name: /Recalibrate Now/i });
      fireEvent.click(recalibrateButton);
      
      // Simulate recalibration starting
      rerender(
        <EnhancedModelDetails 
          {...defaultProps} 
          isStale={true} 
          isRecalibrating={true}
          onRecalibrate={mockOnRecalibrate} 
        />
      );
      
      // Should still show overlay but with disabled button
      expect(screen.getByText('Model Parameters Outdated')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Training/i })).toBeDisabled();
      expect(screen.queryByText('Active Model:')).not.toBeInTheDocument();
      
      // Simulate recalibration completing and stale cleared
      rerender(
        <EnhancedModelDetails 
          {...defaultProps} 
          isStale={false}
          isRecalibrating={false}
          onRecalibrate={mockOnRecalibrate} 
        />
      );
      
      // Should now show normal UI
      await waitFor(() => {
        expect(screen.getByText('Active Model:')).toBeInTheDocument();
      });
      expect(screen.queryByText('Model Parameters Outdated')).not.toBeInTheDocument();
    });

    it('should prioritize channel mismatch over stale when both are true', async () => {
      (channelsMatch as jest.Mock).mockReturnValue(false);
      
      render(
        <EnhancedModelDetails 
          {...defaultProps} 
          isStale={true} 
          selectedChannels={['TV', 'Radio', 'Print']}
        />
      );
      
      await waitFor(() => {
        expect(screen.getByText('Channel Mismatch Detected')).toBeInTheDocument();
      });
      
      // Should show channel mismatch message, not stale message
      expect(screen.queryByText('Model Parameters Outdated')).not.toBeInTheDocument();
    });
  });
});