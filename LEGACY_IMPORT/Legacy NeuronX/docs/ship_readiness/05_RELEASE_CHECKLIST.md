# Release Checklist

## Pre-Release
- [ ] **Sync**: Ensure local `main` is up to date.
- [ ] **CI Status**: Verify that the latest commit on `main` has a green checkmark in GitHub.
- [ ] **Verify**: Run `./scripts/verify-readiness.sh`.
- [ ] **Version**: Determine next version (semver) based on changes.
- [ ] **Changelog**: Update `CHANGELOG.md` with summary of changes.

## Release Execution
1.  **Tag**: `git tag -a v1.2.0 -m "Release v1.2.0"`
2.  **Push**: `git push origin v1.2.0`
3.  **Build**: Wait for CI to build artifacts.

## Post-Release
- [ ] **Monitor**: Check Sentry/Logs for immediate regressions.
- [ ] **Announce**: Notify team on Slack.

## Rollback Plan
If critical failure occurs:
1.  Revert the merge commit on `main`.
2.  Tag the revert as `v1.2.1`.
3.  Deploy `v1.2.1`.
