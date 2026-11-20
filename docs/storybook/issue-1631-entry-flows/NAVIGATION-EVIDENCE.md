# Entry hierarchy evidence — issue 1631

Local Storybook only. No hosted Storybook or Dev acceptance is claimed.

12-before-entry-hierarchy.png is the user's reported sidebar, where Live chat stood separately from Registration.12-after-entry-hierarchy.png is an actual combined local preview capture after grouping Entry flows. Its shown loading animation belongs to the separate loading package; this PR owns navigation metadata and the overview. The hierarchy is unchanged in the final accepted source0b3119bb.

overview-link-check.json was checked against the actual final local preview index. All88 links resolve to78 unique story/docs identifiers. Original URL identifiers are explicitly retained when collection titles move. Six added destinations belong to the consent/footer package, so this PR must merge after that package. Its standalone static build can succeed while those six future destinations are absent; the combined integration index is the link-completeness proof.

No runtime UI component is changed by this navigation package. Three collections whose metadata touches functional story changes move with the consent/footer package to avoid merge conflicts; this PR completes the unified hierarchy and overview. The real three-way union of all delivery branches was verified conflict-free and identical to the accepted source tree.

## Reproduce

```bash
npm run test:unit
npm run lint:scripts
npm run lint:style
npm run build
npm run build-storybook
```

After the consent/footer PR is included, open Entry flows / Overview. Every desktop, mobile, tablet and dialog link should open its existing variant with the preserved URL.
