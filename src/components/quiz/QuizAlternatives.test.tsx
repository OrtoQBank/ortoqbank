/* eslint-disable playwright/no-standalone-expect */
/* eslint-disable playwright/missing-playwright-await */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import QuizAlternatives from './QuizAlternatives';
import { AlternativeIndex } from './types';

describe('QuizAlternatives', () => {
  const mockAlternatives = ['Option A', 'Option B', 'Option C', 'Option D'];

  describe('Rendering', () => {
    it('renders all alternatives', () => {
      const onSelect = vi.fn();
      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
      expect(screen.getByText('Option C')).toBeInTheDocument();
      expect(screen.getByText('Option D')).toBeInTheDocument();
    });

    it('renders alternatives with letter labels (A, B, C, D)', () => {
      const onSelect = vi.fn();
      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
      expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('renders with empty alternatives array', () => {
      const onSelect = vi.fn();
      const { container } = render(
        <QuizAlternatives
          alternatives={[]}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(0);
    });
  });

  describe('User Interaction - Mouse Clicks', () => {
    it('calls onSelect when an alternative is clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      const optionB = screen.getByText('Option B').closest('button');
      await user.click(optionB!);

      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('does not call onSelect when disabled', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={true}
        />,
      );

      const optionA = screen.getByText('Option A').closest('button');
      await user.click(optionA!);

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('allows changing selection', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      const { rerender } = render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      // Select first option
      const optionA = screen.getByText('Option A').closest('button');
      await user.click(optionA!);
      expect(onSelect).toHaveBeenCalledWith(0);

      // Rerender with selection
      rerender(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={0 as AlternativeIndex}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      // Select different option
      const optionC = screen.getByText('Option C').closest('button');
      await user.click(optionC!);
      expect(onSelect).toHaveBeenCalledWith(2);
    });
  });

  describe('Visual Feedback - Selection States', () => {
    it('highlights selected alternative', () => {
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={1 as AlternativeIndex}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      const optionB = screen.getByText('Option B').closest('button');
      expect(optionB).toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('shows correct answer with green styling when feedback enabled', () => {
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={1 as AlternativeIndex}
          onSelect={onSelect}
          disabled={true}
          showFeedback={true}
          correctAlternative={2 as AlternativeIndex}
        />,
      );

      const correctOption = screen.getByText('Option C').closest('button');
      expect(correctOption).toHaveClass('border-green-500', 'bg-green-50');
    });

    it('shows incorrect selection with red styling when feedback enabled', () => {
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={1 as AlternativeIndex}
          onSelect={onSelect}
          disabled={true}
          showFeedback={true}
          correctAlternative={2 as AlternativeIndex}
        />,
      );

      const incorrectOption = screen.getByText('Option B').closest('button');
      expect(incorrectOption).toHaveClass('border-red-500', 'bg-red-50');
    });

    it('shows both correct and incorrect indicators with icons', () => {
      const onSelect = vi.fn();

      const { container } = render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={1 as AlternativeIndex}
          onSelect={onSelect}
          disabled={true}
          showFeedback={true}
          correctAlternative={2 as AlternativeIndex}
        />,
      );

      // Check for check icon (correct answer)
      const checkIcons = container.querySelectorAll('[class*="text-green-600"]');
      expect(checkIcons.length).toBeGreaterThan(0);

      // Check for X icon (incorrect answer)
      const xIcons = container.querySelectorAll('[class*="text-red-600"]');
      expect(xIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Submit and Next Actions', () => {
    it('calls onSubmit when answer is selected and not yet answered', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSubmit = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={1 as AlternativeIndex}
          onSelect={onSelect}
          onSubmit={onSubmit}
          disabled={false}
          hasAnswered={false}
        />,
      );

      // Press Enter to submit
      await user.keyboard('{Enter}');

      expect(onSubmit).toHaveBeenCalled();
    });

    it('does not call onSubmit if no alternative is selected', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSubmit = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={undefined}
          onSelect={onSelect}
          onSubmit={onSubmit}
          disabled={false}
          hasAnswered={false}
        />,
      );

      await user.keyboard('{Enter}');

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not call onSubmit if already answered', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSubmit = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={1 as AlternativeIndex}
          onSelect={onSelect}
          onSubmit={onSubmit}
          disabled={true}
          hasAnswered={true}
        />,
      );

      await user.keyboard('{Enter}');

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('selects next alternative with ArrowDown', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={0 as AlternativeIndex}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      await user.keyboard('{ArrowDown}');

      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('selects previous alternative with ArrowUp', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={2 as AlternativeIndex}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      await user.keyboard('{ArrowUp}');

      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('wraps to last alternative when ArrowUp on first', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      await user.keyboard('{ArrowUp}');

      expect(onSelect).toHaveBeenCalledWith(3); // Last alternative (index 3)
    });

    it('stops at last alternative when ArrowDown', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={3 as AlternativeIndex}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      await user.keyboard('{ArrowDown}');

      expect(onSelect).toHaveBeenCalledWith(3); // Stays at 3
    });

    it('selects alternatives with number keys (1-4)', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      await user.keyboard('3');

      expect(onSelect).toHaveBeenCalledWith(2); // Key '3' = index 2
    });

    it('ignores number keys beyond alternatives length', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={['A', 'B']} // Only 2 alternatives
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      await user.keyboard('5');

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('submits with Space key when alternative selected', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onSubmit = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={1 as AlternativeIndex}
          onSelect={onSelect}
          onSubmit={onSubmit}
          disabled={false}
          hasAnswered={false}
        />,
      );

      await user.keyboard(' ');

      expect(onSubmit).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('renders all alternatives as buttons', () => {
      const onSelect = vi.fn();

      const { container } = render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(4);
    });

    it('disables all buttons when disabled prop is true', () => {
      const onSelect = vi.fn();

      const { container } = render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={true}
        />,
      );

      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('has proper text contrast for readability', () => {
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={0 as AlternativeIndex}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      // Check that letter labels have proper styling
      const labelA = screen.getByText('A');
      expect(labelA).toHaveClass('text-gray-700');
    });
  });

  describe('Edge Cases', () => {
    it('handles single alternative', () => {
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={['Only Option']}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      expect(screen.getByText('Only Option')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('handles very long alternative text', () => {
      const longText = 'This is a very long alternative text that should still be displayed correctly without breaking the layout or causing any issues with the component rendering';
      const onSelect = vi.fn();

      render(
        <QuizAlternatives
          alternatives={[longText, 'Short']}
          selectedAlternative={undefined}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('handles selection at boundary (first and last)', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      const { rerender } = render(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={0 as AlternativeIndex}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      // Should not go below 0
      await user.keyboard('{ArrowUp}');
      expect(onSelect).toHaveBeenCalledWith(0);

      onSelect.mockClear();

      rerender(
        <QuizAlternatives
          alternatives={mockAlternatives}
          selectedAlternative={3 as AlternativeIndex}
          onSelect={onSelect}
          disabled={false}
        />,
      );

      // Should not go above last
      await user.keyboard('{ArrowDown}');
      expect(onSelect).toHaveBeenCalledWith(3);
    });
  });
});
