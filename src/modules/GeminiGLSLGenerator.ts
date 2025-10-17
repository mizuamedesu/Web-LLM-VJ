/**
 * Gemini GLSL Generator Module
 * Converts audio analysis data to GLSL shader code using Gemini 2.5 Pro
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AudioAnalysis } from './AudioInput';

export interface GLSLGenerationOptions {
  apiKey: string;
  updateInterval?: number; // milliseconds between generations
}

export class GeminiGLSLGenerator {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private listeners: Set<(glslCode: string) => void> = new Set();
  private lastGenerationTime: number = 0;
  private updateInterval: number;
  private isGenerating: boolean = false;

  constructor(options: GLSLGenerationOptions) {
    this.genAI = new GoogleGenerativeAI(options.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    this.updateInterval = options.updateInterval ?? 3000; // Default: 3 seconds
  }

  /**
   * Generate GLSL shader code based on audio analysis
   */
  async generateGLSL(audioData: AudioAnalysis): Promise<void> {
    const now = Date.now();
    if (now - this.lastGenerationTime < this.updateInterval || this.isGenerating) {
      return;
    }

    this.isGenerating = true;
    this.lastGenerationTime = now;

    try {
      const prompt = this.createPrompt(audioData);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const glslCode = this.extractGLSL(response.text());

      this.notifyListeners(glslCode);
    } catch (error) {
      console.error('Failed to generate GLSL:', error);
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Create prompt for Gemini based on audio analysis
   */
  private createPrompt(audioData: AudioAnalysis): string {
    const { volume, frequencyData } = audioData;

    // Calculate frequency distribution
    const bassEnergy = this.getFrequencyBandEnergy(frequencyData, 0, 0.1);
    const midEnergy = this.getFrequencyBandEnergy(frequencyData, 0.1, 0.5);
    const highEnergy = this.getFrequencyBandEnergy(frequencyData, 0.5, 1.0);

    return `Generate a creative GLSL fragment shader based on this audio analysis:
- Overall volume: ${(volume * 100).toFixed(2)}%
- Bass energy (low frequencies): ${(bassEnergy * 100).toFixed(2)}%
- Mid energy: ${(midEnergy * 100).toFixed(2)}%
- High energy (high frequencies): ${(highEnergy * 100).toFixed(2)}%

Requirements:
1. Create a visually interesting fragment shader that responds to these audio characteristics
2. Use u_time uniform for animation
3. Use u_resolution uniform for screen size
4. Map bass energy to large-scale movements or colors
5. Map high energy to fine details or rapid changes
6. Make the visuals dynamic and music-reactive
7. Return ONLY the GLSL code without any explanation or markdown formatting
8. The shader should be a complete fragment shader starting with precision and uniforms

Example uniforms you should use:
uniform vec2 u_resolution;
uniform float u_time;

Return only the shader code, no explanations.`;
  }

  /**
   * Extract GLSL code from Gemini response
   */
  private extractGLSL(text: string): string {
    // Remove markdown code blocks if present
    let code = text.replace(/```glsl\n?/g, '').replace(/```\n?/g, '');

    // Ensure we have basic shader structure
    if (!code.includes('void main()')) {
      code = this.getDefaultShader();
    }

    return code.trim();
  }

  /**
   * Get energy for a specific frequency band
   */
  private getFrequencyBandEnergy(frequencyData: Uint8Array, startRatio: number, endRatio: number): number {
    const start = Math.floor(frequencyData.length * startRatio);
    const end = Math.floor(frequencyData.length * endRatio);

    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += frequencyData[i];
    }

    return (sum / (end - start)) / 255;
  }

  /**
   * Get default shader as fallback
   */
  private getDefaultShader(): string {
    return `precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec3 color = vec3(st.x, st.y, abs(sin(u_time)));
    gl_FragColor = vec4(color, 1.0);
}`;
  }

  /**
   * Subscribe to GLSL code updates
   */
  subscribe(callback: (glslCode: string) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(glslCode: string): void {
    this.listeners.forEach(listener => listener(glslCode));
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.listeners.clear();
  }
}
