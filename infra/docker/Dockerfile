FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git unzip zip openjdk-17-jdk && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
# Pin Android SDK command-line tools and build-tools before production deployment.
CMD ["sleep","infinity"]
