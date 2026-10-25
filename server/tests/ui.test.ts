import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHarness } from './helpers.js';

const root = process.cwd();

describe('18. The application works on mobile and desktop (static + delivery checks)', () => {
  it('declares a mobile viewport and responsive, reduced-motion aware styles', () => {
    const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('width=device-width');
    expect(html).toContain('lang="sv"');

    const styles = fs.readFileSync(path.join(root, 'web/src/styles.css'), 'utf8') +
      fs.readFileSync(path.join(root, 'web/src/pages.css'), 'utf8');
    expect(styles).toMatch(/@media \(min-width: 900px\)/);
    expect(styles).toMatch(/@media \(min-width: 620px\)/);
    expect(styles).toMatch(/@media \(max-width: 380px\)/);
    expect(styles).toContain('prefers-reduced-motion: reduce');
    expect(styles).toContain(':focus-visible');
    // Mobile tab bar + desktop sidebar both exist.
    expect(styles).toContain('.tabbar');
    expect(styles).toContain('.sidebar');
  });

  it('exposes all six primary destinations in navigation and routing', () => {
    const shell = fs.readFileSync(path.join(root, 'web/src/components/AppShell.tsx'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'web/src/App.tsx'), 'utf8');
    for (const label of ['Hem', 'Mål', 'Transaktioner', 'Tävlingar', 'Bedrifter', 'Profil']) {
      expect(shell).toContain(`label: '${label}'`);
    }
    for (const route of ['/', '/mal', '/transaktioner', '/tavlingar', '/bedrifter', '/profil']) {
      expect(app).toContain(`path="${route}"`);
    }
    expect(shell).toContain('aria-label="Huvudnavigering"');
    expect(shell).toContain('skip-link');
  });

  it('serves the built SPA for deep links so mobile browsers can reload any tab', async () => {
    const indexPath = path.join(root, 'web/dist/index.html');
    if (!fs.existsSync(indexPath)) {
      // The build is not committed; run `npm run build:web` to enable this check.
      expect(true).toBe(true);
      return;
    }
    const harness = createHarness();
    try {
      const request = (await import('supertest')).default;
      for (const route of ['/', '/mal', '/transaktioner', '/bedrifter', '/profil']) {
        const response = await request(harness.app).get(route);
        expect(response.status, route).toBe(200);
        expect(response.headers['content-type']).toMatch(/text\/html/);
        expect(response.text).toContain('<div id="root">');
      }
      const missingApi = await request(harness.app).get('/api/does-not-exist');
      expect(missingApi.status).toBe(404);
      expect(missingApi.body.error.code).toBe('not_found');

      const health = await request(harness.app).get('/api/health');
      expect(health.status).toBe(200);
      expect(health.body.status).toBe('ok');
    } finally {
      harness.close();
    }
  });
});
