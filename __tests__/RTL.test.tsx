/**
 * RTL layout tests — verify Hebrew language context produces correct
 * direction-aware styles across shared components and key screens.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { LanguageContext } from '../src/i18n/LanguageContext';
import { translate } from '../src/i18n/translations';
import DateNavigator from '../src/components/DateNavigator';
import GoalCard from '../src/components/GoalCard';
import StorageService from '../src/services/StorageService';
import GoalsService from '../src/services/GoalsService';
import ReportScreen from '../src/screens/ReportScreen';
import { Goal } from '../src/types/Goal';

// ---------------------------------------------------------------------------
// Hebrew context helper
// ---------------------------------------------------------------------------

const hebrewContextValue = {
  language: 'he' as const,
  direction: 'rtl' as const,
  t: (key: string, params?: Record<string, string | number>) => translate(key, 'he', params),
  setLanguage: async () => {},
};

const englishContextValue = {
  language: 'en' as const,
  direction: 'ltr' as const,
  t: (key: string, params?: Record<string, string | number>) => translate(key, 'en', params),
  setLanguage: async () => {},
};

function withHebrew(children: React.ReactNode) {
  return (
    <LanguageContext.Provider value={hebrewContextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

function withEnglish(children: React.ReactNode) {
  return (
    <LanguageContext.Provider value={englishContextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// DateNavigator RTL tests
// ---------------------------------------------------------------------------

describe('DateNavigator RTL', () => {
  const date = new Date('2026-05-14');

  test('LTR: prev arrow is ‹ and next arrow is ›', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        withEnglish(<DateNavigator date={date} onPrev={jest.fn()} onNext={jest.fn()} />),
      );
    });
    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('‹');
    expect(tree).toContain('›');
    // ‹ should appear before › in the LTR layout (left→right)
    expect(tree.indexOf('‹')).toBeLessThan(tree.indexOf('›'));
  });

  test('RTL: prev arrow is › and next arrow is ‹', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        withHebrew(<DateNavigator date={date} onPrev={jest.fn()} onNext={jest.fn()} />),
      );
    });
    // Collect leaf Text nodes whose sole child is an arrow character
    const arrows = renderer.root.findAll(el =>
      (el.type as unknown as string) === 'Text' &&
      typeof el.props.children === 'string' &&
      (el.props.children === '‹' || el.props.children === '›'),
    );
    // Deduplicate by character value in case test renderer surfaces duplicates
    const unique = [...new Set(arrows.map(a => a.props.children as string))];
    expect(unique).toContain('›'); // prev arrow in RTL
    expect(unique).toContain('‹'); // next arrow in RTL

    // The tree JSON shows arrows in order: prevArrow, label, nextArrow
    // In RTL row-reverse the first arrow (prev) renders as › and appears first in JSON
    const treeStr = JSON.stringify(renderer.toJSON());
    expect(treeStr.indexOf('›')).toBeLessThan(treeStr.indexOf('‹'));
  });

  test('RTL: dayNav uses row-reverse flexDirection', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        withHebrew(<DateNavigator date={date} onPrev={jest.fn()} onNext={jest.fn()} />),
      );
    });
    const root = renderer.toJSON() as ReactTestRenderer.ReactTestInstance;
    // The outer View should have row-reverse
    const outerStyle = Array.isArray(root) ? (root[0] as any).props?.style : (root as any).props?.style;
    const styles = [outerStyle].flat();
    const flexDirs = styles.map((s: any) => s?.flexDirection).filter(Boolean);
    expect(flexDirs).toContain('row-reverse');
  });

  test('LTR: dayNav uses row flexDirection', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        withEnglish(<DateNavigator date={date} onPrev={jest.fn()} onNext={jest.fn()} />),
      );
    });
    const root = renderer.toJSON() as ReactTestRenderer.ReactTestInstance;
    const outerStyle = Array.isArray(root) ? (root[0] as any).props?.style : (root as any).props?.style;
    const styles = [outerStyle].flat();
    const flexDirs = styles.map((s: any) => s?.flexDirection).filter(Boolean);
    // Should be 'row' (or default, not row-reverse)
    expect(flexDirs).not.toContain('row-reverse');
  });
});

// ---------------------------------------------------------------------------
// GoalCard RTL tests
// ---------------------------------------------------------------------------

describe('GoalCard RTL', () => {
  const goal: Goal = {
    id: 1,
    text: 'השלמת מודול האימות',
    status: 'active',
    progress: 60,
    startAt: Date.now() - 86400000,
    targetAt: Date.now() + 86400000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  function findProgressBgStyle(renderer: ReactTestRenderer.ReactTestRenderer): Record<string, any>[] {
    // Find all Views and collect those with transform containing scaleX
    const allViews = renderer.root.findAll(el => (el.type as unknown as string) === 'View');
    const styles: Record<string, any>[] = [];
    allViews.forEach(v => {
      const s = [v.props.style].flat();
      s.forEach((style: any) => {
        if (style?.transform) styles.push(style);
      });
    });
    return styles;
  }

  test('RTL: progress bar has scaleX -1 transform (fills from right)', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(withHebrew(<GoalCard goal={goal} />));
    });
    const transformedStyles = findProgressBgStyle(renderer);
    const hasFlip = transformedStyles.some(s =>
      s.transform?.some((t: any) => t.scaleX === -1),
    );
    expect(hasFlip).toBe(true);
  });

  test('LTR: progress bar has scaleX 1 (fills from left)', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(withEnglish(<GoalCard goal={goal} />));
    });
    const transformedStyles = findProgressBgStyle(renderer);
    // In LTR the transform is scaleX:1 (no flip)
    const hasFlip = transformedStyles.some(s =>
      s.transform?.some((t: any) => t.scaleX === -1),
    );
    expect(hasFlip).toBe(false);
  });

  test('RTL: topRow uses row-reverse', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(withHebrew(<GoalCard goal={goal} />));
    });
    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('row-reverse');
  });

  test('RTL: Hebrew text is rendered', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(withHebrew(<GoalCard goal={goal} />));
    });
    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('השלמת מודול האימות');
  });
});

// ---------------------------------------------------------------------------
// Translation tests
// ---------------------------------------------------------------------------

describe('translate()', () => {
  test('returns Hebrew for known key', () => {
    expect(translate('Today', 'he')).toBe('היום');
    expect(translate('Save', 'he')).toBe('שמור');
    expect(translate('Cancel', 'he')).toBe('ביטול');
  });

  test('returns English key for English language', () => {
    expect(translate('Today', 'en')).toBe('Today');
    expect(translate('Save', 'en')).toBe('Save');
  });

  test('falls back to key for unknown Hebrew translation', () => {
    expect(translate('some_unknown_key_xyz', 'he')).toBe('some_unknown_key_xyz');
  });

  test('substitutes {placeholder} params', () => {
    expect(translate('Show {n} more', 'he', { n: 3 })).toBe('הצג 3 נוספים');
    expect(translate('Show {n} more', 'en', { n: 5 })).toBe('Show 5 more');
  });
});

// ---------------------------------------------------------------------------
// ReportScreen RTL — verify Hebrew labels appear
// ---------------------------------------------------------------------------

describe('ReportScreen Hebrew labels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(StorageService, 'getByDateRange').mockResolvedValue([]);
    jest.spyOn(GoalsService, 'getActiveGoals').mockResolvedValue([]);
  });

  test('shows Hebrew day label "היום" for today', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        withHebrew(
          <ReportScreen onStartCheckIn={jest.fn()} onOpenMenu={jest.fn()} />,
        ),
      );
    });
    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('היום');
  });

  test('shows Hebrew empty state text', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        withHebrew(
          <ReportScreen onStartCheckIn={jest.fn()} onOpenMenu={jest.fn()} />,
        ),
      );
    });
    const tree = JSON.stringify(renderer.toJSON());
    // Hebrew for 'No entries for this day'
    expect(tree).toContain('אין רשומות ליום זה');
  });
});
