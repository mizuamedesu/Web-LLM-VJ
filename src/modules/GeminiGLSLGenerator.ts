/**
 * Gemini GLSL Generator Module
 * Converts audio analysis data to GLSL shader code using Gemini 2.5 Pro with Function Calling
 */

import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import type { AudioAnalysis } from './AudioInput';

export interface GLSLGenerationOptions {
  apiKey: string;
  updateInterval?: number; // milliseconds between generations
}

// Function declaration for GLSL shader generation
const generateGLSLShaderFunction: FunctionDeclaration = {
  name: 'generate_glsl_shader',
  description: 'Generates a GLSL fragment shader code based on audio analysis data (volume, bass, mid, high frequencies)',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      shaderCode: {
        type: SchemaType.STRING,
        description: 'Complete GLSL fragment shader code including precision, uniforms (u_time, u_resolution), and main function. The shader should be visually interesting and respond to the audio characteristics.',
      },
      description: {
        type: SchemaType.STRING,
        description: 'Brief description of the visual effect and how it responds to the audio (bass, mid, high frequencies)',
      },
    },
    required: ['shaderCode', 'description'],
  },
};

export class GeminiGLSLGenerator {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private listeners: Set<(glslCode: string) => void> = new Set();
  private lastGenerationTime: number = 0;
  private updateInterval: number;
  private isGenerating: boolean = false;

  constructor(options: GLSLGenerationOptions) {
    this.genAI = new GoogleGenerativeAI(options.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      tools: [{ functionDeclarations: [generateGLSLShaderFunction] }],
    });
    this.updateInterval = options.updateInterval ?? 3000; // Default: 3 seconds
  }

  /**
   * Generate GLSL shader code based on audio analysis using Function Calling
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

      // Call the model with function calling
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        toolConfig: { functionCallingConfig: { mode: 'ANY' } },
      });

      const response = result.response;

      // Check if function was called
      const functionCall = response.functionCalls()?.[0];

      if (functionCall && functionCall.name === 'generate_glsl_shader') {
        const { shaderCode, description } = functionCall.args;

        console.log('Generated shader:', description);

        // Validate and process the shader code
        const processedShader = this.processShaderCode(shaderCode);
        this.notifyListeners(processedShader);
      } else {
        // Fallback: try to extract from text response
        console.warn('No function call in response, using fallback');
        const glslCode = this.extractGLSL(response.text());
        this.notifyListeners(glslCode);
      }
    } catch (error) {
      console.error('Failed to generate GLSL:', error);
      // Use default shader on error
      this.notifyListeners(this.getDefaultShader());
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Create prompt for Gemini based on audio analysis (optimized for Function Calling)
   */
  private createPrompt(audioData: AudioAnalysis): string {
    const { volume, frequencyData } = audioData;

    // Calculate frequency distribution
    const bassEnergy = this.getFrequencyBandEnergy(frequencyData, 0, 0.1);
    const midEnergy = this.getFrequencyBandEnergy(frequencyData, 0.1, 0.5);
    const highEnergy = this.getFrequencyBandEnergy(frequencyData, 0.5, 1.0);

    return `Create a visually stunning GLSL fragment shader that responds to this audio analysis:

Audio Data:
- Overall volume: ${(volume * 100).toFixed(2)}%
- Bass energy (low frequencies): ${(bassEnergy * 100).toFixed(2)}%
- Mid energy (mid frequencies): ${(midEnergy * 100).toFixed(2)}%
- High energy (high frequencies): ${(highEnergy * 100).toFixed(2)}%

Design Guidelines:
- Map bass energy → large-scale movements, bold colors, or pulsating shapes
- Map mid energy → medium-scale patterns or color transitions
- Map high energy → fine details, rapid changes, or particle-like effects
- Create smooth, music-reactive animations
- Use creative visual metaphors (waves, fractals, particles, geometric patterns, etc.)

Technical Requirements:
- Use uniform vec2 u_resolution for screen size
- Use uniform float u_time for animation
- Include precision statement if needed
- Complete, valid GLSL fragment shader code
- Optimize for real-time performance

Generate the shader using the generate_glsl_shader function.`;
  }

  /**
   * Process and validate shader code from function calling
   */
  private processShaderCode(code: string): string {
    // Remove any markdown code blocks if present
    let processedCode = code.replace(/```glsl\n?/g, '').replace(/```\n?/g, '');

    // Ensure we have basic shader structure
    if (!processedCode.includes('void main()')) {
      console.warn('Invalid shader: missing main function');
      return this.getDefaultShader();
    }

    // Add precision if missing
    if (!processedCode.includes('precision')) {
      processedCode = `#ifdef GL_ES
precision mediump float;
#endif

` + processedCode;
    }

    return processedCode.trim();
  }

  /**
   * Extract GLSL code from Gemini response (fallback method)
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
