import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { EnhancedModelDetails } from './EnhancedModelDetails';
import { ModelRun } from '../types';

// Mock the channelUtils
jest.mock('../utils/channelUtils', () => ({
  channelsMatch: jest.fn()
}));

import { channelsMatch } from '../utils/channelUtils';

describe('EnhancedModelDetails - Stale State', () => {
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

  const mockProps = {
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
    // Default to channels matching
    (channelsMatch as jest.Mock).mockReturnValue(true);
  });

  describe('Stale Overlay Appears', () => {
    it('should show stale overlay when isStale prop is true', () => {
      render(<EnhancedModelDetails {...mockProps} isStale={true} />);
      
      expect(screen.getByText('Model Parameters Outdated')).toBeInTheDocument();
      expect(screen.getByText(/Feature parameters or channel selections have changed/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Recalibrate Now/i })).toBeInTheDocument();
    });

    it('should show channel mismatch overlay when channels differ', async () => {
      // Mock channel mismatch
      (channelsMatch as jest.Mock).mockReturnValue(false);
      
      const differentChannels = ['TV', 'Radio', 'Print'];
      render(<EnhancedModelDetails {...mockProps} selectedChannels={differentChannels} />);
      
      await waitFor(() => {
        expect(screen.getByText('Channel Mismatch Detected')).toBeInTheDocument();
      });
      
      expect(screen.getByText(/This model was trained with different channels/)).toBeInTheDocument();
      expect(screen.getByText(/\[TV, Radio, Digital\]/)).toBeInTheDocument();
      expect(screen.getByText(/Current selection: \[TV, Radio, Print\]/)).toBeInTheDocument();
    });

    it('should block charts and metrics when stale', () => {
      render(<EnhancedModelDetails {...mockProps} isStale={true} />);
      
      // Should NOT render chart elements
      expect(screen.queryByText('Channel Contribution')).not.toBeInTheDocument();
      expect(screen.queryByText('Model Diagnostics')).not.toBeInTheDocument();
      expect(screen.queryByText('Chosen Parameters')).not.toBeInTheDocument();
    });

    it('should log warning when channel mismatch detected', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      (channelsMatch as jest.Mock).mockReturnValue(false);
      
      render(<EnhancedModelDetails {...mockProps} selectedChannels={['Social', 'Email']} />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[ModelDetails] Channel mismatch detected')
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Selection Change Triggers Stale', () => {
    it('should become stale when channels are changed after render', async () => {
      const { rerender } = render(<EnhancedModelDetails {...mockProps} />);
      
      // Initially not stale
      expect(screen.queryByText('Channel Mismatch Detected')).not.toBeInTheDocument();
      expect(screen.getByText('Active Model:')).toBeInTheDocument();
      
      // Change channels to trigger mismatch
      (channelsMatch as jest.Mock).mockReturnValue(false);
      rerender(<EnhancedModelDetails {...mockProps} selectedChannels={['TV', 'Radio']} />);
      
      // Should now show stale overlay
      await waitFor(() => {
        expect(screen.getByText('Channel Mismatch Detected')).toBeInTheDocument();
      });
    });

    it('should clear stale state when channels match again', async () => {
      (channelsMatch as jest.Mock).mockReturnValue(false);
      const { rerender } = render(<EnhancedModelDetails {...mockProps} selectedChannels={['TV', 'Radio']} />);
      
      // Initially shows mismatch
      await waitFor(() => {
        expect(screen.getByText('Channel Mismatch Detected')).toBeInTheDocument();
      });
      
      // Fix the channels
      (channelsMatch as jest.Mock).mockReturnValue(true);
      rerender(<EnhancedModelDetails {...mockProps} selectedChannels={['TV', 'Radio', 'Digital']} />);
      
      // Should no longer show stale overlay
      await waitFor(() => {
        expect(screen.queryByText('Channel Mismatch Detected')).not.toBeInTheDocument();
        expect(screen.getByText('Active Model:')).toBeInTheDocument();
      });
    });
  });

  describe('Recalibrate CTA', () => {
    it('should call onRecalibrate when button clicked', () => {
      const onRecalibrate = jest.fn();
      render(<EnhancedModelDetails {...mockProps} isStale={true} onRecalibrate={onRecalibrate} />);
      
      const recalibrateButton = screen.getByRole('button', { name: /Recalibrate Now/i });
      recalibrateButton.click();
      
      expect(onRecalibrate).toHaveBeenCalledTimes(1);
    });

    it('should disable button when recalibrating', () => {
      render(<EnhancedModelDetails {...mockProps} isStale={true} isRecalibrating={true} />);
      
      const recalibrateButton = screen.getByRole('button', { name: /Training/i });
      expect(recalibrateButton).toBeDisabled();
    });
  });
});