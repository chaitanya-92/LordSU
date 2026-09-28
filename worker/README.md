# LordSU Build Worker

Consumes validated jobs and executes the predefined Android build pipeline inside an isolated container.

Pipeline:
1. Validate backend and approved revision.
2. Create temporary workspace.
3. Materialize selected source.
4. Apply supported branding/configuration.
5. Run Android build.
6. Sign through the signing subsystem.
7. Verify APK, package identity, certificate and checksum.
8. Publish temporary download.
9. Clean workspace and expire artifact.

The worker must never execute arbitrary user-supplied shell commands.
