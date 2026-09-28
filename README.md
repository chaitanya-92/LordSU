# LordSU

On-demand Android root manager builder.

LordSU lets a user configure a branded manager in the browser and receive a freshly built APK from an approved KernelSU or KernelSU Next source revision.

## Upstream backends

- KernelSU — https://github.com/tiann/KernelSU
- KernelSU Next — https://github.com/KernelSU-Next/KernelSU-Next

## MVP pipeline

Website → API → queue → isolated builder → branding/configuration → Android build → signing → verification → temporary download → cleanup.

The builder accepts configuration only. It does not expose arbitrary shell commands or arbitrary source execution.

## Development

The first milestone is the builder foundation and UI. The real Android build worker is added after the manager/backend integration is defined.
