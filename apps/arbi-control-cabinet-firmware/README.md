# Control cabinet firmware foundation

C11 firmware for Pico 2 W (RP2350 ARM Cortex-M33), with a host wrapper compiling the same bounded receiver, configuration loader and mbedTLS authentication implementation. It has no motor GPIO, STEP/DIR generator, physical stop implementation, Wi-Fi connection or firmware updater. It always reports `Fault` and `actuationInhibited: true`.

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
ARBI_FIRMWARE_HOST_BIN="$PWD/dist/host/firmware-sanitized" node --test scripts/firmware.test.mjs
```

Build identity includes the actual checkout SHA and dirty flag. Host fixtures use test-only key bytes and canonical shared configuration; neither is linked into the Pico image. A configured host test remains inhibited. See the [protocol/enrollment boundary](../../docs/software/pico-foundation.md), [ADR-0023](../../docs/decisions/0023-pico-diagnostic-foundation.md) and [evidence limits](../../docs/evidence/pico-foundation.md). This foundation provides no physical deployment or board-flashing procedure.
