FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/build-tools/35.0.0:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git unzip zip python3 python3-pil openjdk-17-jdk && rm -rf /var/lib/apt/lists/*
ARG CMDLINE_TOOLS_URL
RUN mkdir -p $ANDROID_SDK_ROOT/cmdline-tools && if [ -n "$CMDLINE_TOOLS_URL" ]; then curl -fsSL "$CMDLINE_TOOLS_URL" -o /tmp/tools.zip && unzip -q /tmp/tools.zip -d /tmp/tools && mv /tmp/tools/cmdline-tools $ANDROID_SDK_ROOT/cmdline-tools/latest && rm -rf /tmp/tools /tmp/tools.zip; fi
WORKDIR /workspace
CMD ["sleep","infinity"]
