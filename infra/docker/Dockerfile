FROM saschpe/android-ndk:37.0-jdk21.0.11_10-ndk29.0.14206865-cmake4.1.2

ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=/opt/gradle/current/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/build-tools/37.0.0:/opt/android-sdk/cmake/3.22.1/bin:/usr/local/bin:$PATH

RUN apk add --no-cache \
    ca-certificates \
    curl \
    git \
    unzip \
    zip \
    python3 \
    py3-pillow \
    nodejs \
    npm \
    bash \
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
    && ln -s /opt/gradle/gradle-${GRADLE_VERSION} /opt/gradle/current \
    && /opt/gradle/current/bin/gradle --version \
    && rm -f /tmp/gradle.zip

# KernelSU currently resolves CMake 3.22.1 by default. Keep the exact SDK
# version available so Gradle never downloads CMake during an individual build.
RUN if [ ! -x /opt/android-sdk/cmake/3.22.1/bin/cmake ]; then \
      sdkmanager --sdk_root="$ANDROID_SDK_ROOT" "cmake;3.22.1"; \
    fi \
    && test -x /opt/android-sdk/cmake/3.22.1/bin/cmake \
    && /opt/android-sdk/cmake/3.22.1/bin/cmake --version

COPY worker/package.json /opt/lordsu-worker/package.json
RUN npm --prefix /opt/lordsu-worker install --omit=dev \
    && mkdir -p /app/node_modules \
    && cp -a /opt/lordsu-worker/node_modules/. /app/node_modules/

ENV NODE_PATH=/opt/lordsu-worker/node_modules

WORKDIR /app
CMD ["sleep","infinity"]
