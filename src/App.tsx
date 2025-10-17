import { useEffect, useRef, useState } from 'react';
import { AudioInput } from './modules/AudioInput';
import { GeminiGLSLGenerator } from './modules/GeminiGLSLGenerator';
import { GLSLRenderer } from './modules/GLSLRenderer';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioInputRef = useRef<AudioInput | null>(null);
  const glslGeneratorRef = useRef<GeminiGLSLGenerator | null>(null);
  const rendererRef = useRef<GLSLRenderer | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [inputMode, setInputMode] = useState<'microphone' | 'file'>('microphone');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Initialize renderer when canvas is ready
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new GLSLRenderer(canvasRef.current);
    }

    // Cleanup on unmount
    return () => {
      if (audioInputRef.current) {
        audioInputRef.current.stop();
      }
      if (glslGeneratorRef.current) {
        glslGeneratorRef.current.destroy();
      }
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
    };
  }, []);

  const startVisualization = async () => {
    if (!apiKey) {
      setError('Please enter your Gemini API key');
      return;
    }

    try {
      setError('');

      // Initialize audio input
      audioInputRef.current = new AudioInput();
      if (inputMode === 'microphone') {
        await audioInputRef.current.initMicrophone();
      }

      // Initialize Gemini GLSL generator
      glslGeneratorRef.current = new GeminiGLSLGenerator({
        apiKey,
        updateInterval: 5000, // Generate new shader every 5 seconds
      });

      // Connect modules through subscriptions (loose coupling)

      // Audio -> Gemini
      audioInputRef.current.subscribe((audioData) => {
        if (glslGeneratorRef.current) {
          glslGeneratorRef.current.generateGLSL(audioData);
        }
      });

      // Gemini -> Renderer
      glslGeneratorRef.current.subscribe((glslCode) => {
        if (rendererRef.current) {
          rendererRef.current.updateShader(glslCode);
        }
      });

      setIsRunning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start visualization');
      console.error('Error starting visualization:', err);
    }
  };

  const stopVisualization = () => {
    if (audioInputRef.current) {
      audioInputRef.current.stop();
      audioInputRef.current = null;
    }

    if (glslGeneratorRef.current) {
      glslGeneratorRef.current.destroy();
      glslGeneratorRef.current = null;
    }

    setIsRunning(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const audio = new Audio(URL.createObjectURL(file));
    audio.loop = true;
    audio.play();

    if (audioInputRef.current) {
      audioInputRef.current.initAudioElement(audio);
    }
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
              <label>Audio Input:</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    value="microphone"
                    checked={inputMode === 'microphone'}
                    onChange={(e) => setInputMode(e.target.value as 'microphone')}
                  />
                  Microphone
                </label>
                <label>
                  <input
                    type="radio"
                    value="file"
                    checked={inputMode === 'file'}
                    onChange={(e) => setInputMode(e.target.value as 'file')}
                  />
                  Audio File
                </label>
              </div>
            </div>

            {inputMode === 'file' && (
              <div className="input-group">
                <label htmlFor="audioFile">Select Audio File:</label>
                <input
                  id="audioFile"
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                />
              </div>
            )}

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
            <li>Audio input analyzes sound frequencies and volume</li>
            <li>Gemini 2.5 Pro generates creative GLSL shaders based on audio</li>
            <li>GLSL renderer displays the generated visuals in real-time</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default App;
