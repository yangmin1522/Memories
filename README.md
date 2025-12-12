# Grand Luxury Tree — 本地测试说明

这是 `christmas.html` 项目的本地测试说明，包含如何启动本地服务器、验证摄像头、确认默认照片来自 `Memories/manifest.json`，以及常见故障排查步骤。

## 1. 运行本地静态服务器（推荐）
在 PowerShell 中进入项目目录并启动一个轻量服务器：

```powershell
Set-Location 'D:\CODE\HTML\christmas'
# 使用 Python 3.x
python -m http.server 8000
```

或者使用 Node.js（若已安装 `http-server`）：

```powershell
Set-Location 'D:\CODE\HTML\christmas'
npx http-server -p 8000
```

打开浏览器访问： `http://localhost:8000/christmas.html`

> 说明：直接用 `file://` 打开文件会导致 `fetch()`、模块导入或摄像头权限在某些浏览器中受限，使用 HTTP(S) 是最可靠的方法。

## 2. 验证点
- 页面右上角应显示摄像头实时画面（如浏览器询问，请允许摄像头权限）。
- 页面中不会显示 "Add Memories" 按钮或任何提示文字（上传 UI 已默认隐藏）。
- 默认相片应来自 `Memories/manifest.json` 中列出的文件；如果清单或文件缺失，页面将回退显示占位画布。

## 3. 如果图片未加载（排查步骤）
1. 在浏览器按 F12 打开开发者工具，切换到 `Network`（网络）面板，刷新页面。查看是否有对 `Memories/manifest.json` 或图片的 `GET` 请求返回 `404` 或其它错误。
2. 若 `manifest.json` 无法加载，请确认文件路径为 `Memories/manifest.json`（相对于 `christmas.html`），且使用 HTTP 服务器服务该文件。
3. 如果图片路径包含空格（比如 `RAZER 1.jpg`），浏览器请求可能会编码为空格为 `%20`，通常仍可工作；如果失败，请在 `manifest.json` 中把文件名用编码后的路径或去掉空格重命名文件。

## 4. 摄像头/MediaPipe 问题（排查步骤）
- 打开控制台（Console）查看错误信息，常见错误及含义：
  - `NotAllowedError` / `Permission denied`：用户或系统拒绝了摄像头权限。确认浏览器已允许网站使用摄像头。
  - `MediaPipe 初始化失败`：表示加载 MediaPipe wasm 或模型时出错，可能是网络问题或浏览器不支持 GPU delegate。
  - `detectForVideo` 报错：检查 `handLandmarker` 是否创建成功（console 中应无初始化错误）。

- 浏览器策略提示：多数现代浏览器允许在 `http://localhost` 上访问摄像头，但在远程主机上通常需要 HTTPS。

- 如果 `HandLandmarker.createFromOptions` 因 GPU 委托失败导致错误，可以暂时改为使用 `delegate: "CPU"`（在 `christmas.js` 中的 `initMediaPipe` 中修改），示例：

```js
handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: 'https://.../hand_landmarker.task', delegate: 'CPU' },
  runningMode: 'VIDEO', numHands: 1
});
```

## 5. 如何恢复上传按钮（如果想要）
当前样式中 `.upload-wrapper` 被设置为 `display: none !important;`。要恢复上传按钮：

- 编辑 `christmas.css`，将 `.upload-wrapper` 的 `display` 和 `pointer-events` 设置恢复，例如：

```css
.upload-wrapper { display: block; pointer-events: auto; }
.hint-text { display: block; }
```

保存后刷新页面即可看到上传控件。

## 6. 检查清单/修改文件
- `manifest.json` 在 `Memories/manifest.json`。您可以直接编辑该文件，列出要预加载的图片路径（相对于 `christmas.html`）。例如：

```json
[
  "Memories/30967-3-razer-logo-image.png",
  "Memories/3840x2160_Byte.jpg"
]
```

- 修改后刷新页面，Network 面板会显示图片加载请求和状态。

## 7. 额外提示
- 该页面依赖外部 CDN（Three.js、MediaPipe）。确保在没有联网的环境下，这些模块无法加载，导致脚本错误。
- 若需要进一步调试截图或错误信息，把控制台的错误消息复制给我，我可以继续帮您分析并给出修复建议。