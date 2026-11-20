import { vi } from 'vitest';

/**
 * Default stand-in for `lottie-react` in every unit test file.
 *
 * As soon as `lottie-web` is loaded it starts a 100 ms `setInterval`
 * (`checkReady`). A test file that finishes before the interval first fires
 * tears down jsdom, the timer then throws `ReferenceError: document is not
 * defined`, and Vitest fails the whole job on that unhandled error even
 * though every test passed (#1977). `vi.mock('lottie-web')` in a test file
 * does not help: the app imports only `lottie-react`, which loads `lottie-web`
 * from inside node_modules, where Vitest mocks do not reach.
 *
 * jsdom cannot paint an animation anyway. Tests that look at the animation
 * (`AnimatedIllustration`, `EmptyStateAnimation`) declare their own
 * `vi.mock('lottie-react', …)`, which takes precedence over this one.
 */
vi.mock('lottie-react', () => ({ default: () => null }));
