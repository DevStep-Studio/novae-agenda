/**
 * Asserts that the calling code runs strictly in a server environment.
 * Prevents accidental inclusion or execution in client bundles.
 */
export function assertServerOnly(moduleName = "Este módulo"): void {
  if (typeof window !== "undefined") {
    throw new Error(`[Security] ${moduleName} é restrito ao servidor e não pode ser executado no navegador.`);
  }
}
