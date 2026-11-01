import { fireEvent, render, screen } from '@testing-library/react';
import { CommentSheet } from '../CommentSheet';

describe('CommentSheet', () => {
  it('lists the researcher-written comments', () => {
    render(
      <CommentSheet
        comments={[
          { author: 'sam', text: 'So good', likes: 12 },
          { author: 'alex', text: 'lol' },
        ]}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByRole('dialog', { name: '2 comments' })).toBeInTheDocument();
    expect(screen.getByText('So good')).toBeInTheDocument();
    expect(screen.getByText('♥ 12')).toBeInTheDocument();
  });

  it('shows an empty state and closes from the button or a tap outside', () => {
    const onClose = jest.fn();
    render(<CommentSheet comments={[]} onClose={onClose} />);
    expect(screen.getByText('No comments yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
