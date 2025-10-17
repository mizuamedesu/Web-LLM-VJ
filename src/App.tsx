import { useEffect, useRef, useState } from 'react';
import { GeminiGLSLGenerator } from './modules/GeminiGLSLGenerator';
import { GLSLRenderer } from './modules/GLSLRenderer';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glslGeneratorRef = useRef<GeminiGLSLGenerator | null>(null);
  const rendererRef = useRef<GLSLRenderer | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

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

      // Start playing audio
      console.log('[App] Starting audio playback');
      await audio.play();
      console.log('[App] Audio playback started');

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

      // Subscribe to shader code updates
      glslGeneratorRef.current.subscribe((glslCode) => {
        console.log('[App] GLSL code received, updating renderer');
        if (rendererRef.current) {
          rendererRef.current.updateShader(glslCode);
        } else {
          console.error('[App] Renderer not initialized');
        }
      });

      // Generate GLSL shader (one-time call)
      console.log('[App] Calling generateGLSL...');
      await glslGeneratorRef.current.generateGLSL();
      console.log('[App] GLSL generation complete');

      setIsRunning(true);
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

  return (
    <div className="app">
      <canvas ref={canvasRef} className="glsl-canvas" />

      <div className="controls">
        <h1>Web LLM VJ</h1>
        <p>Audio-reactive GLSL visualizer powered by Gemini 2.5 Pro</p>

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

            <button onClick={startVisualization} className="start-button">
              Start Visualization
            </button>

            {error && <div className="error">{error}</div>}
          </div>
        ) : (
          <div className="running">
            <p className="status">Visualization running...</p>
            <button onClick={stopVisualization} className="stop-button">
              Stop
            </button>
          </div>
        )}

        <div className="info">
          <h3>How it works:</h3>
          <ol>
            <li>Upload an audio file</li>
            <li>Gemini 2.5 Pro analyzes the entire audio file</li>
            <li>Generates a creative GLSL shader based on the music</li>
            <li>GLSL renderer displays the visuals in real-time</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default App;
