# Local development

Install Docker and Docker Compose, then:

    docker compose build worker
    docker compose up

Open http://localhost:3000.

The worker image contains the Android command-line tools, Android 37 platform/build-tools and NDK 29 required by the current KernelSU manager build configuration. The Android command-line tools package is downloaded from Google's official Android developer distribution.

The production deployment should use pinned image digests, private artifact storage, authenticated API access, build concurrency limits and a separate signing boundary.
