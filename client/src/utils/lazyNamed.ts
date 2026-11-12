import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Wraps React.lazy() for modules that export named React components instead of default exports.
 */
export function lazyNamed<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TModule extends Record<K, ComponentType<any>>,
  K extends keyof TModule,
>(
  factory: () => Promise<TModule>,
  exportName: K
): LazyExoticComponent<TModule[K]> {
  return lazy(() => factory().then((mod) => ({ default: mod[exportName] })));
}
