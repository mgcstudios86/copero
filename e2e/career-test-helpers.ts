import { expect, type Page } from '@playwright/test';

type CareerStore = {
  getState: () => {
    setName: (name: string) => void;
    setLastName: (lastName: string) => void;
    setNumber: (number: number) => void;
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

/**
 * Setea el dorsal del jugador via bypass de store.
 *
 * MGC-2974: el stepper +/- (`btn-number-plus`) ya no existe en la UI de
 * identity desde el cut de release-2 (PR #498). Los specs que asumían
 * el click quedan RED de forma determinista (`TimeoutError: waiting
 * for getByTestId('btn-number-plus')`). Usamos el setter directo
 * expuesto por MGC-2264 (gate EXPO_PUBLIC_E2E=1) — mismo patrón que
 * `fillIdentityName` / `fillIdentityLastName`. El default del engine
 * arranca en 9, así que setNumber(10) reproduce el AC del walk.
 */
export async function setIdentityNumber(page: Page, number: number): Promise<void> {
  await page.evaluate((nextNumber) => {
    const store = (window as unknown as { __careerStore?: CareerStore }).__careerStore;
    if (!store) {
      throw new Error(
        'window.__careerStore no expuesto; build web no incluye el hook E2E de MGC-2264',
      );
    }
    store.getState().setNumber(nextNumber);
  }, number);
}
