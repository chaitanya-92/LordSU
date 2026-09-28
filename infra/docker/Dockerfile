FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=/opt/gradle/current/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/build-tools/37.0.0:/usr/local/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git unzip zip python3 python3-pil nodejs npm openjdk-21-jdk \
    && rm -rf /var/lib/apt/lists/*

ARG CMDLINE_TOOLS_URL=https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip
ARG GRADLE_VERSION=9.7.1
RUN mkdir -p /opt/gradle \
    && for attempt in 1 2 3 4; do \
         rm -f /tmp/gradle.zip; \
         if curl -fL --retry 3 --retry-delay 2 --connect-timeout 20 --max-time 600 "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o /tmp/gradle.zip; then break; fi; \
         echo "Gradle distribution download failed on attempt $attempt; retrying..." >&2; \
         sleep 2; \
       done \
    && test -s /tmp/gradle.zip \
    && unzip -tq /tmp/gradle.zip \
    && unzip -q /tmp/gradle.zip -d /opt/gradle \
    && ln -s /opt/gradle/gradle-${GRADLE_VERSION} /opt/gradle/current \
    && /opt/gradle/current/bin/gradle --version \
    && rm -f /tmp/gradle.zip

RUN mkdir -p $ANDROID_SDK_ROOT/cmdline-tools \
    && curl -fsSL "$CMDLINE_TOOLS_URL" -o /tmp/tools.zip \
    && unzip -q /tmp/tools.zip -d /tmp/tools \
    && mv /tmp/tools/cmdline-tools $ANDROID_SDK_ROOT/cmdline-tools/latest \
    && rm -rf /tmp/tools /tmp/tools.zip \
    && yes | sdkmanager --licenses >/dev/null || true \
    && for spec in \
         "platform-tools|platform-tools" \
         "platforms;android-37.0|platforms/android-37.0" \
         "build-tools;37.0.0|build-tools/37.0.0" \
         "ndk;29.0.14206865|ndk/29.0.14206865"; do \
         package="${spec%%|*}"; \
         target="${spec#*|}"; \
         success=0; \
         for attempt in 1 2 3 4; do \
           rm -rf "$ANDROID_SDK_ROOT/.temp" "$ANDROID_SDK_ROOT/$target"; \
           if sdkmanager --sdk_root="$ANDROID_SDK_ROOT" "$package"; then success=1; break; fi; \
           echo "SDK package $package failed on attempt $attempt; retrying..." >&2; \
           sleep 2; \
         done; \
         if [ "$success" -ne 1 ]; then \
           echo "Failed to install SDK package $package after 4 attempts" >&2; exit 1; \
         fi; \
       done

COPY worker/package.json /opt/lordsu-worker/package.json
RUN npm --prefix /opt/lordsu-worker install --omit=dev     && mkdir -p /app/node_modules     && cp -a /opt/lordsu-worker/node_modules/. /app/node_modules/

ENV NODE_PATH=/opt/lordsu-worker/node_modules

WORKDIR /app
CMD ["sleep","infinity"]
