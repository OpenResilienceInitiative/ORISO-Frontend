/**
 * `pond.js` is a verbatim port from the design handoff and has no exports: it
 * registers the <oriso-pond> custom element as a side effect and that is all.
 * TypeScript therefore refuses `import('./pond.js')` with "is not a module".
 *
 * This declaration sits next to the file so the dynamic import in
 * `Atmosphere.tsx` type-checks, without editing the port to add an export it
 * does not have. It deliberately declares nothing: there is nothing to use.
 */
export {};
