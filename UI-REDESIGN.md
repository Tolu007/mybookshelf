# Shelf UI redesign

The interface now uses paper surfaces, forest accents, terracotta actions, serif headings, and a shared spacing system. The existing Next.js app and its Supabase/Google Drive data flows remain in place.

## Screens and behavior

- Library: next-chapter panel, shelf navigation, search, sorting, grid/list views, cover fallbacks, and separate book actions.
- Navigation: desktop sidebar, mobile drawer, account footer, theme switching, and keyboard skip link.
- Journal: source-linked note cards, refreshed server results, draft retention after rejected saves, and failed-delete recovery.
- Stats: clearer summaries, reading-calendar panel, and monthly chart. Empty months no longer show positive bars.
- Sign-in and dialogs: consistent typography, form spacing, labels, errors, and loading feedback.
- Readers: responsive controls, accessible button labels, and page shortcuts that ignore dialog inputs. PDF canvas/text-layer positioning is preserved.
- Shared UI: reduced-motion support, matching dark mode, and route loading placeholders.

## Inspiration

[Readwise Reader](https://readwise.io/read) and its [long-form reading layout guidance](https://docs.readwise.io/reader/guides/workflows/longform-reading) informed the emphasis on a calm reading space and visible progress. Shelf's artwork and book fallback treatments are implemented locally with CSS and components.

## Checks

```text
npm run lint
npm run test:ui
npm run build
```

The rendering suite uses the installed TypeScript and React packages; no additional testing dependencies are required. It checks actual component markup, reading links, controls, cover sources, active navigation, empty states, and annotation-location links. It does not exercise browser clicks or real integrations.

No local Supabase/Google environment or connected browser was available during this redesign. Before treating it as end-to-end verified, check desktop/mobile layouts, theme switching, sorting, drawer/menu/dialog interactions, sign-in, uploads, PDF/EPUB reading, annotations, progress, completion, and sign-out against a configured development environment.

The earlier backend recommendations are bookmarked in [REVIEW-BOOKMARK.md](REVIEW-BOOKMARK.md).
