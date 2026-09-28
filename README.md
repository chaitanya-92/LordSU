# LordSU

On-demand Android Root Manager Builder.

## Project
LordSU is a web-based builder that generates independently branded Android root-manager APKs from approved KernelSU / KernelSU Next source revisions.

## MVP
- Web builder form
- KernelSU / KernelSU Next backend selection
- Build job API
- Queue-ready architecture
- Isolated Docker build worker
- Temporary APK delivery
- Cryptographic verification
- Per-manager build configuration

## Safety and integrity
Builds are restricted to approved source revisions and predefined build parameters. User input is configuration only; arbitrary source code or shell commands are not accepted.

## Status
MVP foundation.
