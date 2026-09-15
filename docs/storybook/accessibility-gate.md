# Accessibility enforcement in component tests

The Storybook Vitest setup explicitly registers `@storybook/addon-a11y/preview`
before the application preview annotations. Calling `setProjectAnnotations`
ourselves prevents the Vitest addon from supplying missing addon annotations.
`a11y.test: 'error'` alone does not install the axe hook.

Run `npm run test:storybook:a11y-gate` to verify the integration. The script
creates temporary stories in the existing component story glob and runs the
real Storybook Vitest project. It requires low contrast, an unnamed button and
an image without alternative text to fail for their specific axe rules, while
an accessible button passes. It cleans up its fixtures and report afterward.
A missing addon, a rendering error or four passing stories fails the guard.
CI runs this guard before the full component suite.

Run `npm run test:storybook` for the existing stories. Real accessibility
violations remain failures; do not switch the global policy to `todo` or `off`
to obtain a green run. The runner stops at the first failing shard. To inventory
all failures during triage, run each of its four shards explicitly:

```sh
for shard in 1 2 3 4; do
  node node_modules/vitest/vitest.mjs run --project storybook \
    --maxWorkers=2 --minWorkers=1 --shard="$shard/4" \
    --reporter=json --outputFile="/tmp/storybook-a11y-$shard.json"
done
```

These checks use real browser rendering and axe. Passing them does not certify
full WCAG compliance or replace manual keyboard and assistive-technology tests.
