/**
 * 额度管理工具
 * 使用 localStorage 记录各API的使用情况
 */

const STORAGE_KEY = 'voice_to_prompt_quota_v1';

// 默认额度配置（与 apiConfig.js 对应）
const DEFAULT_QUOTAS = {
  openrouter: {
    used: 0,
    dailyQuota: 50,
    lastReset: new Date().toISOString(),
  },
  siliconflow: {
    used: 0,
    totalQuota: 20000000, // 2000万 tokens
    lastReset: null, // 一次性额度，不刷新
  },
  gemini: {
    used: 0,
    dailyQuota: 20,
    lastReset: new Date().toISOString(),
  },
  groq: {
    used: 0,
    dailyQuota: 14400,
    lastReset: new Date().toISOString(),
  },
};

/**
 * 获取存储的额度数据
 */
export function getQuotaData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // 合并默认值（处理新增provider的情况）
      return { ...DEFAULT_QUOTAS, ...data };
    }
  } catch (e) {
    console.error('Failed to parse quota data:', e);
  }
  return { ...DEFAULT_QUOTAS };
}

/**
 * 保存额度数据
 */
function saveQuotaData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save quota data:', e);
  }
}

/**
 * 检查是否需要重置每日额度
 */
function shouldReset(lastResetDate, refreshCycle) {
  if (!lastResetDate || refreshCycle !== 'daily') return false;

  const lastReset = new Date(lastResetDate);
  const now = new Date();

  // 检查是否跨天了（使用UTC时间）
  const lastResetDay = new Date(lastReset.toISOString().split('T')[0]);
  const nowDay = new Date(now.toISOString().split('T')[0]);

  return nowDay > lastResetDay;
}

/**
 * 获取指定provider的当前额度状态
 */
export function getProviderQuota(providerId) {
  const data = getQuotaData();
  const provider = data[providerId] || DEFAULT_QUOTAS[providerId];

  if (!provider) return null;

  // 检查是否需要重置
  if (shouldReset(provider.lastReset, 'daily')) {
    provider.used = 0;
    provider.lastReset = new Date().toISOString();
    saveQuotaData(data);
  }

  const quotaInfo = getQuotaInfo(providerId);

  return {
    ...provider,
    ...quotaInfo,
    remaining: quotaInfo.total - provider.used,
    percentage: quotaInfo.total > 0 ? (provider.used / quotaInfo.total) * 100 : 0,
    isExhausted: provider.used >= quotaInfo.total,
  };
}

/**
 * 获取额度配置信息
 */
function getQuotaInfo(providerId) {
  switch (providerId) {
    case 'openrouter':
      return { total: 50, unit: '次/天', type: 'daily' };
    case 'siliconflow':
      return { total: 20000000, unit: 'tokens', type: 'total' };
    case 'gemini':
      return { total: 20, unit: '次/天', type: 'daily' };
    case 'groq':
      return { total: 14400, unit: '次/天', type: 'daily' };
    default:
      return { total: 0, unit: '次', type: 'unknown' };
  }
}

/**
 * 增加使用次数
 */
export function incrementUsage(providerId, count = 1) {
  const data = getQuotaData();
  if (!data[providerId]) {
    data[providerId] = { ...DEFAULT_QUOTAS[providerId] };
  }

  // 检查并重置每日额度
  if (shouldReset(data[providerId].lastReset, 'daily')) {
    data[providerId].used = 0;
    data[providerId].lastReset = new Date().toISOString();
  }

  data[providerId].used += count;
  saveQuotaData(data);

  return getProviderQuota(providerId);
}

/**
 * 检查额度是否足够
 */
export function checkQuota(providerId, estimatedUsage = 1) {
  const quota = getProviderQuota(providerId);
  if (!quota) return { ok: false, reason: '未知的Provider' };

  if (quota.isExhausted) {
    return {
      ok: false,
      reason: '额度已用完',
      nextRefresh: getNextRefreshTime(providerId),
    };
  }

  if (quota.remaining < estimatedUsage) {
    return {
      ok: false,
      reason: '剩余额度不足',
      remaining: quota.remaining,
    };
  }

  return { ok: true, remaining: quota.remaining };
}

/**
 * 获取下次刷新时间
 */
export function getNextRefreshTime(providerId) {
  const data = getQuotaData();
  const provider = data[providerId];

  if (!provider || !provider.lastReset) return null;

  // 每日刷新的provider
  if (['openrouter', 'gemini', 'groq'].includes(providerId)) {
    const lastReset = new Date(provider.lastReset);
    const nextReset = new Date(lastReset);
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);
    nextReset.setUTCHours(0, 0, 0, 0);
    return nextReset;
  }

  // SiliconFlow是一次性额度，不刷新
  if (providerId === 'siliconflow') {
    return null;
  }

  return null;
}

/**
 * 格式化时间
 */
export function formatTime(date) {
  if (!date) return '无';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化数字
 */
export function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * 重置所有额度（用于测试）
 */
export function resetAllQuotas() {
  localStorage.removeItem(STORAGE_KEY);
}
