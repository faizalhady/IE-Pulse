/**
 * The derived plant state is the one piece of logic three report pages depend
 * on, and it fails silently: a plant that reads "all" when it isn't means a
 * report quietly covers the wrong scope. Everything else in ScopePicker is
 * markup.
 */

import { plantState } from '@/components/shared/ScopePicker';
import { ScopePicker } from '@/components/shared/ScopePicker';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const P1 = ['ASP', 'WABTEC', 'KEYSIGHT'];

describe('plantState', () => {
  it('is "all" only when every workcell is picked', () => {
    expect(plantState(P1, ['ASP', 'WABTEC', 'KEYSIGHT'])).toBe('all');
  });

  it('falls to "some" the moment one is unpicked', () => {
    expect(plantState(P1, ['ASP', 'WABTEC'])).toBe('some');
  });

  it('is "none" when nothing is picked', () => {
    expect(plantState(P1, [])).toBe('none');
    expect(plantState(P1, ['SOMETHING ELSE'])).toBe('none');
  });

  it('ignores picks belonging to other plants', () => {
    // A whole-plant pick must not be faked by counting foreign workcells.
    expect(plantState(P1, [...P1, 'ARISTA NETWORKS'])).toBe('all');
    expect(plantState(P1, ['ASP', 'ARISTA NETWORKS', 'TMO'])).toBe('some');
  });

  it('treats an empty plant as "none", not "all"', () => {
    // n === list.length would be 0 === 0 without the zero check first.
    expect(plantState([], [])).toBe('none');
  });
});

describe('ScopePicker', () => {
  const setup = (picked: string[]) => {
    const onChange = vi.fn();
    render(
      <ScopePicker
        plants={['Plant 1']}
        byPlant={{ 'Plant 1': P1 }}
        picked={picked}
        onChange={onChange}
      />,
    );
    return onChange;
  };

  it('ticking the plant selects all of its workcells', () => {
    const onChange = setup([]);
    fireEvent.click(screen.getByText('Plant 1'));
    expect(onChange).toHaveBeenCalledWith(P1);
  });

  it('unticking a full plant clears exactly its own workcells', () => {
    const onChange = vi.fn();
    render(
      <ScopePicker
        plants={['Plant 1', 'Plant 2']}
        byPlant={{ 'Plant 1': P1, 'Plant 2': ['TMO'] }}
        picked={[...P1, 'TMO']}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('Plant 1'));
    expect(onChange).toHaveBeenCalledWith(['TMO']);   // Plant 2 survives
  });

  it('toggling one workcell turns a whole-plant pick into a custom one', () => {
    const onChange = setup(P1);
    fireEvent.click(screen.getByText('WABTEC'));
    expect(onChange).toHaveBeenCalledWith(['ASP', 'KEYSIGHT']);
  });

  it('shows the picked count against the plant total', () => {
    setup(['ASP', 'WABTEC']);
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('renders the plant label, not the raw key', () => {
    render(
      <ScopePicker
        plants={['JPE']}
        byPlant={{ JPE: ['TMO'] }}
        picked={[]}
        onChange={vi.fn()}
        labelPlant={(p) => (p === 'JPE' ? 'Plant 2' : p)}
      />,
    );
    expect(screen.getByText('Plant 2')).toBeInTheDocument();
    expect(screen.queryByText('JPE')).not.toBeInTheDocument();
  });
});
