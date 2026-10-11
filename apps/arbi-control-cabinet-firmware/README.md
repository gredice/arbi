# Control cabinet firmware foundation

C11 firmware for Pico 2 W (RP2350 ARM Cortex-M33), with a host wrapper compiling the same bounded receiver, configuration loader and mbedTLS authentication implementation. An [isolated PIO pulse scheduler](../../docs/software/pulse-scheduler.md) is compiled but disabled in the ordinary image; startup/commands cannot activate motor GPIO. No qualified physical stop, Wi-Fi connection or firmware updater exists. Diagnostic status remains `Fault` with `actuationInhibited: true`.

From the repository root:

```bash
pnpm build --filter @arbi/control-cabinet-firmware
pnpm test --filter @arbi/control-cabinet-firmware
pnpm lint --filter @arbi/control-cabinet-firmware
pnpm typecheck --filter @arbi/control-cabinet-firmware
```

The build produces `dist/pico/arbi_control.elf`, `.bin` and `.uf2`, plus `dist/host/firmware`. Generated output and downloaded tools stay under ignored `dist/`. The first build downloads the pinned SDK, ARM compiler packages and Python CMake/Ninja wheels. Linux x64 bootstrap needs `git`, `curl`, Python/pip, `dpkg-deb`, `cc` and `c++`; it extracts the ARM compiler locally without root or package installation scripts. No production credentials are needed.

Exact versions, SDK/submodule commits and Debian package digests are in [toolchain.json](toolchain.json). `PICO_SDK_PATH`, `PICO_TOOLCHAIN_PATH`, `ARBI_PICO_TOOLS` and `ARBI_PICO_PYTHON_TOOLS` select externally checked tools. Other hosts must supply these pinned tools. In this application directory, host-only compilation is `node scripts/build.mjs --host-only`; sanitized verification is:

```bash
node scripts/build.mjs --host-only --sanitize
ARBI_FIRMWARE_HOST_BIN="$PWD/dist/host/firmware-sanitized" ARBI_PULSE_HOST_BIN="$PWD/dist/host/pulse-sanitized" ARBI_MOTION_HOST_BIN="$PWD/dist/host/motion-sanitized" ARBI_HOMING_HOST_BIN="$PWD/dist/host/homing-sanitized" ARBI_LOCAL_CONTROL_HOST_BIN="$PWD/dist/host/local-control-sanitized" node --test scripts/*.test.mjs
```

Build identity includes the actual checkout SHA and dirty flag. Host fixtures use test-only key bytes and canonical shared configuration; neither is linked into the Pico image. A configured host test remains inhibited. See the [protocol/enrollment boundary](../../docs/software/pico-foundation.md), [ADR-0023](../../docs/decisions/0023-pico-diagnostic-foundation.md) and [evidence limits](../../docs/evidence/pico-foundation.md). This foundation provides no physical deployment or board-flashing procedure.

The [revision-bound geometry model](../../docs/software/motion-geometry.md) checks signed microstep conversion, per-axis travel, every quantized segment estimate and revision changes in the same C core and simulator. Its constant-radius mechanics are synthetic host fixtures; the diagnostic target links no admitted motion profile.

The [input and homing model](../../docs/software/input-homing-model.md) uses labeled digital fixtures, bounded relative homing and latched failure. Every real home/limit/alarm/dock/latch/enable interface remains unavailable; no GPIO circuit or physical HOME/Ready/Parked assertion is introduced.

The [local controller model](../../docs/software/local-controller-recovery.md) adds monotonic expiry, current boot/session/configuration fencing, bounded command IDs, atomic fault signaling, state-dependent simulated responses and deliberate reference recovery. It has no wire admission or physical stop/disable/watchdog adapter; hardware timing and power-loss restraint remain unverified.
