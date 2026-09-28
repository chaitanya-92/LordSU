# LordSU builder

This is the controlled build adapter.

For each job it:
- selects one of the two allowlisted upstream repositories;
- checks out the approved branch/revision;
- builds the upstream manager project;
- passes the manager name and package name as Gradle properties;
- returns a generated APK and SHA-256.

It never accepts arbitrary repository URLs or arbitrary shell commands.

Icon branding is a separate deterministic preprocessing step and will be enabled after the resource layouts for both backend families are normalized.
