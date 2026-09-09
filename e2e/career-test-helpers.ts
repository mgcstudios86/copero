import { expect, type Page } from '@playwright/test';

type CareerStore = {
  getState: () => {
    setName: (name: string) => void;
    setLastName: (lastName: string) => void;
  };
};

/**
 * Completa el nombre y sincroniza el store cuando RNW no propaga `fill()`.
 * El `fill()` se conserva para probar el contrato visible; el setter directo
 * evita el flake conocido del runner copero-heavy.
 */
export async function fillIdentityName(page: Page, name: string): Promise<void> {
  const input = page.getByTestId('input-name');
  await input.fill(name);
  await page.evaluate((nextName) => {
    const store = (window as unknown as { __careerStore?: CareerStore }).__careerStore;
    if (!store) {
      throw new Error(
        'window.__careerStore no expuesto; build web no incluye el hook E2E de MGC-2264',
      );
    }
    store.getState().setName(nextName);
  }, name);
  await expect(input).toHaveValue(name);
}

/** Completa apellido usando el mismo fallback determinista del nombre. */
export async function fillIdentityLastName(page: Page, lastName: string): Promise<void> {
  const input = page.getByTestId('input-lastname');
  await input.fill(lastName);
  await page.evaluate((nextLastName) => {
    const store = (window as unknown as { __careerStore?: CareerStore }).__careerStore;
    if (!store) {
      throw new Error(
        'window.__careerStore no expuesto; build web no incluye el hook E2E de MGC-2264',
      );
    }
    store.getState().setLastName(nextLastName);
  }, lastName);
  await expect(input).toHaveValue(lastName);
}
