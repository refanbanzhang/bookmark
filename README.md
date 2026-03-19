# Chrome 书签启动页

基于 Vue 3 + Vite，覆盖 Chrome 新标签页并按目录展示书签的轻量扩展。

## 特性
- 利用 `chrome.bookmarks` API 读取书签树，按文件夹/书签区分展示。
- 纯 Vue 3 组件递归渲染目录，展示文件夹、书签、域名信息。
- 支持配置页面背景图，可用图片 URL 或本地上传，配置会持久化到本地。
- 可用作 Chrome 新标签页（`chrome_url_overrides.newtab` 指向构建产物）。
- 在不支持 Chrome API 的环境下自动回退到演示数据，方便调试。

## 本地开发
```bash
npm install
npm run dev
```
在浏览器输入 `http://localhost:5173` 查看 Vue 页面，注意 `chrome.bookmarks` 在本地并不可用，界面会使用示例数据。

## 打包发布
```bash
npm run build
```
构建输出目录 `dist/` 可直接作为 Chrome 扩展的 unpacked folder 加载（需确保浏览器版本支持 Manifest V3）。

## Chrome 扩展配置
- `public/manifest.json` 里声明了 `chrome_url_overrides.newtab`，指向 `index.html`。
- 授权 `bookmarks` 权限以访问用户书签。
- 图标位于 `public/icons/`，构建时会原样拷贝。

## 目录结构
```
├── public/manifest.json        # 扩展声明文件
├── public/icons/              # 扩展图标
├── src/App.vue                # 启动页主界面
├── src/components/BookmarkGroup.vue  # 递归书签展示
├── src/style.css              # 全局样式
└── package.json
```

## 加载扩展
1. Chrome 扩展管理页面（`chrome://extensions/`）。
2. 开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择 `dist/` 目录。
4. 打开一个新标签页，新页面即为书签聚合页。
