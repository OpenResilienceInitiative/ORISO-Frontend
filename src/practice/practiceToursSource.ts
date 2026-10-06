/**
 * The one place the practice UI reads the practice tour definitions from.
 * INTEGRATION SEAM: while S5/S6 are not merged this re-exports the stub; the
 * integrator changes the line to `'./practiceTours'` and deletes
 * `practiceTours.stub.ts`.
 */
export { practiceTours } from './practiceTours.stub';
