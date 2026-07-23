import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement these — stub for shadcn / radix and react-dropzone
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (q: string) =>
      ({
        matches: false,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
      }) as unknown as MediaQueryList;
  }
  if (!('ResizeObserver' in window)) {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
  }
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => {};
  }
}
