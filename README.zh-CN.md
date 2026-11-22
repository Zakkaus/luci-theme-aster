<div align="center">

<img src="htdocs/luci-static/aster/logo.svg" width="96" alt="Aster">

# Aster

[English](README.md) · 简体中文 · [繁體中文](README.zh-TW.md)

Aster（`luci-theme-aster`）是 OpenWrt 的 LuCI 主题，采用 Astryx 设计语言。

[运行环境](#运行环境) • [安装](#安装) • [配色](#配色) • [设置](#设置) • [手机](#手机) • [样式分层](#样式分层) • [登录页](#登录页)

</div>

![概览](docs/screenshots/zh-CN/rose-pine-overview-light.png)

## 运行环境

OpenWrt 24.10 或 25.12，依赖 `luci-base`。

## 安装

先按下节说明，用与路由器系统版本对应的 SDK 编译主题。把生成的软件包复制到路由器，在软件包所在目录执行对应的命令：

| OpenWrt 版本 | 安装命令 |
|---|---|
| 24.10 | `opkg install ./luci-theme-aster_*.ipk` |
| 25.12 | `apk add --allow-untrusted ./luci-theme-aster-*.apk` |

仅对来源可信的软件包使用 `--allow-untrusted`。安装时不会替换已选的主题。要启用 Aster，请在 LuCI 的**系统 → 系统 → 语言和界面**中选择 **Aster**。

### 自行编译

在主题源码目录执行以下命令。先将 `SDK` 设为 SDK 解压后的绝对路径，并确认 SDK 中已有 LuCI feed。主题的 Makefile 通过 `../../luci.mk` 引入编译规则，因此要复制源码，不能用符号链接代替。

```sh
cp -R . "$SDK/feeds/luci/themes/luci-theme-aster"
cd "$SDK"
./scripts/feeds update -i
./scripts/feeds install -p luci luci-theme-aster
make defconfig
make package/luci-theme-aster/compile V=s
```

软件包位于 `bin/packages/<arch>/luci/`。24.10 生成 `.ipk`，25.12 生成 `.apk`。

## 配色

在顶栏的配色菜单中可以选择五套配色。默认的 Rosé Pine 在浅色模式下使用 Dawn，深色模式下使用 Main。其余四套为 Aster、Relay Blue、Sounding Teal 和 Herbarium Plum。切换配色只改变颜色，组件和间距不变。浏览器将选择保存在本地的 `aster-palette` 中，不写入路由器。

| 配色 | 浅色 | 深色 |
|---|---|---|
| **Rosé Pine（默认）** | <img src="docs/screenshots/zh-CN/rose-pine-overview-light.png" width="380"> | <img src="docs/screenshots/zh-CN/rose-pine-overview-dark.png" width="380"> |
| **Aster** | <img src="docs/screenshots/zh-CN/aster-overview-light.png" width="380"> | <img src="docs/screenshots/zh-CN/aster-overview-dark.png" width="380"> |
| **Relay Blue** | <img src="docs/screenshots/zh-CN/relay-overview-light.png" width="380"> | <img src="docs/screenshots/zh-CN/relay-overview-dark.png" width="380"> |
| **Sounding Teal** | <img src="docs/screenshots/zh-CN/teal-overview-light.png" width="380"> | <img src="docs/screenshots/zh-CN/teal-overview-dark.png" width="380"> |
| **Herbarium Plum** | <img src="docs/screenshots/zh-CN/plum-overview-light.png" width="380"> | <img src="docs/screenshots/zh-CN/plum-overview-dark.png" width="380"> |

<img src="docs/screenshots/zh-CN/realtime-light.png" width="420"> <img src="docs/screenshots/zh-CN/realtime-dark.png" width="420">

## 设置

LuCI 中的主题决定默认模式：`Aster` 跟随系统，`AsterLight` 固定为浅色，`AsterDark` 固定为深色。要单独更改当前浏览器的显示模式，在顶栏选择浅色或深色即可。选回自动模式后，浏览器重新采用路由器上的设置。

<img src="docs/screenshots/zh-CN/system-light.png" width="420"> <img src="docs/screenshots/zh-CN/system-dark.png" width="420">

## 手机

屏幕宽度不超过 48rem 时，点菜单按钮即可打开侧边导航。表格是否折叠取决于容器宽度，而不是屏幕宽度。如果一行排不下，各列就按标签和值分行显示。

| 浅色 | 深色 |
|---|---|
| <img src="docs/screenshots/zh-CN/phone-light.png" width="280"> | <img src="docs/screenshots/zh-CN/phone-dark.png" width="280"> |

## 样式分层

LuCI 依次加载 `htdocs/luci-static/aster/` 下的五份样式表：

| 文件 | 用途 |
|---|---|
| `tokens.css` | 共用的样式变量和各套配色的色值 |
| `components.css` | 适配 LuCI 标记结构的 Astryx 组件 |
| `shell.css` | 顶栏、侧边导航、页面框架和手机导航抽屉 |
| `theme.css` | 登录页、链接和状态颜色 |
| `luci.css` | 将组件样式应用到 LuCI 类名，编排页面布局 |

页面自带的样式表在主题样式之后加载。

<img src="docs/screenshots/zh-CN/nav-dark.png" width="420"> <img src="docs/screenshots/zh-CN/firewall-dark.png" width="420">

## 登录页

登录前也可以切换配色和明暗模式。密码框旁的按钮可显示或隐藏密码。即使禁用 JavaScript，登录表单仍可提交。

<img src="docs/screenshots/zh-CN/login-light.png" width="420"> <img src="docs/screenshots/zh-CN/login-dark.png" width="420">

## 翻译

主题的原文为英文。简体中文语言包为 `luci-i18n-aster-zh-cn`，繁体中文语言包为 `luci-i18n-aster-zh-tw`，按需安装。Aster 只改变 LuCI 的外观；LuCI 或应用未翻译的文字仍显示原文。

## 许可

Aster 采用 [Apache License 2.0](LICENSE)。Ray Floret 标志以及 Relay Blue、Sounding Teal 和 Herbarium Plum 三套配色均为本项目设计。[Heroicons 2.2.0 线框图标](LICENSES/heroicons-MIT.txt)和 [Rosé Pine 配色](LICENSES/rose-pine-MIT.txt)采用 MIT 许可证。为提高对比度而调整的 Rosé Pine 色值见[配色定义](design/palettes.mjs)。
