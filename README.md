# LuCI FanControl

LuCI application and OpenWrt packaging for [openwrt-fancontrol](https://github.com/shizzz/openwrt-fancontrol).

Provides a web interface to configure, monitor, and manage PWM fan control on OpenWrt 24.x–25.x. The Go controller binary is downloaded automatically during package build from upstream GitHub releases.

## Features

- **Dashboard** — live temperature and PWM readings from sysfs, refreshed every second
- **Live charts** — rolling temperature and PWM history per fan (client-side canvas charts)
- **Fan editor** — full UCI configuration with PID and fixed PWM modes
- **Add fan wizard** — discovers thermal zones and hwmon PWM outputs under `/sys`
- **Validation** — checks sysfs paths and write permissions before saving, with optional force override
- **Service management** — start/stop/restart and boot enable/disable via procd init script

## Packages

| Package | Description |
|---------|-------------|
| `fancontrol` | Init script and architecture-specific `openwrt-fancontrol` binary |
| `luci-app-fancontrol` | LuCI web interface (architecture-independent) |

## UCI configuration

Each fan is a named section:

```uci
config fancontrol 'cpu'
    option enabled '1'
    option mode 'pid'
    option setpoint '60'
    option kp '2.0'
    option ki '0.5'
    option kd '1.0'
    option min_pwm '50'
    option max_pwm '255'
    option interval_sec '1.0'
    option thermal_path '/sys/class/thermal/thermal_zone0/temp'
    option pwm_path '/sys/class/hwmon/hwmon0/pwm1'
    option pwm_enable_path '/sys/class/hwmon/hwmon0/pwm1_enable'
    option dry_run '0'
    option debug '0'
```

Global options (including validation `force`) live in:

```uci
config globals 'globals'
    option force '0'
```

## Building locally

Add this repository as an OpenWrt feed, then build:

```sh
./scripts/feeds update -a
./scripts/feeds install luci-app-fancontrol
make package/fancontrol/compile V=s
make package/luci-app-fancontrol/compile V=s
```

The `fancontrol` package resolves the correct upstream release asset for the selected target `ARCH` using `scripts/select-fancontrol-arch.sh`.

Upstream binary version is controlled by `FANCONTROL_UPSTREAM_VERSION` in `fancontrol/Makefile`.

## GitHub Actions

- **`develop` branch** — builds packages for `aarch64` on every push; uploads `.ipk` and `.apk` artifacts
- **`v*` tags** — discovers all architectures published in the matching upstream fancontrol release, builds packages for each, and publishes a GitHub Release

## Project layout

```
fancontrol/                 # Binary package (init script, downloaded binary)
luci-app-fancontrol/        # LuCI application (views, ACL, menu)
scripts/                    # Architecture resolution helpers
.github/workflows/          # CI build and release automation
```

## Status sources

The LuCI UI does not communicate with the Go process directly. Monitoring and validation use:

- **sysfs** — temperature and PWM readings
- **UCI** — configuration
- **init.d / procd** — service state

## License

GPL-2.0-or-later
