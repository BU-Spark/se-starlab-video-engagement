import { fireEvent, render, screen, within, waitFor, act } from '@testing-library/react';
import StudyBuilder from './StudyBuilder';
import { saveDemoStudy } from './demo-service';

jest.mock('./demo-service', () => ({ saveDemoStudy: jest.fn() }));
const mockSave = jest.mocked(saveDemoStudy);
function add(type: 'Instructions' | 'Video' | 'Survey') {
  if (!screen.queryByRole('button', { name: new RegExp('^' + type + ' ') })) {
    fireEvent.click(screen.getByRole('button', { name: 'Add block' }));
  }
  fireEvent.click(screen.getByRole('button', { name: new RegExp('^' + type + ' ') }));
}
function fillInstruction() {
  fireEvent.change(screen.getByLabelText(/Study name/), { target: { value: 'Attention experiment' } });
  add('Instructions');
  fireEvent.change(screen.getByLabelText(/Instruction text/), { target: { value: 'Please watch carefully.' } });
}
function save() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Save demo' })[0]);
}
beforeEach(() => {
  mockSave.mockReset();
  mockSave.mockResolvedValue({ savedAt: '2026-10-16T12:00:00Z' });
  let counter = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: jest.fn(() => 'blob:test-' + ++counter),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: jest.fn() });
});

describe('Study builder', () => {
  it('renders a clearly labeled local-only empty workspace', () => {
    render(<StudyBuilder />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create a study');
    expect(screen.getByText('Demo workspace')).toBeInTheDocument();
    expect(screen.getByText(/refreshing or closing this page clears/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Response buttons' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Swipe back' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: /List of studies/ })).toBeDisabled();
  });
  it('validates without calling the save service', () => {
    render(<StudyBuilder />);
    save();
    expect(screen.getByText('Give your study a name.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one block to your study.')).toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();
  });
  it('preserves disabled button labels and edits randomization', () => {
    render(<StudyBuilder />);
    fireEvent.change(screen.getByLabelText('Left button text'), { target: { value: 'Not for me' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Response buttons' }));
    expect(screen.getByLabelText('Left button text')).toBeDisabled();
    fireEvent.click(screen.getByRole('switch', { name: 'Response buttons' }));
    expect(screen.getByLabelText('Left button text')).toHaveValue('Not for me');
    fireEvent.click(screen.getByRole('button', { name: 'Videos only' }));
    expect(screen.getByRole('button', { name: 'Videos only' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('reorders without mixing up block contents', () => {
    render(<StudyBuilder />);
    fillInstruction();
    add('Survey');
    fireEvent.change(screen.getByLabelText(/Survey question/), { target: { value: 'How was it?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move block 2 up' }));
    expect(
      within(screen.getByRole('article', { name: 'Block 1: Survey' })).getByLabelText(/Survey question/)
    ).toHaveValue('How was it?');
    expect(
      within(screen.getByRole('article', { name: 'Block 2: Instructions' })).getByLabelText(/Instruction text/)
    ).toHaveValue('Please watch carefully.');
    expect(screen.getByRole('button', { name: 'Move block 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move block 2 down' })).toBeDisabled();
  });
  it('requires confirmation before deleting', () => {
    render(<StudyBuilder />);
    add('Instructions');
    fireEvent.click(screen.getByRole('button', { name: 'Delete block 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('article')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete block 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete block' }));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
  it('keeps at least two options and validates new empty options', () => {
    render(<StudyBuilder />);
    add('Survey');
    for (let n = 0; n < 3; n++) fireEvent.click(screen.getByRole('button', { name: 'Remove option 1 from block 1' }));
    expect(screen.getByRole('button', { name: 'Remove option 1 from block 1' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add response option' }));
    save();
    expect(screen.getByText('Option text cannot be empty.')).toBeInTheDocument();
  });
  it('saves in demo mode and marks subsequent edits unsaved', async () => {
    render(<StudyBuilder />);
    fillInstruction();
    save();
    expect(await screen.findByText(/Demo saved successfully/)).toBeInTheDocument();
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Attention experiment' }), false);
    fireEvent.change(screen.getByLabelText(/Study name/), { target: { value: 'Updated title' } });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.queryByText(/Demo saved successfully/)).not.toBeInTheDocument();
  });
  it('preserves input after failure and supports retry', async () => {
    mockSave.mockRejectedValueOnce(new Error('Demo save failed. Your changes are still here.'));
    render(<StudyBuilder />);
    fillInstruction();
    fireEvent.click(screen.getByLabelText('Simulate a save failure'));
    save();
    expect(await screen.findByRole('alert')).toHaveTextContent('Your changes are still here');
    expect(screen.getByLabelText(/Instruction text/)).toHaveValue('Please watch carefully.');
    expect(mockSave).toHaveBeenLastCalledWith(expect.anything(), true);
    fireEvent.click(screen.getByLabelText('Simulate a save failure'));
    save();
    expect(await screen.findByText(/Demo saved successfully/)).toBeInTheDocument();
  });
  it('disables editing during a pending save', async () => {
    let finish!: (value: { savedAt: string }) => void;
    mockSave.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    render(<StudyBuilder />);
    fillInstruction();
    save();
    expect(screen.getByLabelText(/Study name/)).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Swipe back' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Saving demo…' })[0]).toBeDisabled();
    await act(async () => {
      finish({ savedAt: 'now' });
    });
    expect(screen.getByLabelText(/Study name/)).not.toBeDisabled();
  });
  it('waits for metadata and revokes video previews', async () => {
    render(<StudyBuilder />);
    fireEvent.change(screen.getByLabelText(/Study name/), { target: { value: 'Video study' } });
    add('Video');
    fireEvent.change(screen.getByLabelText('Video file for block 1'), {
      target: { files: [new File(['video'], 'clip.mp4', { type: 'video/mp4' })] },
    });
    save();
    expect(screen.getByText('Wait for the video preview to load.')).toBeInTheDocument();
    fireEvent.loadedMetadata(screen.getByLabelText('Video preview for block 1'));
    save();
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    await screen.findByText(/Demo saved successfully/);
    fireEvent.click(screen.getByRole('button', { name: 'Remove video' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
    expect(screen.queryByLabelText('Video preview for block 1')).not.toBeInTheDocument();
  });
  it('handles invalid and unreadable files', () => {
    render(<StudyBuilder />);
    add('Video');
    const input = screen.getByLabelText('Video file for block 1');
    fireEvent.change(input, { target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] } });
    expect(screen.getByText('Choose a non-empty video file.')).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.mp4', { type: 'video/mp4' })] } });
    fireEvent.error(screen.getByLabelText('Video preview for block 1'));
    expect(screen.getByText(/This browser cannot play/)).toBeInTheDocument();
    expect(screen.getByText(/Preview unavailable/)).toBeInTheDocument();
  });
  it('releases previews on unmount', () => {
    const view = render(<StudyBuilder />);
    fireEvent.change(screen.getByLabelText('Left button icon'), {
      target: { files: [new File(['image'], 'icon.png', { type: 'image/png' })] },
    });
    fireEvent.load(screen.getByAltText('Left button preview'));
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });
});
