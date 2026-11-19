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

## Licence

Apache-2.0, see `LICENSE`. The Lucide icons are ISC, see
`LICENSES/lucide-ISC.txt`.
