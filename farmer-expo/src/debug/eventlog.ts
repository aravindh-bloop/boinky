/**
 * Lightweight activity trace. Every tap, screen change, network call and error
 * is printed to the Metro terminal (the `npx expo start` window) with a clear
 * prefix so it's easy to scan or grep:
 *
 *   [tap] Diagnose crop
 *   [nav] Alerts
 *   [net] GET /api/home  ->  200 · 342ms
 *   [err] GET /api/insights/daily  ->  timeout after 30000ms
 */

export type EventKind = 'tap' | 'nav' | 'net' | 'error' | 'info';

export function logEvent(kind: EventKind, label: string, detail?: string): void {
  const line = `[${kind}] ${label}${detail ? `  ->  ${detail}` : ''}`;
  if (kind === 'error') console.warn(line);
  else console.log(line);
}

/** Recursively pull visible text out of a React node tree — used to label taps. */
export function extractLabel(node: unknown, depth = 0): string {
  if (node == null || node === false || depth > 4) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim();
  if (Array.isArray(node)) {
    for (const n of node) {
      const s = extractLabel(n, depth + 1);
      if (s) return s;
    }
    return '';
  }
  const el = node as { props?: Record<string, unknown> };
  if (el && el.props) {
    if (typeof el.props.title === 'string') return el.props.title;
    if (typeof el.props.label === 'string') return el.props.label;
    if (typeof el.props.accessibilityLabel === 'string') return el.props.accessibilityLabel;
    if (typeof el.props.name === 'string') return `icon:${el.props.name}`;
    return extractLabel(el.props.children, depth + 1);
  }
  return '';
}

/** Install a global JS error hook once, so uncaught errors also reach the terminal. */
let errorHookInstalled = false;
export function installErrorHook(): void {
  if (errorHookInstalled) return;
  errorHookInstalled = true;
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler: () => unknown; setGlobalHandler: (h: unknown) => void };
  };
  const prev = g.ErrorUtils?.getGlobalHandler?.() as
    | ((e: unknown, fatal?: boolean) => void)
    | undefined;
  g.ErrorUtils?.setGlobalHandler?.((e: unknown, fatal?: boolean) => {
    const err = e as Error;
    logEvent('error', fatal ? 'FATAL JS error' : 'JS error', err?.message ?? String(e));
    prev?.(e, fatal);
  });
}
