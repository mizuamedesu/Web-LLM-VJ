import { useEffect, useRef, useState } from 'react';
import { AudioInput } from './modules/AudioInput';
import { GeminiGLSLGenerator } from './modules/GeminiGLSLGenerator';
import { GLSLRenderer } from './modules/GLSLRenderer';
import { CodeEditor } from './components/CodeEditor';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioInputRef = useRef<AudioInput | null>(null);
  const glslGeneratorRef = useRef<GeminiGLSLGenerator | null>(null);
  const rendererRef = useRef<GLSLRenderer | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioSensitivity, setAudioSensitivity] = useState(1.0);

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

    if (!apiKey) {
      setError('Please enter your Gemini API key');
      return;
    }

    if (!audioFile) {
      setError('Please select an audio file');
      return;
    }

    try {
      setError('');

      // Create and start audio element
      console.log('[App] Creating audio element');
      const audio = new Audio(URL.createObjectURL(audioFile));
      audio.loop = true;
      audioElementRef.current = audio;

      // Initialize audio input for spectrum analysis
      console.log('[App] Initializing AudioInput');
      audioInputRef.current = new AudioInput();
      audioInputRef.current.initAudioElement(audio);

      // Don't start audio yet - wait for shader to be applied
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

      // Initialize Gemini GLSL generator
      console.log('[App] Creating GeminiGLSLGenerator instance');
      glslGeneratorRef.current = new GeminiGLSLGenerator({
        apiKey,
        audioFile,
      });
      console.log('[App] GeminiGLSLGenerator created');

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
            console.error('[App] Shader compilation failed, retrying...');

            // Wait a bit and retry generation
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (glslGeneratorRef.current) {
              console.log('[App] Requesting new shader generation...');
              await glslGeneratorRef.current.generateGLSL();
            }
          } else {
            // Shader applied successfully, start audio playback
            console.log('[App] Shader applied successfully, starting audio playback');
            if (audioElementRef.current) {
              audioElementRef.current.play();
            }
          }
        } else {
          console.error('[App] Renderer not initialized');
        }
      });

      // Subscribe to audio data and pass to renderer
      audioInputRef.current.subscribe((audioData) => {
        if (rendererRef.current) {
          // Pass audio spectrum data to renderer as uniforms with sensitivity
          rendererRef.current.updateAudioData(audioData, audioSensitivity);
        }
      });

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

    // Pause audio during regeneration
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }

    // Trigger new shader generation
    await glslGeneratorRef.current.generateGLSL();
  };

  return (
    <div className="app">
      <canvas ref={canvasRef} className="glsl-canvas" />
      <CodeEditor code={generatedCode} isVisible={isGenerating} />

      <div className="controls">

        {!isRunning ? (
          <div className="setup">
            <div className="input-group">
              <label htmlFor="apiKey">Gemini API Key:</label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
              />
            </div>

            <div className="input-group">
              <label htmlFor="audioFile">Select Audio File:</label>
              <input
                id="audioFile"
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
              />
              {audioFile && (
                <p style={{ marginTop: '8px', fontSize: '14px', color: '#4ade80' }}>
                  Selected: {audioFile.name}
                </p>
              )}
            </div>

            <button
              onClick={startVisualization}
              className="start-button"
              disabled={isGenerating}
            >
              {isGenerating ? '生成中...' : 'Start Visualization'}
            </button>

            {error && <div className="error">{error}</div>}
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
                onChange={(e) => setAudioSensitivity(parseFloat(e.target.value))}
                style={{ width: '200px' }}
                disabled={isGenerating}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={regenerateShader}
                className="start-button"
                disabled={isGenerating}
              >
                再生成
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
      </div>
    </div>
  );
}

export default App;
