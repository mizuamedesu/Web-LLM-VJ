import { useEffect, useRef, useState } from 'react';
import { AudioInput } from './modules/AudioInput';
import { GLSLGenerator, type ModelProvider } from './modules/GLSLGenerator';
import { GLSLRenderer } from './modules/GLSLRenderer';
import { CodeEditor } from './components/CodeEditor';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioInputRef = useRef<AudioInput | null>(null);
  const glslGeneratorRef = useRef<GLSLGenerator | null>(null);
  const rendererRef = useRef<GLSLRenderer | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioSensitivityRef = useRef<number>(1.0);

  const [isRunning, setIsRunning] = useState(false);
  const [modelProvider, setModelProvider] = useState<ModelProvider>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem('gemini-api-key') || '';
  });
  const [openaiApiKey, setOpenaiApiKey] = useState(() => {
    return localStorage.getItem('openai-api-key') || '';
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioInputMode, setAudioInputMode] = useState<'file' | 'microphone'>('file');
  const [prompt, setPrompt] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioSensitivity, setAudioSensitivity] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 5;

  // Save API keys to localStorage whenever they change
  useEffect(() => {
    if (geminiApiKey) {
      localStorage.setItem('gemini-api-key', geminiApiKey);
    }
  }, [geminiApiKey]);

  useEffect(() => {
    if (openaiApiKey) {
      localStorage.setItem('openai-api-key', openaiApiKey);
    }
  }, [openaiApiKey]);

  // Switch to microphone mode when OpenAI is selected (file mode not supported)
  useEffect(() => {
    if (modelProvider === 'openai' && audioInputMode === 'file') {
      setAudioInputMode('microphone');
    }
  }, [modelProvider]);

  useEffect(() => {
    console.log('[App] useEffect triggered');
    // Initialize renderer when canvas is ready
    if (canvasRef.current && !rendererRef.current) {
      console.log('[App] Creating GLSLRenderer');
      rendererRef.current = new GLSLRenderer(canvasRef.current);
      console.log('[App] GLSLRenderer created:', rendererRef.current);
    }

    // Cleanup on unmount ONLY
    return () => {
      console.log('[App] Cleanup triggered');
      if (glslGeneratorRef.current) {
        glslGeneratorRef.current.destroy();
        glslGeneratorRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('[App] Audio file selected:', file.name);
    setAudioFile(file);
  };

  const startVisualization = async () => {
    console.log('[App] Starting visualization...');

    const currentApiKey = modelProvider === 'gemini' ? geminiApiKey : openaiApiKey;

    if (!currentApiKey) {
      setError(`Please enter your ${modelProvider === 'gemini' ? 'Gemini' : 'OpenAI'} API key`);
      return;
    }

    if (audioInputMode === 'file' && !audioFile) {
      setError('Please select an audio file');
      return;
    }

    if (audioInputMode === 'microphone' && !prompt.trim()) {
      setError('Please enter a prompt for the shader');
      return;
    }

    // Audio file mode is only supported with Gemini
    if (audioInputMode === 'file' && modelProvider === 'openai') {
      setError('Audio file upload is only supported with Gemini. Please use microphone mode or switch to Gemini.');
      return;
    }

    try {
      setError('');

      if (audioInputMode === 'file' && audioFile) {
        // File mode: use audio file
        console.log('[App] Creating audio element from file');
        const audio = new Audio(URL.createObjectURL(audioFile));
        audio.loop = true;
        audioElementRef.current = audio;

        // Initialize audio input for spectrum analysis
        console.log('[App] Initializing AudioInput');
        audioInputRef.current = new AudioInput();
        audioInputRef.current.initAudioElement(audio);
      } else if (audioInputMode === 'microphone') {
        // Microphone mode: use getUserMedia
        console.log('[App] Requesting microphone access');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        console.log('[App] Initializing AudioInput with microphone');
        audioInputRef.current = new AudioInput();
        audioInputRef.current.initMicrophone(stream);
      }

      console.log('[App] Audio initialized, waiting for shader application');

      // Ensure renderer is initialized
      if (!rendererRef.current) {
        console.error('[App] Renderer not initialized, waiting...');
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!rendererRef.current) {
          throw new Error('Renderer failed to initialize');
        }
      }
      console.log('[App] Renderer confirmed initialized');

      // Initialize GLSL generator
      console.log(`[App] Creating GLSLGenerator instance with ${modelProvider}`);
      glslGeneratorRef.current = new GLSLGenerator({
        apiKey: currentApiKey,
        audioFile: audioInputMode === 'file' && audioFile ? audioFile : undefined,
        prompt: audioInputMode === 'microphone' ? prompt : undefined,
        modelProvider: modelProvider,
        model: modelProvider === 'openai' ? 'gpt-4o' : 'gemini-2.5-flash',
      });
      console.log('[App] GLSLGenerator created');

      // Subscribe to code generation progress
      glslGeneratorRef.current.subscribeProgress((progress) => {
        console.log('[App] Code generation progress:', progress);
        setGeneratedCode(progress.code);
        setIsGenerating(!progress.isComplete);
      });

      // Subscribe to shader code updates with retry logic
      glslGeneratorRef.current.subscribe(async (glslCode) => {
        console.log('[App] GLSL code received, updating renderer');
        if (rendererRef.current) {
          // Try to apply shader
          const success = await rendererRef.current.updateShader(glslCode);

          if (!success) {
            retryCountRef.current++;
            console.error(`[App] Shader compilation failed, retry ${retryCountRef.current}/${maxRetries}`);

            if (retryCountRef.current < maxRetries) {
              // Wait a bit and retry generation
              await new Promise(resolve => setTimeout(resolve, 1000));

              if (glslGeneratorRef.current) {
                console.log('[App] Requesting new shader generation...');
                await glslGeneratorRef.current.generateGLSL();
              }
            } else {
              console.error('[App] Max retries reached, giving up');
              setError(`Failed to compile shader after ${maxRetries} attempts`);
              setIsGenerating(false);

              // Show error shader
              if (glslGeneratorRef.current) {
                await glslGeneratorRef.current.rollbackToPreviousShader();
              }
            }
          } else {
            // Shader applied successfully, reset retry count and start audio playback
            console.log('[App] Shader applied successfully, starting audio playback');
            retryCountRef.current = 0;
            if (audioElementRef.current) {
              audioElementRef.current.play();
            }
          }
        } else {
          console.error('[App] Renderer not initialized');
        }
      });

      // Subscribe to audio data and pass to renderer
      if (audioInputRef.current) {
        audioInputRef.current.subscribe((audioData) => {
          if (rendererRef.current) {
            // Pass audio spectrum data to renderer as uniforms with sensitivity
            rendererRef.current.updateAudioData(audioData, audioSensitivityRef.current);
          }
        });
      }

      // Set running state before generation
      setIsRunning(true);

      // Generate GLSL shader (one-time call)
      console.log('[App] Calling generateGLSL...');
      await glslGeneratorRef.current.generateGLSL();
      console.log('[App] GLSL generation complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start visualization');
      console.error('[App] Error starting visualization:', err);
    }
  };

  const stopVisualization = () => {
    console.log('[App] Stopping visualization...');

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }

    if (glslGeneratorRef.current) {
      glslGeneratorRef.current.destroy();
      glslGeneratorRef.current = null;
    }

    setIsRunning(false);
  };

  const regenerateShader = async () => {
    if (!glslGeneratorRef.current || isGenerating) return;

    console.log('[App] Regenerating shader...');

    // Keep audio playing during regeneration
    // Audio will continue with the old shader until new one is applied

    // Trigger new shader generation
    await glslGeneratorRef.current.generateGLSL();
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      try {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Error entering fullscreen:', err);
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="app">
      <canvas ref={canvasRef} className="glsl-canvas" />
      <CodeEditor code={generatedCode} isVisible={isGenerating} />

      <div className={`controls ${isGenerating ? 'hidden' : ''} ${isMinimized ? 'minimized' : ''}`}>
        {!isMinimized ? (
          <>
            <div className="controls-header">
              <button className="minimize-button" onClick={() => setIsMinimized(true)} title="Minimize">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M14 8H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {!isRunning ? (
              <div className="setup">
                <div className="input-group">
                  <label>LLM Provider:</label>
                  <div className="radio-group">
                    <label>
                      <input
                        type="radio"
                        value="gemini"
                        checked={modelProvider === 'gemini'}
                        onChange={(e) => setModelProvider(e.target.value as ModelProvider)}
                      />
                      Gemini
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="openai"
                        checked={modelProvider === 'openai'}
                        onChange={(e) => setModelProvider(e.target.value as ModelProvider)}
                      />
                      GPT5
                    </label>
                  </div>
                </div>

                {modelProvider === 'gemini' ? (
                  <div className="input-group">
                    <label htmlFor="geminiApiKey">Gemini API Key:</label>
                    <input
                      id="geminiApiKey"
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="Enter your Gemini API key"
                      autoComplete="off"
                      data-form-type="other"
                    />
                  </div>
                ) : (
                  <div className="input-group">
                    <label htmlFor="openaiApiKey">OpenAI API Key:</label>
                    <input
                      id="openaiApiKey"
                      type="password"
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      placeholder="Enter your OpenAI API key"
                      autoComplete="off"
                      data-form-type="other"
                    />
                  </div>
                )}

                <div className="input-group">
                  <label>Audio Input Mode:</label>
                  <div className="radio-group">
                    <label>
                      <input
                        type="radio"
                        value="file"
                        checked={audioInputMode === 'file'}
                        onChange={(e) => setAudioInputMode(e.target.value as 'file' | 'microphone')}
                        disabled={modelProvider === 'openai'}
                      />
                      File Upload {modelProvider === 'openai' && '(Gemini only)'}
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="microphone"
                        checked={audioInputMode === 'microphone'}
                        onChange={(e) => setAudioInputMode(e.target.value as 'file' | 'microphone')}
                      />
                      Microphone
                    </label>
                  </div>
                </div>

                {audioInputMode === 'file' ? (
                  <div className="input-group">
                    <label htmlFor="audioFile">Select Audio File:</label>
                    <input
                      id="audioFile"
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                    />
                    {audioFile && (
                      <p style={{ marginTop: '8px', fontSize: '13px', color: '#4ade80' }}>
                        Selected: {audioFile.name}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="input-group">
                    <label htmlFor="prompt">Prompt for Shader:</label>
                    <textarea
                      id="prompt"
                      className="prompt-input"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe the visual effect you want... (e.g., 'colorful waves', 'geometric patterns')"
                      rows={4}
                    />
                  </div>
                )}

                <button
                  onClick={startVisualization}
                  className="start-button"
                  disabled={isGenerating}
                >
                  {isGenerating ? '生成中...' : 'Start Visualization'}
                </button>

                {error && <div className="error">{error}</div>}

                <div className="github-link">
                  <p>This is an open-source project</p>
                  <a href="https://github.com/mizuamedesu/Web-LLM-VJ" target="_blank" rel="noopener noreferrer">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    View on GitHub
                  </a>
                </div>
              </div>
        ) : (
          <div className="running">
            {isGenerating ? (
              <p className="status">生成中...</p>
            ) : (
              <p className="status">Visualization running...</p>
            )}

            <div className="input-group">
              <label htmlFor="sensitivity">
                Audio Sensitivity: {audioSensitivity.toFixed(1)}x
              </label>
              <input
                id="sensitivity"
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={audioSensitivity}
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value);
                  setAudioSensitivity(newValue);
                  audioSensitivityRef.current = newValue;
                }}
                style={{ width: '200px' }}
                disabled={isGenerating}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <button
                onClick={regenerateShader}
                className="start-button"
                disabled={isGenerating}
              >
                再生成
              </button>
              <button
                onClick={toggleFullscreen}
                className="start-button"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
              <button
                onClick={stopVisualization}
                className="stop-button"
                disabled={isGenerating}
              >
                Stop
              </button>
            </div>
          </div>
        )}
          </>
        ) : (
          <button className="restore-button" onClick={() => setIsMinimized(false)} title="Restore">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none" rx="1"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
