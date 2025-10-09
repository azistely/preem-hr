# Conductor Workspace Setup

This workspace was created by Conductor for parallel development work.

## Known Issues

### @react-pdf/renderer Module Resolution

The `@react-pdf/renderer` package may not install properly in the Conductor workspace. If you see an error like:

```
Failed to load external module @react-pdf/renderer
```

**Fix:** Create a symlink to the parent node_modules:

```bash
rm -rf node_modules/@react-pdf/renderer
ln -s /Users/admin/Sites/preem-hr/node_modules/@react-pdf/renderer node_modules/@react-pdf/renderer
```

## Environment Variables

The workspace uses a symlink to the parent `.env.local`:

```bash
ln -sf /Users/admin/Sites/preem-hr/.env.local .env.local
```

This is already set up, but if you encounter Supabase connection errors, verify the symlink exists.

## After Making Changes

Remember to:
1. Restart the dev server after config changes (next.config.ts)
2. Push changes to the main repository, not just this workspace
3. Test in the main repository before merging PRs
