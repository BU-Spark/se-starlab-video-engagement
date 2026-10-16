import { render, screen, fireEvent } from '@testing-library/react';
import { ResearcherExit } from '../ResearcherExit';

const tapHotspot = (times: number) => {
  const hotspot = screen.getByTestId('researcher-hotspot');
  for (let i = 0; i < times; i++) fireEvent.click(hotspot);
};

describe('ResearcherExit', () => {
  it('stays hidden until the corner is tapped five times', () => {
    render(<ResearcherExit pin="1234" onExit={jest.fn()} />);
    tapHotspot(4);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    tapHotspot(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('requires the correct PIN to exit', () => {
    const onExit = jest.fn();
    render(<ResearcherExit pin="1234" onExit={onExit} />);
    tapHotspot(5);
    const input = screen.getByLabelText('Researcher PIN');

    fireEvent.change(input, { target: { value: '0000' } });
    fireEvent.click(screen.getByRole('button', { name: 'End session' }));
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByText('Incorrect PIN')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'End session' }));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
