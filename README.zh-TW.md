# Aster

[English](README.md) · [简体中文](README.zh-CN.md) · 繁體中文

Aster（`luci-theme-aster`）是 OpenWrt 的 LuCI 主題，採用 Astryx 設計語言。

## 系統需求

適用於 OpenWrt 24.10 與 25.12，需安裝 `luci-base`。

## 安裝

依下一節的步驟，使用對應 OpenWrt 版本的 SDK 建置套件。將套件複製到路由器後，在套件所在的目錄執行安裝指令：

| OpenWrt 版本 | 安裝指令 |
|---|---|
| 24.10 | `opkg install ./luci-theme-aster_*.ipk` |
| 25.12 | `apk add --allow-untrusted ./luci-theme-aster-*.apk` |

僅對信任的套件使用 `--allow-untrusted`。安裝後，LuCI 會保留原先選用的主題。要改用 Aster，可到**系統 → 系統 → 語言和介面**選擇 **Aster**。

### 自行建置

從主題原始碼目錄開始，先將 `SDK` 設為 SDK 解壓縮後的絕對路徑，並確認 SDK 內已有 LuCI feed。Makefile 以 `../../luci.mk` 載入建置規則，因此必須複製原始碼，不能以符號連結代替。

```sh
cp -R . "$SDK/feeds/luci/themes/luci-theme-aster"
cd "$SDK"
./scripts/feeds update -i
./scripts/feeds install -p luci luci-theme-aster
make defconfig
make package/luci-theme-aster/compile V=s
```

套件位於 `bin/packages/<arch>/luci/`。24.10 的套件副檔名為 `.ipk`，25.12 則為 `.apk`。

## 配色

頂端列的配色選單提供五種選擇。預設的 Rosé Pine 在淺色模式下使用 Dawn，深色模式下使用 Main。其他四種是 Aster、Relay Blue、Sounding Teal 與 Herbarium Plum。切換配色不會改變元件或間距。配色記錄在瀏覽器的 `aster-palette`，不會寫入路由器。

## 設定

在 LuCI 選用 `Aster` 時，明暗模式跟隨系統；選用 `AsterLight` 或 `AsterDark` 則分別固定為淺色或深色。若只想更改目前瀏覽器的外觀，可在頂端列指定淺色或深色。切回自動模式即恢復路由器的設定。

## 手機

畫面寬度在 48rem 以下（含）時，可從選單按鈕開啟側邊導覽抽屜。表格依可用空間決定是否摺疊，不以手機版面的寬度為準。欄位排不下時，每筆資料會分行顯示，欄名標在對應的值旁。

## 樣式分層

`htdocs/luci-static/aster/` 下有五份樣式表，LuCI 依下列順序載入：

| 檔案 | 用途 |
|---|---|
| `tokens.css` | 共用的樣式變數與各套配色的色值 |
| `components.css` | 配合 LuCI 標記結構的 Astryx 元件 |
| `shell.css` | 頂端列、側邊導覽、頁面框架與手機導覽抽屜 |
| `theme.css` | 登入頁、連結與狀態色彩 |
| `luci.css` | 將元件樣式套用到 LuCI 的類別名稱，安排頁面版面 |

頁面若有自己的樣式表，會在主題之後載入。

## 登入頁

登入前就能切換配色與明暗模式。密碼欄位旁有顯示或隱藏密碼的按鈕。停用 JavaScript 時，仍可送出登入表單。

## 翻譯

主題原文為英文。繁體中文套件是 `luci-i18n-aster-zh-tw`，簡體中文套件是 `luci-i18n-aster-zh-cn`，可依需要安裝。Aster 只更改 LuCI 的外觀；LuCI 或應用程式尚未翻譯的文字仍會顯示原文。

## 授權

Aster 採用 [Apache License 2.0](LICENSE)。Ray Floret 標誌與 Relay Blue、Sounding Teal、Herbarium Plum 三套配色皆為本專案設計。[Heroicons 2.2.0 線條圖示](LICENSES/heroicons-MIT.txt)與 [Rosé Pine 配色](LICENSES/rose-pine-MIT.txt)採用 MIT 授權。[配色定義](design/palettes.mjs)列出 Rosé Pine 為改善對比度而調整的色值。
