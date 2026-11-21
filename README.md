# Aster

English · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md)

Aster (`luci-theme-aster`) is a LuCI theme for OpenWrt in the Astryx design language.

## Requirements

OpenWrt 24.10 or 25.12 with `luci-base`.

## Install

Build the package with the SDK for your OpenWrt release as described below. Copy the package to the router and run the matching command from the directory containing the file.

| OpenWrt | Install command |
|---|---|
| 24.10 | `opkg install ./luci-theme-aster_*.ipk` |
| 25.12 | `apk add --allow-untrusted ./luci-theme-aster-*.apk` |

Use `--allow-untrusted` only for a package you trust. Select **Aster** in LuCI under **System → System → Language and Style**. Installation preserves an existing theme selection.

### Building it yourself

Start in the theme source directory. Set `SDK` to the absolute path of an unpacked SDK with the LuCI feed already present. Copy the source rather than symlinking it: the Makefile includes `../../luci.mk`.

```sh
cp -R . "$SDK/feeds/luci/themes/luci-theme-aster"
cd "$SDK"
./scripts/feeds update -i
./scripts/feeds install -p luci luci-theme-aster
make defconfig
make package/luci-theme-aster/compile V=s
```

Look in `bin/packages/<arch>/luci/` for the `.ipk` (24.10) or `.apk` (25.12).

## Palettes

Open the palette menu in the top bar. Rosé Pine, the default, uses Dawn in light mode and Main in dark mode. The other choices are Aster, Relay Blue, Sounding Teal and Herbarium Plum. Switching palettes changes colours, not spacing or components. The browser saves the choice in `aster-palette`, not on the router.

## Settings

LuCI offers three device defaults: `Aster` follows the system colour scheme, `AsterLight` selects light and `AsterDark` selects dark. Use the top bar to override the default for this browser. Light and Dark take precedence; Auto returns to the router’s selection.

## Phone

At 48rem or narrower, the menu button opens navigation in a drawer. Tables respond to their own width rather than the phone breakpoint: when the columns no longer fit their container, each row folds into labelled values.

## Layout

LuCI loads five stylesheets from `htdocs/luci-static/aster/`, in this order:

| File | Role |
|---|---|
| `tokens.css` | Shared design values and palette colours |
| `components.css` | Astryx components for LuCI markup |
| `shell.css` | Top bar, side navigation, page frame and phone drawer |
| `theme.css` | Login screen, links and status colours |
| `luci.css` | LuCI class names and page layouts |

A page’s own stylesheet loads after the theme.

## Login

The login page has its own scheme and palette controls. The password field has a reveal button; the form still submits without JavaScript.

## Translations

English is the source language. The optional theme translations are `luci-i18n-aster-zh-cn` (Simplified Chinese) and `luci-i18n-aster-zh-tw` (Traditional Chinese). Aster only styles LuCI. Text that LuCI or an app leaves untranslated stays untranslated.

## Licence

Aster uses the [Apache License 2.0](LICENSE). The Ray Floret logo and the Relay Blue, Sounding Teal and Herbarium Plum palettes were designed for this project. The [Heroicons 2.2.0 outline icons](LICENSES/heroicons-MIT.txt) and the [Rosé Pine palette](LICENSES/rose-pine-MIT.txt) use the MIT licence. [The palette definitions](design/palettes.mjs) list the Rosé Pine colours adjusted for contrast.
