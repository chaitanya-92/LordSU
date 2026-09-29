# Android toolchain is supplied by a prebuilt amd64 image. The final runtime
# deliberately uses Debian so its package manager and Node runtime are stable.
FROM saschpe/android-ndk:37.2-jdk25.0.4_7-ndk30.0.16248370-cmake4.1.2 AS android

FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV JAVA_HOME=/opt/java
ENV PATH=/opt/gradle/current/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/build-tools/37.0.0:/opt/android-sdk/cmake/3.22.1/bin:/usr/local/bin:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates curl git unzip zip python3 python3-pil openjdk-21-jdk bash \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

COPY --from=android /opt/android-sdk /opt/android-sdk

ARG GRADLE_VERSION=9.7.1
RUN mkdir -p /opt/gradle \
    && success=0; \
       for attempt in 1 2 3 4; do \
         rm -f /tmp/gradle.zip; \
         if curl -fL --retry 3 --retry-delay 2 --connect-timeout 20 --max-time 600 \
            "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o /tmp/gradle.zip \
            && test -s /tmp/gradle.zip \
            && unzip -tq /tmp/gradle.zip; then \
           success=1; break; \
         fi; \
         echo "Gradle distribution download/archive validation failed on attempt $attempt; retrying..." >&2; \
         sleep 2; \
       done; \
       test "$success" -eq 1 \
    && unzip -q /tmp/gradle.zip -d /opt/gradle \
    && ln -sfn /opt/gradle/gradle-${GRADLE_VERSION} /opt/gradle/current \
    && /opt/gradle/current/bin/gradle --version \
    && rm -f /tmp/gradle.zip

# KernelSU's native build currently asks Gradle for CMake 3.22.1.
# The prebuilt image already supplies the SDK/NDK; install only this missing
# CMake version instead of downloading the entire Android toolchain.
RUN sdkmanager --sdk_root="$ANDROID_SDK_ROOT" "cmake;3.22.1" \
    && test -x /opt/android-sdk/cmake/3.22.1/bin/cmake \
    && /opt/android-sdk/cmake/3.22.1/bin/cmake --version

COPY worker/package.json /opt/lordsu-worker/package.json
RUN npm --prefix /opt/lordsu-worker install --omit=dev \
    && mkdir -p /app/node_modules \
    && cp -a /opt/lordsu-worker/node_modules/. /app/node_modules/

ENV NODE_PATH=/opt/lordsu-worker/node_modules

WORKDIR /app
CMD ["sleep","infinity"]
