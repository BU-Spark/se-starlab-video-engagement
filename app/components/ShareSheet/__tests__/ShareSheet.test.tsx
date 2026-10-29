import { fireEvent, render, screen } from '@testing-library/react';
import { ShareSheet } from '../ShareSheet';

describe('ShareSheet', () => {
  it('reports the tapped option', () => {
    const onClose = jest.fn();
    render(<ShareSheet options={['Copy link', 'Email']} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Email/ }));
    expect(onClose).toHaveBeenCalledWith('Email');
  });

  it('reports Cancel from the cancel button or a tap outside the sheet', () => {
    const onClose = jest.fn();
    render(<ShareSheet options={['Copy link']} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose.mock.calls).toEqual([['Cancel'], ['Cancel']]);
  });

  it('does not close when the sheet background is tapped', () => {
    const onClose = jest.fn();
    render(<ShareSheet options={['Copy link']} onClose={onClose} />);
    fireEvent.click(screen.getByText('Share to'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
