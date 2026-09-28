# Build pipeline

Each build is isolated and generated on demand.

1. Validate configuration and allowlisted backend.
2. Create a temporary workspace.
3. Clone only the approved upstream backend/revision.
4. Apply manager name/package configuration.
5. Apply uploaded icon assets.
6. Generate a fresh per-build Android signing identity.
7. Run the upstream manager Gradle release build.
8. Align and sign the resulting APK.
9. Verify the APK signature.
10. Calculate SHA-256.
11. Copy only the verified APK to temporary artifact storage.
12. Return a download URL.
13. Expire build metadata/artifacts after the retention window.

The generated signing key is intentionally not committed to Git. Production persistent project signing requires an authenticated project identity and an explicit key-retention mechanism so future updates remain installable.
