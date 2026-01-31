import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Cpu, AlertCircle, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { API_PROVIDERS } from '../apiConfig';
import {
  getProviderQuota,
  checkQuota,
  formatTime,
  formatNumber,
  getNextRefreshTime,
} from '../utils/quotaManager';

export default function ModelSelector({ selectedModel, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [quotas, setQuotas] = useState({});
  const [now, setNow] = useState(new Date());
  const dropdownRef = useRef(null);

  // 刷新额度信息
  const refreshQuotas = () => {
    const newQuotas = {};
    Object.keys(API_PROVIDERS).forEach((providerId) => {
      newQuotas[providerId] = getProviderQuota(providerId);
    });
    setQuotas(newQuotas);
    setNow(new Date());
  };

  // 初始加载和定期刷新
  useEffect(() => {
    refreshQuotas();
    const interval = setInterval(refreshQuotas, 30000); // 每30秒刷新一次
    return () => clearInterval(interval);
  }, []);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 获取当前选中模型的信息
  const getCurrentModelInfo = () => {
    const provider = API_PROVIDERS[selectedModel.provider];
    const model = provider?.models.find((m) => m.id === selectedModel.modelId);
    return { provider, model };
  };

  const { provider: currentProvider, model: currentModel } = getCurrentModelInfo();

  // 获取进度条颜色
  const getProgressColor = (percentage, isExhausted) => {
    if (isExhausted) return 'bg-red-500';
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  // 计算剩余时间
  const getTimeUntilRefresh = (nextRefresh) => {
    if (!nextRefresh) return null;
    const diff = new Date(nextRefresh) - now;
    if (diff <= 0) return '即将刷新';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}小时${minutes}分钟后`;
    return `${minutes}分钟后`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700
                   border border-slate-700 rounded-lg transition-all duration-200
                   text-sm text-slate-300 hover:text-white"
      >
        <Cpu className="w-4 h-4 text-violet-400" />
        <span className="max-w-[120px] truncate">
          {currentModel?.name || '选择模型'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-[420px] max-h-[80vh] overflow-auto
                     bg-slate-900 border border-slate-700 rounded-xl shadow-2xl
                     shadow-black/50 z-50"
        >
          {/* 头部 */}
          <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm
                          border-b border-slate-800 p-4 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">选择 AI 模型</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  免费额度每日刷新，额度不足时请切换其他模型
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  refreshQuotas();
                }}
                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
                title="刷新额度"
              >
                <RefreshCw className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Provider 列表 */}
          <div className="p-2 space-y-1">
            {Object.values(API_PROVIDERS).map((provider) => {
              const quota = quotas[provider.id];
              const isExhausted = quota?.isExhausted;
              const hasAvailableModels = provider.models.some((model) => {
                const check = checkQuota(provider.id, 1);
                return check.ok || model.freeForever;
              });

              return (
                <div key={provider.id} className="rounded-lg overflow-hidden">
                  {/* Provider 标题行 */}
                  <div className="px-3 py-2 bg-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">
                          {provider.name}
                        </span>
                        <a
                          href={provider.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-500 hover:text-slate-400"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          isExhausted
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {isExhausted ? '已用完' : '可用'}
                      </span>
                    </div>

                    {/* 额度信息 */}
                    {quota && (
                      <div className="mt-2 space-y-1.5">
                        {/* 进度条 */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${getProgressColor(
                                quota.percentage,
                                isExhausted
                              )}`}
                              style={{
                                width: `${Math.min(quota.percentage, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 min-w-[70px] text-right">
                            {formatNumber(quota.used)} / {formatNumber(quota.total)}{' '}
                            {quota.unit}
                          </span>
                        </div>

                        {/* 额度说明和刷新时间 */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            {provider.freeTier.description}
                          </span>
                          {provider.freeTier.refreshCycle === 'daily' && (
                            <span className="text-slate-500">
                              下次刷新:{' '}
                              {isExhausted ? (
                                <span className="text-amber-400">
                                  {getTimeUntilRefresh(getNextRefreshTime(provider.id))}
                                </span>
                              ) : (
                                formatTime(getNextRefreshTime(provider.id))
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 模型列表 */}
                  <div className="divide-y divide-slate-800/50">
                    {provider.models.map((model) => {
                      const isSelected =
                        selectedModel.provider === provider.id &&
                        selectedModel.modelId === model.id;
                      const isDisabled = isExhausted && !model.freeForever;

                      return (
                        <button
                          key={model.id}
                          onClick={() => {
                            if (isDisabled) return;
                            onSelect({ provider: provider.id, modelId: model.id });
                            setIsOpen(false);
                          }}
                          disabled={isDisabled}
                          className={`w-full px-3 py-2.5 flex items-center gap-3
                                     transition-colors text-left
                                     ${
                                       isDisabled
                                         ? 'opacity-50 cursor-not-allowed bg-slate-800/30'
                                         : 'hover:bg-slate-800 cursor-pointer'
                                     }
                                     ${isSelected ? 'bg-violet-500/10' : ''}`}
                        >
                          {/* 选中指示器 */}
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                                       transition-colors
                                       ${
                                         isSelected
                                           ? 'border-violet-500 bg-violet-500'
                                           : 'border-slate-600'
                                       }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>

                          {/* 模型信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-medium truncate
                                           ${
                                             isSelected
                                               ? 'text-violet-400'
                                               : isDisabled
                                               ? 'text-slate-500'
                                               : 'text-slate-300'
                                           }`}
                              >
                                {model.name}
                              </span>
                              {model.freeForever && (
                                <span className="text-[10px] px-1 py-0.5 bg-emerald-500/20
                                               text-emerald-400 rounded">
                                  永久免费
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {model.description}
                            </p>
                          </div>

                          {/* 禁用提示 */}
                          {isDisabled && (
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 底部提示 */}
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-sm
                          border-t border-slate-800 p-3 text-xs text-slate-500">
            <p>提示：每日额度在 UTC 00:00 自动刷新，SiliconFlow 为新用户一次性额度</p>
          </div>
        </div>
      )}
    </div>
  );
}
