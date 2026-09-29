# Android toolchain: Linux amd64 + JDK 21 + SDK 37 + NDK 29.
FROM saschpe/android-ndk:37.0-jdk21.0.11_10-ndk29.0.14206865-cmake4.1.2

USER root

ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_HOME=/opt/android-sdk-linux
ENV ANDROID_SDK_ROOT=/opt/android-sdk-linux
ENV PATH=/opt/gradle/current/bin:/opt/android-sdk-linux/cmdline-tools/latest/bin:/opt/android-sdk-linux/platform-tools:/opt/android-sdk-linux/build-tools/37.0.0:/opt/android-sdk-linux/cmake/3.22.1/bin:/usr/local/bin:$PATH

RUN mkdir -p /var/lib/apt/lists/partial \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates curl git unzip zip python3 python3-pil nodejs npm bash \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

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

# The base image supplies the Android SDK/NDK/JDK toolchain. Install only
# the legacy CMake version required by the current KernelSU manager.
RUN yes | sdkmanager --sdk_root="$ANDROID_SDK_ROOT" --licenses >/dev/null 2>&1 || true \
    && sdkmanager --sdk_root="$ANDROID_SDK_ROOT" "cmake;3.22.1" \
    && test -x "$ANDROID_SDK_ROOT/cmake/3.22.1/bin/cmake" \
    && "$ANDROID_SDK_ROOT/cmake/3.22.1/bin/cmake" --version

COPY worker/package.json /opt/lordsu-worker/package.json
RUN npm --prefix /opt/lordsu-worker install --omit=dev \
    && mkdir -p /app/node_modules \
    && cp -a /opt/lordsu-worker/node_modules/. /app/node_modules/

ENV NODE_PATH=/opt/lordsu-worker/node_modules

COPY worker/src /app/worker/src
COPY builder/src /app/builder/src
COPY builder/package.json /app/builder/package.json

WORKDIR /app
CMD ["sleep","infinity"]
