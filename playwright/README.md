# Playwright smoke checks

## Deployed registration demo baseline

Run the demo baseline check against a deployed app URL:

```sh
PLAYWRIGHT_BASE_URL=https://app.oriso.org npm run test:smoke:baseline
```

The check derives the API origin from the app origin by replacing `app.` with
`api.`. Override it for non-standard environments:

```sh
PLAYWRIGHT_BASE_URL=https://app.oriso.org \
PLAYWRIGHT_API_BASE_URL=https://api.oriso.org \
npm run test:smoke:baseline
```

It verifies the standard demo registration path for postcode `88885`,
consulting type `1`, and topics `10` (`Eltern und Familie`) and `2`
(`Kinder und Jugendliche`). Failures distinguish API errors, empty agency
responses, wrong UI-selected topic ids, and missing rendered agency cards.
