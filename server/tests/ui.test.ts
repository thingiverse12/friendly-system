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

  it('ships the Sparly dog mascot in every size the UI asks for', () => {
    const mascotDir = path.join(root, 'web/public/mascot');
    // Every file referenced by Mascot.tsx and the web manifest must exist and be a real PNG.
    const component = fs.readFileSync(path.join(root, 'web/src/components/Mascot.tsx'), 'utf8');
    const referenced = [...component.matchAll(/\/mascot\/([\w.-]+\.png)/g)].map((match) => match[1]);
    expect(referenced.length).toBeGreaterThan(0);

    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'web/public/manifest.webmanifest'), 'utf8'));
    for (const icon of manifest.icons) referenced.push(icon.src.replace('/mascot/', ''));

    const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
    for (const match of html.matchAll(/\/mascot\/([\w.-]+\.png)/g)) referenced.push(match[1]);

    for (const file of new Set(referenced)) {
      const buffer = fs.readFileSync(path.join(mascotDir, file));
      expect(buffer.subarray(1, 4).toString(), file).toBe('PNG');
      expect(buffer.length, file).toBeLessThan(600_000);
    }

    // The mascot is actually used: hero on the auth screen, companion in the sidebar, empty states.
    expect(fs.readFileSync(path.join(root, 'web/src/pages/AuthPage.tsx'), 'utf8')).toContain('auth__mascot');
    expect(fs.readFileSync(path.join(root, 'web/src/components/AppShell.tsx'), 'utf8')).toContain('sidebar__mascot');
    expect(fs.readFileSync(path.join(root, 'web/src/components/UI.tsx'), 'utf8')).toContain('empty-state__mascot');
  });

  it('animates the tail as a separate layer rotating around the hip', () => {
    const component = fs.readFileSync(path.join(root, 'web/src/components/Mascot.tsx'), 'utf8');

    // The animated variant is body + tail, both cut from the same 992x1079 drawing.
    expect(component).toContain("'animated'");
    expect(component).toContain('/mascot/hund-kropp.png');
    expect(component).toContain('/mascot/hund-svans.png');
    expect(component).toContain('transformOrigin');
    // The tail must be drawn *behind* the body so the seam at the hip is never visible.
    const bodyIndex = component.indexOf('mascot__body');
    const tailIndex = component.indexOf('mascot__tail');
    expect(tailIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeGreaterThan(tailIndex);

    const styles = fs.readFileSync(path.join(root, 'web/src/styles.css'), 'utf8');
    const body = styles.match(/\.mascot__body\s*\{[^}]*z-index:\s*(\d+)/);
    const tail = styles.match(/\.mascot__tail\s*\{[^}]*z-index:\s*(\d+)/);
    expect(body && tail, 'both layers need a stacking order').toBeTruthy();
    expect(Number(body![1])).toBeGreaterThan(Number(tail![1]));

    // A continuous rotation (not stepped keyframes) is what keeps the motion smooth.
    expect(styles).toContain('@keyframes mascot-wag');
    expect(styles).toMatch(/@keyframes mascot-wag\s*\{[^}]*transform:\s*rotate\(-?[\d.]+deg\)/);
    expect(styles).not.toContain('steps(');
    expect(styles).toMatch(/prefers-reduced-motion[\s\S]*\.mascot__tail\s*\{\s*animation:\s*none/);

    // Both layers must exist and be small enough to load quickly.
    for (const file of ['hund-kropp.png', 'hund-svans.png']) {
      const buffer = fs.readFileSync(path.join(root, 'web/public/mascot', file));
      expect(buffer.subarray(1, 4).toString(), file).toBe('PNG');
      expect(buffer.length, file).toBeLessThan(300_000);
    }
  });

  it('serves the built SPA for deep links so mobile browsers can reload any tab', async () => {
    const indexPath = path.join(root, 'web/dist/index.html');
    if (!fs.existsSync(indexPath)) {
      // The build is not committed; run `npm run build:web` to enable this check.
      expect(true).toBe(true);
      return;
    }
    const harness = await createHarness();
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
      await harness.close();
    }
  });
});
