import React from 'react';
import { render } from '@testing-library/react';
import { TokenTable } from '@/app/projects/[id]/components/token/TokenTable';
import { TokenData } from '@/app/projects/[id]/components/types';

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  ArrowUp: () => <span data-testid="arrow-up" />,
  ArrowDown: () => <span data-testid="arrow-down" />,
  ChevronDown: () => <span data-testid="chevron-down" />,
  ChevronRight: () => <span data-testid="chevron-right" />,
  AlertCircle: () => <span data-testid="alert-circle" />,
}));

// Mock Popover
jest.mock('@/app/projects/[id]/components/token/TokenKeywordPopover', () => ({
  TokenKeywordPopover: () => <div data-testid="popover" />,
}));

describe('TokenTable Layout', () => {
  const mockTokens: TokenData[] = [
    {
      tokenName: 'example_token',
      count: '10',
      volume: 1000,
      difficulty: 50,
      tokens: ['example_token'],
      isParent: false,
      hasChildren: false,
      childTokens: [],
    }
  ];

  const defaultProps = {
    tokens: mockTokens,
    selectedTokenNames: new Set<string>(),
    expandedTokens: new Set<string>(),
    onSelectAll: jest.fn(),
    onToggleSelection: jest.fn(),
    onToggleExpansion: jest.fn(),
    onTokenClick: jest.fn(),
    onBlockToken: jest.fn(),
    onUnblockToken: jest.fn(),
    onUnmergeToken: jest.fn(),
    onUnmergeIndividualToken: jest.fn(),
    onTokenHover: jest.fn(),
    hoveredToken: null,
    isLoading: false,
    isProcessingAction: false,
    sortParams: { column: 'volume', direction: 'desc' } as const,
    onSort: jest.fn(),
    getTopKeywords: jest.fn(() => []),
    activeTokenView: 'current' as const,
  };

  it('renders with fixed column widths and no forced horizontal scroll', () => {
    const { container } = render(<TokenTable {...defaultProps} />);

    // Check table does not force horizontal scrolling via min-width
    const table = container.querySelector('table');
    expect(table).not.toHaveClass('min-w-[600px]');
    expect(table).toHaveClass('w-full');

    // Check colgroup widths
    const cols = container.querySelectorAll('col');
    expect(cols).toHaveLength(6);
    expect(cols[0]).toHaveClass('w-[36px]'); // Checkbox
    expect(cols[1]).toHaveClass('w-auto');   // Token
    expect(cols[2]).toHaveClass('w-[40px]'); // Count
    expect(cols[3]).toHaveClass('w-[56px]'); // Vol
    expect(cols[4]).toHaveClass('w-[40px]'); // Diff
    expect(cols[5]).toHaveClass('w-[48px]'); // Action
  });
});
