/** True after the first client layout effect — gates sessionStorage reads during SSR. */
let clientHydrated = false;

export function isClientHydrated(): boolean {
  return clientHydrated;
}

export function markClientHydrated(): void {
  clientHydrated = true;
}
