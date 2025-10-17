/**
 * Gemini GLSL Generator Module
 * Converts audio analysis data to GLSL shader code using Gemini 2.5 Pro with Function Calling
 */

import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai';

export interface GLSLGenerationOptions {
  apiKey: string;
  audioFile: File;
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
  private isGenerating: boolean = false;
  private audioFile: File;

  constructor(options: GLSLGenerationOptions) {
    this.genAI = new GoogleGenerativeAI(options.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      tools: [{ functionDeclarations: [generateGLSLShaderFunction] }],
    });
    this.audioFile = options.audioFile;
  }

  /**
   * Generate GLSL shader code by sending audio file directly to Gemini (one-time call)
   */
  async generateGLSL(): Promise<void> {
    if (this.isGenerating) {
      return;
    }

    this.isGenerating = true;

    console.log('[GeminiGLSL] Starting GLSL generation...');

    try {
      // Convert audio file to base64
      console.log('[GeminiGLSL] Converting audio file to base64...');
      const audioBase64 = await this.fileToBase64(this.audioFile);

      const prompt = `Analyze this audio file and create a visually stunning GLSL fragment shader that responds to the music in real-time.

Design Guidelines:
- Create dynamic, music-reactive visuals
- Use creative visual metaphors (waves, fractals, particles, geometric patterns, psychedelic effects, etc.)
- Make the visuals respond to the music's mood, energy, and rhythm
- Consider the overall atmosphere of the music

Available Audio Uniforms (updated in real-time):
- uniform float u_volume; // Overall volume (0.0 to 1.0)
- uniform float u_bass; // Low frequency energy (0.0 to 1.0)
- uniform float u_mid; // Mid frequency energy (0.0 to 1.0)
- uniform float u_high; // High frequency energy (0.0 to 1.0)
- uniform float u_spectrum[32]; // Full spectrum data as array (0.0 to 1.0 for each bin)

Standard Uniforms:
- uniform vec2 u_resolution; // Screen resolution
- uniform float u_time; // Animation time

Technical Requirements:
- Use the audio uniforms to make visuals react to the music
- Map bass to large-scale movements, colors, or shapes
- Map mid frequencies to medium-scale patterns
- Map high frequencies to fine details, sparkles, or rapid changes
- Use u_spectrum array for detailed frequency-based effects
- DO NOT use texture2D or any texture sampling
- DO NOT use external functions or samplers
- Use only built-in GLSL math functions
- Complete, valid GLSL fragment shader code
- Optimize for real-time performance

Generate the shader using the generate_glsl_shader function.`;

      console.log('[GeminiGLSL] Calling Gemini API with audio file...');

      // Call the model with audio file and function calling
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: this.audioFile.type,
                data: audioBase64,
              },
            },
            { text: prompt },
          ],
        }],
        toolConfig: { functionCallingConfig: { mode: 'ANY' } },
      });

      console.log('[GeminiGLSL] Received response from Gemini');

      const response = result.response;
      console.log('[GeminiGLSL] Response object:', response);

      // Check if function was called (functionCalls is a method)
      const functionCalls = response.functionCalls();
      console.log('[GeminiGLSL] Function calls:', functionCalls);

      if (functionCalls && functionCalls.length > 0) {
        const functionCall = functionCalls[0];
        console.log('[GeminiGLSL] Function call detected:', functionCall.name);

        if (functionCall.name === 'generate_glsl_shader') {
          const { shaderCode, description } = functionCall.args;

          console.log('[GeminiGLSL] Generated shader description:', description);
          console.log('[GeminiGLSL] Shader code length:', shaderCode?.length || 0, 'characters');
          console.log('[GeminiGLSL] Raw shader code:');
          console.log(shaderCode);

          // Validate and process the shader code
          const processedShader = this.processShaderCode(shaderCode);
          console.log('[GeminiGLSL] Processed shader code:');
          console.log(processedShader);
          console.log('[GeminiGLSL] Shader processed, notifying listeners');
          this.notifyListeners(processedShader);
        }
      } else {
        // Fallback: try to extract from text response
        console.warn('[GeminiGLSL] No function call in response, using fallback');
        console.log('[GeminiGLSL] Response text:', response.text());
        const glslCode = this.extractGLSL(response.text());
        this.notifyListeners(glslCode);
      }
    } catch (error) {
      console.error('[GeminiGLSL] Failed to generate GLSL:', error);
      console.error('[GeminiGLSL] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Use default shader on error
      this.notifyListeners(this.getDefaultShader());
    } finally {
      this.isGenerating = false;
      console.log('[GeminiGLSL] GLSL generation complete');
    }
  }

  /**
   * Convert File to base64 string
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:audio/mpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
