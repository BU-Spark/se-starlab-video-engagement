import { redirect } from 'next/navigation';
import HomePage from './page';

jest.mock('next/navigation', () => ({ redirect: jest.fn() }));

describe('Home page', () => {
  it('redirects to the participant app', () => {
    HomePage();
    expect(redirect).toHaveBeenCalledWith('/tablet');
  });
});
