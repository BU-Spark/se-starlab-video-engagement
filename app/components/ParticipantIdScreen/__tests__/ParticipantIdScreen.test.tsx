import { render, screen, fireEvent } from '@testing-library/react';
import { ParticipantIdScreen } from '../ParticipantIdScreen';

describe('ParticipantIdScreen', () => {
  it('only enables Start once an ID is typed, and trims it', () => {
    const onStart = jest.fn();
    render(<ParticipantIdScreen studyName="Demo" onStart={onStart} onBack={jest.fn()} />);
    const start = screen.getByRole('button', { name: 'Start' });
    expect(start).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Participant ID'), { target: { value: '  P-042 ' } });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(onStart).toHaveBeenCalledWith('P-042');
  });
});
