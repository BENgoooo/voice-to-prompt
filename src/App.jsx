import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Wand2, Copy, CheckCircle2, Activity, AlertTriangle, Settings } from 'lucide-react';
import ModelSelector from './components/ModelSelector';
import ApiKeySettings from './components/ApiKeySettings';
import { API_PROVIDERS, SYSTEM_PROMPT, DEFAULT_MODEL } from './apiConfig';
import { checkQuota, incrementUsage, getNextRefreshTime, formatTime } from './utils/quotaManager';

// Status types
const STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  ERROR: 'error'
};

// Quota Alert Modal
function QuotaAlert({ message, onClose, nextRefresh }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-500/20 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">额度不足</h3>
            <p className="text-white/70 text-sm mb-4">{message}</p>
            {nextRefresh && (
              <p className="text-amber-300 text-sm">
                下次刷新时间：{formatTime(nextRefresh)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 glass-button text-white rounded-xl text-sm font-medium"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

// Call API
async function callAPI(providerId, modelId, rawText) {
  const provider = API_PROVIDERS[providerId];
  if (!provider) throw new Error('未知的API提供商');

  const apiKey = provider.getApiKey();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `请将以下语音转录文本优化为专业的AI Prompt：\n\n${rawText.trim()}` }
  ];

  if (providerId === 'gemini') {
    const url = provider.formatUrl(provider.endpoint, modelId, apiKey);
    const body = provider.formatBody(modelId, messages);
    const response = await fetch(url, {
      method: 'POST',
      headers: provider.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API request failed: ${response.status}`);
    }
    const data = await response.json();
    return provider.parseResponse(data);
  }

  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: provider.headers(apiKey),
    body: JSON.stringify(provider.formatBody(modelId, messages)),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || error.message || `API request failed: ${response.status}`);
  }
  const data = await response.json();
  return provider.parseResponse(data);
}

function App() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [quotaAlert, setQuotaAlert] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const isApiKeySet = (providerId) => !!localStorage.getItem(`api_key_${providerId}`);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('浏览器不支持 Web Speech API，请使用 Chrome');
    }
  }, []);

  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onstart = () => {
      setStatus(STATUS.LISTENING);
      setError(null);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (final) {
        finalTranscriptRef.current += final;
        setTranscript(finalTranscriptRef.current);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('请允许麦克风权限');
      } else if (event.error !== 'no-speech') {
        setError(`语音识别错误: ${event.error}`);
      }
      setStatus(STATUS.ERROR);
    };

    recognition.onend = () => {
      if (status === STATUS.LISTENING) {
        try { recognition.start(); } catch (e) {}
      }
    };
    recognitionRef.current = recognition;
  }, [status]);

  useEffect(() => {
    initSpeechRecognition();
    return () => recognitionRef.current?.stop();
  }, [initSpeechRecognition]);

  const toggleRecording = async () => {
    if (status === STATUS.LISTENING) {
      recognitionRef.current?.stop();
      setStatus(STATUS.IDLE);
      setInterimTranscript('');
      if (interimTranscript) {
        finalTranscriptRef.current += interimTranscript;
        setTranscript(finalTranscriptRef.current);
        setInterimTranscript('');
      }
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionRef.current?.start();
      } catch {
        setError('无法访问麦克风');
        setStatus(STATUS.ERROR);
      }
    }
  };

  const handleOptimize = async () => {
    if (!transcript.trim()) return;
    const { provider, modelId } = selectedModel;
    const quotaCheck = checkQuota(provider, 1);
    if (!quotaCheck.ok) {
      setQuotaAlert({ message: quotaCheck.reason, nextRefresh: getNextRefreshTime(provider) });
      return;
    }
    setStatus(STATUS.PROCESSING);
    setError(null);
    try {
      const optimized = await callAPI(provider, modelId, transcript);
      setOptimizedPrompt(optimized);
      incrementUsage(provider, 1);
    } catch (err) {
      if (err.message?.includes('API Key')) setShowSettings(true);
      setError(`优化失败: ${err.message}`);
    } finally {
      setStatus(STATUS.IDLE);
    }
  };

  const handleCopy = async () => {
    if (!optimizedPrompt) return;
    await navigator.clipboard.writeText(optimizedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setOptimizedPrompt('');
    setStatus(STATUS.IDLE);
    setError(null);
  };

  const StatusIndicator = () => {
    const styles = {
      [STATUS.LISTENING]: 'text-rose-400',
      [STATUS.PROCESSING]: 'text-amber-400',
      [STATUS.ERROR]: 'text-rose-400',
      [STATUS.IDLE]: 'text-emerald-400'
    };
    const labels = {
      [STATUS.LISTENING]: '录音中',
      [STATUS.PROCESSING]: '处理中',
      [STATUS.ERROR]: '错误',
      [STATUS.IDLE]: '就绪'
    };
    return (
      <div className={`flex items-center gap-2 ${styles[status]}`}>
        {status === STATUS.LISTENING && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />}
        {status === STATUS.PROCESSING && <Activity className="w-4 h-4 animate-pulse" />}
        {status === STATUS.IDLE && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
        <span className="text-sm font-medium">{labels[status]}</span>
      </div>
    );
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center p-8">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <MicOff className="w-16 h-16 mx-auto mb-4 text-rose-400" />
          <h2 className="text-xl font-bold text-white mb-2">浏览器不支持</h2>
          <p className="text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen aurora-bg flex flex-col overflow-hidden">
      {quotaAlert && <QuotaAlert message={quotaAlert.message} nextRefresh={quotaAlert.nextRefresh} onClose={() => setQuotaAlert(null)} />}
      <ApiKeySettings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Header */}
      <header className="glass-header h-16 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Voice to Prompt</h1>
        </div>

        <div className="flex items-center gap-3">
          <StatusIndicator />
          <div className="h-5 w-px bg-white/20" />
          <button
            onClick={() => setShowSettings(true)}
            className={`p-2.5 rounded-xl transition-all ${!isApiKeySet(selectedModel.provider) ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'glass-button-sm text-white/70 hover:text-white'}`}
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-white/20" />
          <ModelSelector selectedModel={selectedModel} onSelect={setSelectedModel} />
          <div className="h-5 w-px bg-white/20" />
          <button
            onClick={toggleRecording}
            disabled={status === STATUS.PROCESSING}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg ${
              status === STATUS.LISTENING
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
                : 'bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white shadow-violet-500/30'
            } disabled:opacity-50`}
          >
            {status === STATUS.LISTENING ? <><MicOff className="w-4 h-4" /><span>停止</span></>
              : <><Mic className="w-4 h-4" /><span>录音</span></>}
          </button>
          {transcript && (
            <button onClick={handleClear} className="px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors">
              清空
            </button>
          )}
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 glass-error rounded-xl px-4 py-3 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Left Panel */}
        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
          <div className="glass-header h-12 flex items-center px-4">
            <Activity className="w-4 h-4 text-violet-400 mr-2" />
            <span className="text-sm font-semibold text-white/90">实时语音转录</span>
            <span className="text-xs text-white/50 ml-2">Raw Input</span>
          </div>
          <div className="flex-1 overflow-auto p-5">
            {transcript || interimTranscript ? (
              <div className="font-mono text-sm leading-relaxed text-white/90">
                {transcript}
                {interimTranscript && <span className="text-white/50 italic">{interimTranscript}</span>}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/40">
                <div className="w-16 h-16 rounded-2xl glass-button-sm flex items-center justify-center mb-4">
                  <Mic className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-base">点击「录音」开始语音输入</p>
                <p className="text-sm mt-2 opacity-70">支持中文语音识别</p>
              </div>
            )}
          </div>
          <div className="glass-header h-9 flex items-center px-4 text-xs text-white/50">
            <span>字数: {(transcript + interimTranscript).length}</span>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden">
          <div className="glass-header h-12 flex items-center justify-between px-4">
            <div className="flex items-center">
              <Wand2 className="w-4 h-4 text-pink-400 mr-2" />
              <span className="text-sm font-semibold text-white/90">AI Prompt</span>
              <span className="text-xs text-white/50 ml-2">Refined</span>
            </div>
            {optimizedPrompt && (
              <button onClick={handleCopy} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'glass-button-sm text-white/80 hover:text-white'}`}>
                {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>已复制</span></>
                  : <><Copy className="w-3.5 h-3.5" /><span>复制</span></>}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-5">
            {optimizedPrompt ? (
              <div className="font-mono text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{optimizedPrompt}</div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-white/40">
                <div className="w-16 h-16 rounded-2xl glass-button-sm flex items-center justify-center mb-4">
                  <Wand2 className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-base">优化后的 Prompt 将显示在这里</p>
                <p className="text-sm mt-2 opacity-70">点击「一键优化」生成</p>
              </div>
            )}
          </div>
          <div className="glass-header h-14 flex items-center justify-between px-4">
            <span className="text-xs text-white/50">
              {optimizedPrompt && `预计节省 ${Math.round(optimizedPrompt.length * 0.3)} tokens`}
            </span>
            <button
              onClick={handleOptimize}
              disabled={!transcript || status === STATUS.PROCESSING}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-pink-500/30"
            >
              <Wand2 className="w-4 h-4" />
              <span>一键优化</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
