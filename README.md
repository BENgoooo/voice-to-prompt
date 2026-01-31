# Voice to Prompt - 语音转 AI Prompt 工具

一个纯前端部署的语音输入工具，可以将你的语音实时转录为文本，并使用 AI 优化为结构化的 Prompt。

## 功能特性

- **实时语音识别**：使用 Web Speech API 进行中文语音识别
- **AI Prompt 优化**：通过多个免费 AI API 将口语化表达转换为专业 Prompt
- **多模型支持**：支持 OpenRouter、SiliconFlow、Google Gemini、Groq 等多个平台
- **额度管理**：实时显示各平台免费额度使用情况，自动刷新
- **一键复制**：支持一键复制优化后的 Prompt 到剪贴板
- **纯前端部署**：无需后端，可直接部署到 GitHub Pages

## 支持的免费 API

| 平台 | 免费额度 | 刷新周期 | 特点 |
|------|---------|----------|------|
| **OpenRouter** | 50次/天 | 每日 UTC 00:00 | 支持 DeepSeek、Gemini 等 200+ 模型 |
| **SiliconFlow** | 2000万 Token | 一次性 | 国内友好，小模型永久免费 |
| **Google Gemini** | 20次/天 | 每日 PST 00:00 | Google 官方 API |
| **Groq** | 14,400次/天 | 每日 UTC 00:00 | 极速推理，支持 Llama 3.3 |

## 技术栈

- **前端**：React + Vite + Tailwind CSS
- **API**：多平台 AI API（OpenRouter、SiliconFlow、Gemini、Groq）
- **部署**：GitHub Pages（纯静态）

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

### 部署到 GitHub Pages

1. **Fork 或创建 GitHub 仓库**

2. **启用 GitHub Pages**
   - 进入仓库 Settings → Pages
   - Source 选择 "GitHub Actions"

3. **推送到 main 分支**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

4. **自动部署**
   - GitHub Actions 会自动构建并部署
   - 访问 `https://你的用户名.github.io/仓库名/`

## 使用说明

### 1. 选择模型

点击顶部的「选择模型」按钮，可以看到：
- 各平台的免费额度
- 额度使用进度条
- 下次刷新时间
- 可用/已用完状态

### 2. 语音输入

点击「开始录音」按钮，开始语音输入（需要麦克风权限）。

### 3. 优化 Prompt

点击「一键优化」按钮，AI 会将你的语音转录文本转换为结构化的 Prompt。

### 4. 额度管理

- 每次调用会消耗 1 次额度
- 额度不足时会弹窗提醒
- 已用完的模型会被标记为不可用（红色）
- 额度每日自动刷新

## 项目结构

```
.
├── src/
│   ├── components/
│   │   └── ModelSelector.jsx    # 模型选择组件
│   ├── utils/
│   │   └── quotaManager.js      # 额度管理工具
│   ├── apiConfig.js             # API 配置
│   ├── App.jsx                  # 主应用
│   └── main.jsx                 # 入口文件
├── .github/workflows/
│   └── deploy.yml               # GitHub Actions 部署配置
└── README.md
```

## 注意事项

1. **API Key 安全**
   - 本项目使用公开的免费 API Key（由社区维护）
   - 额度有限，请合理使用
   - 如有需要，可以自行申请 API Key 替换

2. **浏览器支持**
   - 需要使用 Chrome 或 Edge（支持 Web Speech API）
   - 需要允许麦克风权限

3. **额度限制**
   - 免费额度有限，用完需要等待刷新
   - 建议优先使用永久免费的模型（如 SiliconFlow 的小模型）

## 自定义 API Key

如果你想使用自己的 API Key，可以修改 `src/apiConfig.js` 中的 `apiKey` 字段：

```javascript
export const API_PROVIDERS = {
  openrouter: {
    // ...
    apiKey: '你的 API Key',
    // ...
  },
  // ...
};
```

## License

MIT
