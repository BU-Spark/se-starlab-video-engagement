import { HOME_PATH, safeNextPath } from './auth';

describe('safeNextPath', () => {
  it('keeps researcher pages', () => {
    expect(safeNextPath('/researcher/studies/abc/data')).toBe('/researcher/studies/abc/data');
    expect(safeNextPath('/researcher/studies?x=1')).toBe('/researcher/studies?x=1');
  });

  it('falls back to the study list for anything else', () => {
    for (const next of [undefined, null, '', '/tablet', 'https://evil.test', '//evil.test', '/researcher/login']) {
      expect(safeNextPath(next)).toBe(HOME_PATH);
    }
  });
});
