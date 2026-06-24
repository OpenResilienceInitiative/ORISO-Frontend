// Topic catalogue for the registration "topic selection" step.
//
// The structure intentionally separates *identity* from *presentation*:
//   - `category.id` / `topic.slug` are stable keys used both for i18n lookup
//     (`category.<id>` and `topic.<slug>.title|desc`) and for the icon mapping.
//   - A topic can appear under more than one category (e.g. "HIV und Aids",
//     "Kinder- und Jugend-Reha"). Each *placement* gets a unique selection id
//     (`<categoryId>/<slug>`) but shares the same translation slug, so the label
//     is translated once. Each placement keeps its own per-category icon
//     (the illustrations are tinted to match the category palette).
//
// In production this list would come from the ConsultingType / topic API;
// here it is static so the prototype runs with zero backend.

export interface TopicRow {
  /** Unique selection value for this placement: `<categoryId>/<slug>`. */
  id: string;
  /**
   * Shared topic slug — drives the i18n keys (`topic.<slug>.title|desc`) AND is
   * the unique *backend topic identity*. A topic placed under several categories
   * (e.g. "HIV und Aids", "Kinder- und Jugend-Reha") reuses the same slug, so
   * every placement resolves to one and the same backend topic. The placement
   * `id` (`<categoryId>/<slug>`) is for the UI only (unique React key / row).
   */
  slug: string;
  /** Public path to the 112×112 square-fill icon. */
  icon: string;
}

export interface TopicCategory {
  /** i18n key `category.<id>`. */
  id: string;
  /** Public path to the circular category icon. */
  icon: string;
  topics: TopicRow[];
}

const icon = (file: string) => `${import.meta.env.BASE_URL}icons/${file}`;

function rows(categoryId: string, entries: Array<[slug: string, file: string]>): TopicRow[] {
  return entries.map(([slug, file]) => ({
    id: `${categoryId}/${slug}`,
    slug,
    icon: icon(file),
  }));
}

export const CATEGORIES: TopicCategory[] = [
  {
    id: 'familie',
    icon: icon('cat-01.png'),
    topics: rows('familie', [
      ['eltern-und-familie', 't-01-eltern-und-familie.png'],
      ['kinder-und-jugendliche', 't-01-kinder-und-jugendliche.png'],
      ['kinder-und-jugend-reha', 't-01-kinder-und-jugend-reha.png'],
      ['kuren-fuer-muetter-und-vaeter', 't-01-kuren-fu-r-mu-tter-und-va-ter.png'],
      ['jungen-und-maennerberatung', 't-01-jungen-und-ma-nnerberatung.png'],
      ['schwangerschaft', 't-01-schwangerschaft.png'],
      ['u25-suizidpraevention', 't-01-u25-suizidpra-vention.png'],
    ]),
  },
  {
    id: 'alter',
    icon: icon('cat-02.png'),
    topics: rows('alter', [
      ['leben-im-alter', 't-02-leben-im-alter.png'],
      ['rechtliche-betreuung-und-vorsorge', 't-02-rechtliche-betreuung-und-vorsorge.png'],
      ['hospiz-und-palliativberatung', 't-02-hospiz-und-palliativberatung.png'],
      ['trauerberatung', 't-02-trauerberatung.png'],
    ]),
  },
  {
    id: 'soziales',
    icon: icon('cat-05.png'),
    topics: rows('soziales', [
      ['allgemeine-sozialberatung', 't-05-allgemeine-sozialberatung.png'],
      ['schulden', 't-05-schulden.png'],
      ['straffaelligkeit', 't-05-straffa-lligkeit.png'],
      ['u25-suizidpraevention', 't-05-u25-suizidpra-vention.png'],
      ['rechtliche-betreuung-und-vorsorge', 't-05-rechtliche-betreuung-und-vorsorge.png'],
      ['hiv-und-aids', 't-05-hiv-und-aids.png'],
    ]),
  },
  {
    id: 'gesundheit',
    icon: icon('cat-04.png'),
    topics: rows('gesundheit', [
      ['behinderung-und-psychische-beeintraechtigung', 't-04-behinderung-und-psychische-beeintra-chtigung.png'],
      ['sucht', 't-04-sucht.png'],
      ['hiv-und-aids', 't-04-hiv-und-aids.png'],
      ['kinder-und-jugend-reha', 't-04-kinder-und-jugend-reha.png'],
      ['kuren-fuer-muetter-und-vaeter', 't-04-kuren-fu-r-mu-tter-und-va-ter.png'],
    ]),
  },
  {
    id: 'migration',
    icon: icon('cat-03.png'),
    topics: rows('migration', [
      ['migration', 't-03-migration.png'],
      ['aus-rueck-und-weiterwanderung', 't-03-aus-ru-ck-und-weiterwanderung.png'],
    ]),
  },
];

/** Flattened lookup: selection id → { categoryId, slug }. */
export const TOPIC_INDEX: Record<string, { categoryId: string; slug: string }> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.topics.map((t) => [t.id, { categoryId: c.id, slug: t.slug }])),
);
