/**
 * INTEGRATION SEAM for S0's `PracticeSandbox` (fake REST backend, fake Matrix
 * service, fixtures). `PracticeSurface` mounts this while practice mode is
 * active and unmounts it on exit, which is the lifecycle the sandbox needs.
 *
 * The integrator replaces the body with `<PracticeSandbox />` (or re-exports
 * it under this name); nothing else in the practice UI knows about the
 * sandbox. A placeholder on purpose: it renders nothing.
 */
export const PracticeSandboxSlot = (): null => null;
