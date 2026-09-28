# Release and signing

Every generated manager should have an explicit signing identity.

Rules:
- Never commit a keystore or private key.
- Never expose the signing secret to the web process.
- Perform signing in an isolated build/signing step.
- Verify the APK after signing.
- Record the certificate fingerprint with the build metadata.
- For repeat builds of the same manager identity, reuse the same signing identity only when the user has an authenticated project identity and key-retention policy.

The MVP may use a disposable per-build signing identity for test builds. Production releases need persistent project identities so Android update compatibility is preserved.
