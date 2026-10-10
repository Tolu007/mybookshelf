# Shelf review — revisit later

Bookmarked on 11 October 2026 at the user's request. The current task is the UI redesign; the broader backend review remains deferred.

- Make Google refresh tokens accessible only to server code.
- Enforce book ownership for annotations, sessions, progress, and related records in the database.
- Preserve note drafts on failed saves; synchronize journal results after refresh and roll back failed deletes.
- Make offline replay durable, retry transient failures, prevent concurrent queue overwrites, and add idempotency.
- Scope downloaded files and queued requests to the account; clean up appropriately on sign-out.
- Make session/streak and completion updates transactional; handle delayed sessions and reader timezones.
- Add upload recovery, file verification, chunk limits, and orphan cleanup.
- Paginate lists and store resized cover images separately.
- Improve reader loading/error states, input labels, and keyboard behavior.
- Add focused regression tests and CI; replace starter documentation and provide the setup environment template.

These are source-review findings, not confirmation of the deployed database configuration. Review and verify each item before implementing backend changes.

## Addressed during the UI redesign

- The journal now derives its list from refreshed server props and restores notes after failed deletes.
- Note dialogs retain drafts after rejected saves and have labels and character limits.
- Book card controls no longer sit inside reading links; failed favorite/shelf updates roll back.
- Reader controls have accessible labels, a responsive toolbar, and shortcuts that ignore dialog text fields.

The backend access, offline durability, upload recovery, and statistics findings still need their own follow-up.
