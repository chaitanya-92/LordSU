# Local development

Prerequisites:
- Docker
- Docker Compose
- Git

Start the API, Redis and web UI:

    docker compose up

The web UI is available on port 3000 and the API on port 4000.

The production Android builder is separate because it needs a pinned Android SDK/JDK/NDK image. Do not expose the builder container directly to the public internet.
