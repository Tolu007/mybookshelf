# Shelf UI redesign

The interface follows the Stitch "personal reading hub and journal" designs: two themes from one system. **Editorial Sanctuary** (light) uses vellum surfaces, carbon ink, forest-green actions and an amber ribbon. **Obsidian Sanctuary** (dark) uses obsidian slate, parchment text and brass amber. Titles and prose use Newsreader; controls, labels and numbers use Plus Jakarta Sans. The Supabase and Google Drive data flows are unchanged.

## Tokens

Colours live in `src/app/globals.css` as CSS variables, redefined under `.dark`. Beyond the shadcn set:

- `sage`: text-safe forest green for links, icons and labels. `primary` is the button fill, which is too dark to read as text in the dark theme.
- `ribbon` / `amber`: amber fill (progress, badges) and text-safe amber.
- `well`: recessed frames behind covers and inputs.
- `.surface`, `.surface-lift`, `.eyebrow`, `.meta`, `.tag`: shared card, hover, label and chip styles.

## Screens

- **Frame:** a sidebar with upload, Shelf, Active reader, Statistics, Journal and Settings. On desktop it collapses to an icon rail; the choice is kept in the `shelf-sidebar` cookie so the server renders the right width. On mobile it opens as a drawer from the top bar, which also holds search, the streak and the account menu.
- **Library:** greeting, daily quote, currently reading cards, format/shelf/sort filters, and one shelf per category (grid or list).
- **Journal:** an inline writing desk (standalone or linked to a book), tabs for all / in-book / standalone / highlights, and books ranked by entries.
- **Reader:** focus timer, today's goal, reading controls, a page card sized to the chosen column width, and a progress ribbon. EPUB typography comes from Settings.
- **Statistics:** goal, time, month, week and streak tiles, the yearly heatmap with summary figures, and monthly hours with the peak month in amber.
- **Settings:** reader typography with a live preview, theme, and daily/yearly goals, saved to `user_preferences`.
- **Sign-in:** brand panel and Google sign-in, with only claims that are true of Shelf.

Features shown in the Stitch screens but not built yet are listed in [FEATURE-BACKLOG.md](FEATURE-BACKLOG.md).

## Checks

```text
npm run lint
npm run test:ui
npm run build
```

The rendering suite compiles the actual components and checks their markup, links, controls and helpers. It does not click through a browser or reach Supabase or Google Drive. Before treating a change as verified end to end, check desktop and mobile layouts in both themes, sidebar collapse, the drawer, uploads, PDF and EPUB reading, annotations, journal entries, settings and sign-out against a configured environment.

The earlier backend recommendations are bookmarked in [REVIEW-BOOKMARK.md](REVIEW-BOOKMARK.md).
