# Build pipeline

A build is configuration-driven:

1. Validate name, package, backend and approved revision.
2. Validate icon type/size.
3. Enqueue a job in Redis/BullMQ.
4. Worker allocates an isolated workspace.
5. Worker fetches only an approved source/revision.
6. Backend adapter applies supported manager branding.
7. Android project is built using the pinned toolchain.
8. Signing occurs in the isolated signing step.
9. APK signature, package identity and checksum are verified.
10. Artifact is served from temporary storage.
11. Workspace and temporary artifact expire automatically.

The public API must never accept shell commands, arbitrary repository URLs, arbitrary Gradle tasks or arbitrary source archives.
