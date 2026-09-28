# LordSU Architecture

## Product

LordSU is a manager builder, not a replacement root implementation.

A user selects:
- manager name
- icon
- package name
- approved backend
- approved backend revision

The server creates a build job and an isolated worker generates the APK.

## Backend abstraction

The manager should communicate with a backend adapter rather than depend on the original upstream Manager APK.

Supported backend targets:
- KernelSU
- KernelSU Next

## Build isolation

Each build gets a temporary isolated workspace/container. User-provided values are configuration only.

Pipeline:
1. Validate configuration.
2. Resolve approved source revision.
3. Create isolated workspace.
4. Apply supported branding/configuration.
5. Build.
6. Sign.
7. Verify.
8. Publish temporary download.
9. Cleanup.

Signing keys never live in Git.
