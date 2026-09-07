import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import Coframe from './Coframe';

describe('Coframe', () => {
  beforeEach(() => {
    window.CFQ = [];
  });

  it('renders the installation script tag with the project ID', () => {
    const { container } = render(<Coframe />);
    const script = container.querySelector('script#coframe-installation-script');
    expect(script).not.toBeNull();
    expect(script?.textContent).toContain("projectId: '6a9e31bb82444fc48fd16faf'");
    expect(script?.textContent).toContain('https://edge.cofra.me/cf.js');
    expect(script?.textContent).toContain('waitForHydration: true');
  });

  it('pushes pageHydrated event to window.CFQ after mounting', () => {
    render(<Coframe />);
    expect(window.CFQ).toContainEqual({ pageHydrated: true });
  });
});
