# Build note

`npx tsc --noEmit` and `npx eslint "src/app/(gym)"` both pass.

The shared `CredentialsReveal` component is reused for staff passwords. It contains owner-specific wording in its static warning; adapting that wording for staff would require editing `src/app/admin/gyms/credentials-reveal.tsx`, also outside the allowed paths.

## Website editor media cleanup

The editor removes images from the draft and published site, but cannot safely delete the backing storage files with the current `deleteSiteImageAction`. That action accepts only IDs still referenced in the persisted site. Calling it before a successful publish risks breaking the live page if publishing fails; calling it afterward rejects the now-detached ID. Uploads discarded before publishing can also leave an unused file. A server action that atomically publishes and cleans up removed image IDs, or a separate authorized orphan-cleanup path, is needed to reclaim these files.
