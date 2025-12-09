# AI Translator

[English](./README.md) | 中文 | [日本語](./README_JA.md)

现代化 Web 翻译工具，使用 Gemini（默认）或 OpenAI 进行文本翻译和语音合成，支持可配置的模型和播放控制。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/duanyongcheng/ai-translator&project-name=ai-translator&repository-name=ai-translator&env=GEMINI_API_KEY&envDescription=Gemini%20API%20key%20for%20translation%20and%20TTS)

## 功能特性

- 自动或手动选择源语言，支持语言互换
- 翻译结果支持复制、语音播放和循环播放（可设置次数和间隔）
- 翻译历史记录持久化存储（最多 50 条）
- TTS 音频缓存（IndexedDB），重复播放无需重新请求
- 设置面板可切换服务商（Gemini/OpenAI）、模型、API 地址和密钥，设置自动保存到本地
- 防抖翻译、错误提示、简洁 UI，基于 React 19 + Vite + TypeScript + Tailwind CSS v4

## 快速开始

```bash
npm install
echo "GEMINI_API_KEY=<your_key>" > .env.local   # 创建环境变量文件
npm run dev        # http://localhost:3000
```

### 脚本命令

- `npm run dev` — 启动 Vite 开发服务器，端口 3000（host `0.0.0.0`）
- `npm run build` — 生产环境打包到 `dist/`
- `npm run preview` — 本地预览生产构建

## 配置说明

- 环境变量：`.env.local`（已加入 gitignore）中设置 `GEMINI_API_KEY=<your_key>`，Vite 会将其暴露为 `process.env.API_KEY`
- 运行时配置：通过设置面板可独立配置翻译和 TTS 的服务商、API 密钥、API 地址和模型。留空 API 密钥将使用环境变量默认值
- 音频处理：Gemini 返回 PCM 格式在浏览器端解码；OpenAI 使用浏览器内置解码。播放使用 Web Audio API

## 项目结构

- `index.tsx` — React 入口，挂载 `App`
- `App.tsx` — 主布局、翻译流程、语言切换、播放控制、历史管理
- `components/` — UI 组件（`LanguageSelector`、`TranslationBox`、`SettingsModal`、`HistoryPanel`）
- `services/aiService.ts` — Gemini/OpenAI 的翻译和 TTS 逻辑、音频播放辅助函数
- `services/audioCache.ts` — TTS 音频的 IndexedDB 持久化缓存（最多 50 条，LRU 淘汰）
- `services/audioUtils.ts` — PCM 解码辅助函数
- `constants.ts` — 支持的语言列表
- `types.ts` — 共享类型和枚举
- `vite.config.ts` — 环境变量加载、路径别名、开发服务器配置

## 使用说明

- 确保浏览器有音频输出权限；每个面板有独立的播放/停止控制
- 循环播放仅适用于翻译结果；可在输出面板调整次数和间隔
- 点击时钟图标可访问翻译历史；点击历史记录可恢复之前的翻译
- TTS 音频本地缓存 — 重复播放相同文本无需 API 调用
- 错误会以内联横幅显示；请检查 API 密钥/模型/API 地址

## 贡献指南

- 遵循 Conventional Commits 规范（如 `feat(scope): summary`、`fix(scope): …`）
- PR 描述需清晰，UI 变更请附截图，注明环境/配置影响
- 手动测试清单：双向翻译、语言互换、TTS 播放/停止、循环播放、修改设置、刷新页面确认持久化。如需引入自动化测试请使用 Vitest + React Testing Library
