import { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { API_PROVIDERS, setApiKey } from '../apiConfig';

export default function ApiKeySettings({ isOpen, onClose }) {
  const [keys, setKeys] = useState({});
  const [visible, setVisible] = useState({});
  const [saved, setSaved] = useState({});

  // 加载已保存的 Key
  useEffect(() => {
    const savedKeys = {};
    Object.keys(API_PROVIDERS).forEach((providerId) => {
      const key = localStorage.getItem(`api_key_${providerId}`);
      if (key) savedKeys[providerId] = key;
    });
    setKeys(savedKeys);
  }, []);

  const handleSave = (providerId) => {
    const key = keys[providerId]?.trim();
    if (key) {
      setApiKey(providerId, key);
      setSaved((prev) => ({ ...prev, [providerId]: true }));
      setTimeout(() => {
        setSaved((prev) => ({ ...prev, [providerId]: false }));
      }, 2000);
    }
  };

  const toggleVisible = (providerId) => {
    setVisible((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const handleChange = (providerId, value) => {
    setKeys((prev) => ({ ...prev, [providerId]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[80vh] overflow-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-white">API Key 设置</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* 说明 */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200/80">
              <p className="font-medium text-amber-400 mb-1">需要设置 API Key</p>
              <p>本工具需要您提供自己的 API Key。Key 仅保存在浏览器本地，不会上传到任何服务器。</p>
            </div>
          </div>

          {/* Provider Key Inputs */}
          {Object.values(API_PROVIDERS).map((provider) => (
            <div key={provider.id} className="bg-slate-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{provider.name}</span>
                  <a
                    href={provider.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-violet-400 transition-colors"
                    title="获取 API Key"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <span className="text-xs text-slate-500">{provider.freeTier.description}</span>
              </div>

              <p className="text-xs text-slate-400 mb-2">{provider.description}</p>

              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={visible[provider.id] ? 'text' : 'password'}
                    value={keys[provider.id] || ''}
                    onChange={(e) => handleChange(provider.id, e.target.value)}
                    placeholder={`输入 ${provider.name} 的 API Key`}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg
                             text-sm text-white placeholder-slate-500
                             focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20
                             pr-10"
                  />
                  <button
                    onClick={() => toggleVisible(provider.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {visible[provider.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => handleSave(provider.id)}
                  disabled={!keys[provider.id]?.trim() || saved[provider.id]}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${
                      saved[provider.id]
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-violet-500 hover:bg-violet-600 text-white disabled:bg-slate-800 disabled:text-slate-500'
                    }`}
                >
                  {saved[provider.id] ? (
                    <span className="flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      已保存
                    </span>
                  ) : (
                    '保存'
                  )}
                </button>
              </div>
            </div>
          ))}

          {/* 获取 Key 指南 */}
          <div className="bg-slate-800/30 rounded-lg p-4 text-sm">
            <h3 className="font-medium text-white mb-3">如何获取免费 API Key</h3>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-2">
                <span className="text-violet-400">1.</span>
                <span>
                  <strong className="text-slate-300">OpenRouter:</strong>
                  {' '}访问 openrouter.ai → Sign Up → Keys → Create Key
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400">2.</span>
                <span>
                  <strong className="text-slate-300">SiliconFlow:</strong>
                  {' '}访问 cloud.siliconflow.cn → 注册 → 账户管理 → API密钥
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-violet-400">3.</span>
                <span>
                  <strong className="text-slate-300">Gemini:</strong>
                  {' '}访问 aistudio.google.com/app/apikey → 创建 API Key
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
