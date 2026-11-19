# Aster

`luci-theme-aster` is a LuCI theme for OpenWrt 24.10 and 25.12. This
repository is at its first milestone: the package skeleton is a copy of
`luci-theme-graphite` with every identifier renamed, so the theme still looks
like Graphite's default palette. The Astryx look, the new icons and the full
README come in later milestones.

## Building

`Makefile` reaches `luci.mk` through `../../luci.mk`, so the package must be
copied into the LuCI feed of an OpenWrt SDK. A symlink does not work.

```sh
cp -r luci-theme-aster <sdk>/feeds/luci/themes/
cd <sdk>
./scripts/feeds update -i
./scripts/feeds install -p luci luci-theme-aster
make defconfig
make package/luci-theme-aster/compile V=s
```

The packages land in `bin/packages/<arch>/luci/`: an `.ipk` from the 24.10 SDK
and an `.apk` from the 25.12 SDK.

## Palettes

Five colour palettes, chosen per browser from the palette menu in the top
bar (in the drawer on a phone): Aster (the default), Relay Blue, Sounding
Teal, Herbarium Plum and Rosé Pine (Dawn in light mode, Main in dark). Each
works in light, dark and auto mode. The choice is kept in the browser's
`localStorage` (`aster-palette`), not on the router. Only colours change
between palettes; components and spacing stay the same.

## Credits

The logo (Ray Floret) and the Relay, Teal and Plum palettes were designed
for this project. The Rosé Pine palette is Rosé Pine's
(https://rosepinetheme.com), MIT, see `LICENSES/rose-pine-MIT.txt`; the few
colours moved for contrast are listed in `design/palettes.mjs`.

## Licence

Apache-2.0, see `LICENSE`. The icons are Heroicons 2.2.0 outline
(https://github.com/tailwindlabs/heroicons, taken from the `@heroicons/react`
2.2.0 package), MIT, see `LICENSES/heroicons-MIT.txt`.
