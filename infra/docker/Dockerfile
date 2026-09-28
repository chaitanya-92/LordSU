FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/build-tools/37.0.0:/usr/local/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git unzip zip python3 python3-pil nodejs npm openjdk-21-jdk \
    && rm -rf /var/lib/apt/lists/*

ARG CMDLINE_TOOLS_URL=https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip
RUN mkdir -p $ANDROID_SDK_ROOT/cmdline-tools \
    && curl -fsSL "$CMDLINE_TOOLS_URL" -o /tmp/tools.zip \
    && unzip -q /tmp/tools.zip -d /tmp/tools \
    && mv /tmp/tools/cmdline-tools $ANDROID_SDK_ROOT/cmdline-tools/latest \
    && rm -rf /tmp/tools /tmp/tools.zip \
    && yes | sdkmanager --licenses >/dev/null || true \
    && sdkmanager --install "platform-tools" "platforms;android-37.0" "build-tools;37.0.0" "ndk;29.0.14206865"

COPY worker/package.json /opt/lordsu-worker/package.json
RUN npm --prefix /opt/lordsu-worker install --omit=dev

ENV NODE_PATH=/opt/lordsu-worker/node_modules

WORKDIR /app
CMD ["sleep","infinity"]
