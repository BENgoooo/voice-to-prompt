/**
 * 免费AI API配置
 * API Key 从 localStorage 读取，如果未设置则使用默认值（需要用户自行替换）
 */

// 从 localStorage 获取 API Key，如果没有则返回空字符串
const getApiKey = (providerId) => {
  const key = localStorage.getItem(`api_key_${providerId}`);
  return key || '';
};

// 设置 API Key 到 localStorage
export const setApiKey = (providerId, apiKey) => {
  localStorage.setItem(`api_key_${providerId}`, apiKey);
};

// 获取 API Key（优先从 localStorage，如果没有则提示用户）
export const getValidApiKey = (providerId) => {
  const key = getApiKey(providerId);
  if (!key) {
    throw new Error(`请先设置 ${providerId} 的 API Key`);
  }
  return key;
};

export const API_PROVIDERS = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '支持200+模型的统一API平台',
    website: 'https://openrouter.ai',
    freeTier: {
      dailyQuota: 50,
      refreshCycle: 'daily',
      refreshTime: '00:00 UTC',
      description: '每日50次免费调用（免费模型）',
    },
    models: [
      {
        id: 'deepseek/deepseek-chat-v3.1:free',
        name: 'DeepSeek V3.1',
        description: 'DeepSeek最新对话模型',
        maxTokens: 4000,
      },
      {
        id: 'deepseek/deepseek-r1:free',
        name: 'DeepSeek R1',
        description: 'DeepSeek推理模型',
        maxTokens: 4000,
      },
      {
        id: 'google/gemini-2.5-flash-preview:free',
        name: 'Gemini 2.5 Flash',
        description: 'Google轻量级模型',
        maxTokens: 4000,
      },
    ],
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    getApiKey: () => getValidApiKey('openrouter'),
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.href,
      'X-Title': 'Voice to Prompt',
      'Content-Type': 'application/json',
    }),
    formatBody: (model, messages) => ({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
    helpUrl: 'https://openrouter.ai/keys',
  },

  siliconflow: {
    id: 'siliconflow',
    name: 'SiliconFlow',
    description: '国内友好的大模型API平台',
    website: 'https://cloud.siliconflow.cn',
    freeTier: {
      totalQuota: 20000000,
      refreshCycle: 'one-time',
      refreshTime: null,
      description: '新用户2000万Token（长期有效）',
      note: '永久免费的小模型不消耗额度',
    },
    models: [
      {
        id: 'Qwen/Qwen2.5-7B-Instruct',
        name: 'Qwen 2.5 7B',
        description: '阿里开源模型（永久免费）',
        maxTokens: 4000,
        freeForever: true,
      },
      {
        id: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        name: 'Llama 3.1 8B',
        description: 'Meta开源模型（永久免费）',
        maxTokens: 4000,
        freeForever: true,
      },
    ],
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    getApiKey: () => getValidApiKey('siliconflow'),
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),
    formatBody: (model, messages) => ({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || '',
    helpUrl: 'https://cloud.siliconflow.cn/account/ak',
  },

  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Google官方API',
    website: 'https://ai.google.dev',
    freeTier: {
      dailyQuota: 20,
      refreshCycle: 'daily',
      refreshTime: '00:00 PST',
      description: '每日20次请求（Flash模型）',
      note: '2025年12月后额度大幅削减',
    },
    models: [
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        description: 'Google轻量级模型',
        maxTokens: 4000,
      },
    ],
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    getApiKey: () => getValidApiKey('gemini'),
    headers: () => ({
      'Content-Type': 'application/json',
    }),
    formatBody: (model, messages) => {
      const systemMsg = messages.find(m => m.role === 'system')?.content || '';
      const userMsg = messages.find(m => m.role === 'user')?.content || '';
      return {
        contents: [{
          parts: [
            { text: systemMsg + '\n\n' + userMsg }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      };
    },
    parseResponse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    formatUrl: (endpoint, model, apiKey) =>
      `${endpoint}/${model}:generateContent?key=${apiKey}`,
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
};

// 系统Prompt模板
export const SYSTEM_PROMPT = `你是一个专业的Prompt优化助手。你的任务是将用户的语音转录文本转换为结构化、清晰的AI Prompt。

请遵循以下原则：
1. 分析用户意图，提取关键需求
2. 将口语化表达转换为专业的Prompt格式
3. 添加必要的上下文和约束条件
4. 使用Markdown格式输出
5. 如果是编程相关需求，使用Vibe Coding格式（包含任务描述、用户需求、技术要求、预期输出）
6. 如果是通用问题，转换为标准的问答Prompt格式

只输出优化后的Prompt内容，不要添加其他说明。`;

// 默认选中的模型
export const DEFAULT_MODEL = {
  provider: 'openrouter',
  modelId: 'deepseek/deepseek-chat-v3.1:free',
};
