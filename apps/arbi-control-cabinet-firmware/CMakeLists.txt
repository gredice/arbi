cmake_minimum_required(VERSION 3.31)
include($ENV{PICO_SDK_PATH}/external/pico_sdk_import.cmake OPTIONAL)
if(NOT COMMAND pico_sdk_init)
  include(${PICO_SDK_PATH}/external/pico_sdk_import.cmake)
endif()
project(arbi_control C CXX ASM)
set(CMAKE_C_STANDARD 11)
pico_sdk_init()
# The application is C11. Do not pull the SDK's optional C++ allocation wrapper.
set_property(TARGET pico_cxx_options PROPERTY INTERFACE_SOURCES "")
option(ARBI_ISOLATED_PULSE_BENCH "Compile the separately authorized unloaded pulse-fixture adapter" OFF)
add_executable(arbi_control src/main.c src/json.c src/auth.c src/runtime.c src/pulse.c src/pulse_pio.c src/motion.c src/inputs.c src/homing.c
  ${PICO_SDK_PATH}/lib/mbedtls/library/sha256.c
  ${PICO_SDK_PATH}/lib/mbedtls/library/platform_util.c)
set_target_properties(arbi_control PROPERTIES LINKER_LANGUAGE C)
target_include_directories(arbi_control PRIVATE include dist/generated ${PICO_SDK_PATH}/lib/mbedtls/include)
target_compile_definitions(arbi_control PRIVATE MBEDTLS_CONFIG_FILE="arbi_mbedtls_config.h"
  ARBI_ISOLATED_PULSE_BENCH=$<BOOL:${ARBI_ISOLATED_PULSE_BENCH}>
  PICO_STDIO_USB_ENABLE_RESET_VIA_BAUD_RATE=0 PICO_STDIO_USB_ENABLE_RESET_VIA_VENDOR_INTERFACE=0
  PICO_STDIO_USB_CONNECTION_WITHOUT_DTR=0)
target_compile_options(arbi_control PRIVATE -Wall -Wextra -Werror -Wstack-usage=4096)
target_link_libraries(arbi_control pico_stdlib pico_unique_id pico_rand hardware_watchdog hardware_pio hardware_dma m)
pico_generate_pio_header(arbi_control ${CMAKE_CURRENT_LIST_DIR}/src/pulse.pio)
pico_enable_stdio_usb(arbi_control 1)
pico_enable_stdio_uart(arbi_control 0)
pico_add_extra_outputs(arbi_control)
if(ARBI_ISOLATED_PULSE_BENCH)
  # Retain the actual planner/queue/DMA functions through the target linker.
  # The normal diagnostic main intentionally has no call into these adapters.
  add_executable(arbi_pulse_link_check test/target-link.c src/pulse.c src/pulse_pio.c src/motion.c src/inputs.c src/homing.c)
  set_target_properties(arbi_pulse_link_check PROPERTIES LINKER_LANGUAGE C)
  target_include_directories(arbi_pulse_link_check PRIVATE include)
  target_compile_definitions(arbi_pulse_link_check PRIVATE ARBI_ISOLATED_PULSE_BENCH=1)
  target_compile_options(arbi_pulse_link_check PRIVATE -Wall -Wextra -Werror -Wstack-usage=4096)
  target_link_libraries(arbi_pulse_link_check pico_stdlib hardware_pio hardware_dma m)
  pico_generate_pio_header(arbi_pulse_link_check ${CMAKE_CURRENT_LIST_DIR}/src/pulse.pio)
endif()
