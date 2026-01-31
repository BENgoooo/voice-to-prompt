import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Wand2, Copy, CheckCircle2, Activity, AlertTriangle } from 'lucide-react';
import ModelSelector from './components/ModelSelector';
import { API_PROVIDERS, SYSTEM_PROMPT, DEFAULT_MODEL } from './apiConfig';
import { checkQuota, incrementUsage, getNextRefreshTime, formatTime } from './utils/quotaManager';

// Status types for the application
const STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  ERROR: 'error'
};

// Alert component for quota warnings
function QuotaAlert({ message, onClose, nextRefresh }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-red-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">额度不足</h3>
            <p className="text-slate-400 text-sm mb-4">{message}</p>
            {nextRefresh && (
              <p className="text-amber-400 text-sm">
                下次刷新时间：{formatTime(nextRefresh)}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

// Call API with selected provider
async function callAPI(providerId, modelId, rawText) {
  const provider = API_PROVIDERS[providerId];
  if (!provider) {
    throw new Error('未知的API提供商');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `请将以下语音转录文本优化为专业的AI Prompt：\n\n${rawText.trim()}` }
  ];

  // Special handling for Gemini (different API format)
  if (providerId === 'gemini') {
    const url = provider.formatUrl(provider.endpoint, modelId, provider.apiKey);
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

  // Standard OpenAI-compatible format
  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: provider.headers(provider.apiKey),
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
  // State management
  const [status, setStatus] = useState(STATUS.IDLE);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [quotaAlert, setQuotaAlert] = useState(null);

  // Refs
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');

  // Check for SpeechRecognition API support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Web Speech API is not supported in this browser. Please use Chrome.');
    }
  }, []);

  // Initialize speech recognition
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
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final) {
        finalTranscriptRef.current += final;
        setTranscript(finalTranscriptRef.current);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone permissions.');
      } else if (event.error === 'no-speech') {
        return;
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setStatus(STATUS.ERROR);
    };

    recognition.onend = () => {
      if (status === STATUS.LISTENING) {
        try {
          recognition.start();
        } catch (e) {
          // Recognition might already be starting
        }
      }
    };

    recognitionRef.current = recognition;
  }, [status]);

  // Initialize on mount
  useEffect(() => {
    initSpeechRecognition();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [initSpeechRecognition]);

  // Toggle recording
  const toggleRecording = async () => {
    if (status === STATUS.LISTENING) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setStatus(STATUS.IDLE);
      setInterimTranscript('');
      if (interimTranscript) {
        finalTranscriptRef.current += interimTranscript;
        setTranscript(finalTranscriptRef.current);
        setInterimTranscript('');
      }
    } else {
      try {
        if (status === STATUS.IDLE && !transcript) {
          finalTranscriptRef.current = '';
        }
        await navigator.mediaDevices.getUserMedia({ audio: true });
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (err) {
        setError('Unable to access microphone. Please check permissions.');
        setStatus(STATUS.ERROR);
      }
    }
  };

  // Optimize prompt
  const handleOptimize = async () => {
    if (!transcript.trim()) {
      setOptimizedPrompt('');
      return;
    }

    const { provider, modelId } = selectedModel;

    // Check quota before calling API
    const quotaCheck = checkQuota(provider, 1);
    if (!quotaCheck.ok) {
      const nextRefresh = getNextRefreshTime(provider);
      setQuotaAlert({
        message: quotaCheck.reason,
        nextRefresh: nextRefresh,
      });
      return;
    }

    setStatus(STATUS.PROCESSING);
    setError(null);

    try {
      const optimized = await callAPI(provider, modelId, transcript);
      setOptimizedPrompt(optimized);

      // Record usage after successful call
      incrementUsage(provider, 1);
    } catch (err) {
      console.error('Optimization error:', err);
      setError(`优化失败: ${err.message}`);
    } finally {
      setStatus(STATUS.IDLE);
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!optimizedPrompt) return;

    try {
      await navigator.clipboard.writeText(optimizedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Clear all content
  const handleClear = () => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setOptimizedPrompt('');
    setStatus(STATUS.IDLE);
    setError(null);
  };

  // Status indicator component
  const StatusIndicator = () => {
    switch (status) {
      case STATUS.LISTENING:
        return (
          <div className="flex items-center gap-2 text-red-400">
            <div className="w-3 h-3 rounded-full bg-red-500 recording-pulse" />
            <span className="text-sm font-medium">录音中</span>
          </div>
        );
      case STATUS.PROCESSING:
        return (
          <div className="flex items-center gap-2 text-amber-400">
            <Activity className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-medium">处理中</span>
          </div>
        );
      case STATUS.ERROR:
        return (
          <div className="flex items-center gap-2 text-red-400">
            <span className="text-sm font-medium">错误</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-emerald-400">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium">就绪</span>
          </div>
        );
    }
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md text-center">
          <div className="text-red-400 mb-4">
            <MicOff className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">浏览器不支持</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Quota Alert Modal */}
      {quotaAlert && (
        <QuotaAlert
          message={quotaAlert.message}
          nextRefresh={quotaAlert.nextRefresh}
          onClose={() => setQuotaAlert(null)}
        />
      )}

      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-white">Voice to Prompt</h1>
        </div>

        <div className="flex items-center gap-4">
          <StatusIndicator />

          {/* Model Selector */}
          <div className="h-6 w-px bg-slate-700 mx-1" />
          <ModelSelector
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
          />

          <div className="h-6 w-px bg-slate-700 mx-1" />

          <button
            onClick={toggleRecording}
            disabled={status === STATUS.PROCESSING}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              status === STATUS.LISTENING
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
                : 'bg-violet-500 hover:bg-violet-600 text-white shadow-lg shadow-violet-500/25'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {status === STATUS.LISTENING ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>停止录音</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>开始录音</span>
              </>
            )}
          </button>

          {transcript && (
            <button
              onClick={handleClear}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              清空
            </button>
          )}
        </div>
      </header>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Main Content - Split View */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Raw Transcript */}
        <div className="flex-1 flex flex-col border-r border-slate-800">
          <div className="h-12 bg-slate-900/50 border-b border-slate-800 flex items-center px-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-slate-300">实时语音转录</span>
              <span className="text-xs text-slate-500 ml-2">Raw Input</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 bg-slate-950">
            <div className="min-h-full font-mono text-sm leading-relaxed">
              {transcript || interimTranscript ? (
                <div className="text-slate-300">
                  <span>{transcript}</span>
                  {interimTranscript && (
                    <span className="text-slate-500 italic">{interimTranscript}</span>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-600">
                  <div className="text-center">
                    <Mic className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">点击「开始录音」开始语音输入</p>
                    <p className="text-xs mt-1 opacity-70">支持中文语音识别</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transcript stats */}
          <div className="h-8 bg-slate-900/50 border-t border-slate-800 flex items-center px-4 text-xs text-slate-500">
            <span>字数: {(transcript + interimTranscript).length}</span>
          </div>
        </div>

        {/* Right Panel - AI Refined */}
        <div className="flex-1 flex flex-col">
          <div className="h-12 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-fuchsia-400" />
              <span className="text-sm font-medium text-slate-300">Vibe Coding Prompt</span>
              <span className="text-xs text-slate-500 ml-2">AI Refined</span>
            </div>

            {optimizedPrompt && (
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  copied
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制到剪贴板</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4 bg-slate-950">
            {optimizedPrompt ? (
              <div className="font-mono text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {optimizedPrompt}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600">
                <div className="text-center">
                  <Wand2 className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">优化后的 Prompt 将显示在这里</p>
                  <p className="text-xs mt-1 opacity-70">点击「一键优化」生成</p>
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="h-14 bg-slate-900/50 border-t border-slate-800 flex items-center justify-between px-4">
            <div className="text-xs text-slate-500">
              {optimizedPrompt && `预计节省 ${Math.round(optimizedPrompt.length * 0.3)} 个 token`}
            </div>

            <button
              onClick={handleOptimize}
              disabled={!transcript || status === STATUS.PROCESSING}
              className="flex items-center gap-2 px-5 py-2 bg-fuchsia-500 hover:bg-fuchsia-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-medium text-sm transition-all shadow-lg shadow-fuchsia-500/20 disabled:shadow-none"
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
