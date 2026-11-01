import { render, screen, fireEvent } from '@testing-library/react';
import type { SurveyBlock } from '@/app/types';
import { SurveySlide } from '../SurveySlide';

const block: SurveyBlock = {
  id: 's1',
  type: 'survey',
  label: 'survey1',
  prompt: 'Did you enjoy it?',
  options: ['Agree', 'Neutral', 'Disagree'],
};

describe('SurveySlide', () => {
  it('renders the prompt and one bubble per option', () => {
    render(<SurveySlide block={block} selected={null} onChoose={jest.fn()} />);
    expect(screen.getByText('Did you enjoy it?')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('reports each choice so answers can be switched', () => {
    const onChoose = jest.fn();
    render(<SurveySlide block={block} selected="Agree" onChoose={onChoose} />);
    expect(screen.getByRole('radio', { name: 'Agree' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Neutral' }));
    expect(onChoose).toHaveBeenCalledWith('Neutral', expect.any(Number));
  });
});
