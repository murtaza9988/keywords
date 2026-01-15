import React from 'react';
import { render, screen, within } from '@testing-library/react';

import ProcessingProgressBar from '../projects/[id]/components/ProcessingProgressBar';

jest.mock('@/lib/apiClient', () => ({
  __esModule: true,
  default: {
    resetProcessing: jest.fn(),
  },
}));

describe('ProcessingProgressBar', () => {
  it('renders per-file progress with errors and completion', () => {
    render(
      <ProcessingProgressBar
        status="processing"
        progress={48}
        currentFileName="alpha.csv"
        queuedFiles={['beta.csv']}
        uploadedFiles={['alpha.csv', 'beta.csv', 'gamma.csv']}
        processedFiles={['gamma.csv']}
        uploadedFileCount={3}
        processedFileCount={1}
        message="Processing uploaded CSVs"
        stage="import_rows"
        stageDetail="Validating and importing rows"
        fileErrors={[
          {
            fileName: 'beta.csv',
            message: 'Header mismatch',
            stage: 'read_csv',
            stageDetail: 'Missing column: keyword',
          },
        ]}
      />
    );

    expect(screen.getByText('CSV processing')).toBeInTheDocument();
    expect(screen.getByText('1/3 files complete')).toBeInTheDocument();
    expect(screen.getByText('Header mismatch')).toBeInTheDocument();

    const alphaCard = screen.getByTestId('processing-file-alpha.csv');
    expect(
      within(alphaCard).getByTestId('processing-file-status-alpha.csv')
    ).toHaveTextContent('Processing');

    const betaCard = screen.getByTestId('processing-file-beta.csv');
    expect(
      within(betaCard).getByTestId('processing-file-status-beta.csv')
    ).toHaveTextContent('Error');

    const gammaCard = screen.getByTestId('processing-file-gamma.csv');
    expect(
      within(gammaCard).getByTestId('processing-file-status-gamma.csv')
    ).toHaveTextContent('Complete');
  });
});
