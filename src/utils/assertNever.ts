// Forces exhaustive switch/if-chains: a new union member that's unhandled fails the build.
export const assertNever = (value: never): never => {
  throw new Error(`Caso no manejado: ${String(value)}`)
}
