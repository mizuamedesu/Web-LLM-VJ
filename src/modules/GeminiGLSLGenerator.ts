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
  private progressListeners: Set<(progress: { code: string; isComplete: boolean }) => void> = new Set();
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

      const prompt = `この音声ファイルを分析して、音楽にリアルタイムで反応する視覚的に美しいGLSLフラグメントシェーダーを作成してください。

デザインガイドライン:
- ダイナミックで音楽に反応するビジュアルを作成
- 音楽の雰囲気、エネルギー、リズムに反応するビジュアルにする
- 音楽全体の雰囲気を考慮する
- VJなので綺麗で輝いてる感じを中心にして

利用可能なオーディオUniform（リアルタイムで更新）:
- uniform float u_volume; // 全体の音量 (0.0 to 1.0)
- uniform float u_bass; // 低周波数エネルギー (0.0 to 1.0)
- uniform float u_mid; // 中周波数エネルギー (0.0 to 1.0)
- uniform float u_high; // 高周波数エネルギー (0.0 to 1.0)
- uniform float u_spectrum[32]; // 完全なスペクトルデータ配列 (各ビンで0.0 to 1.0)

標準Uniform:
- uniform vec2 u_resolution; // 画面解像度
- uniform float u_time; // アニメーション時間

技術要件:
- オーディオuniformを使用してビジュアルを音楽に反応させる
- texture2Dやテクスチャサンプリングは使用しない
- 外部関数やサンプラーは使用しない
- GLSLの組み込み数学関数のみを使用
- 完全で有効なGLSLフラグメントシェーダーコード
- forループのインデックスは必ず定数で初期化すること（例: for(int i=0; i<10; i++)）
- ループの範囲も定数にすること（変数による動的なループ範囲は不可）

以下のような高品質なフラクタル＋アンチエイリアシングのコードを参考にしてください:

\`\`\`glsl
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_volume;
uniform float u_bass;

mat2 rot(float a) {
    a = radians(a);
    float s = sin(a), c = cos(a);
    return mat2(c, s, -s, c);
}

vec3 fractal(vec2 p) {
    float a = smoothstep(-0.1, 0.1, sin(u_time * 0.5));
    p *= rot(90.0 * a);
    vec2 p2 = p;
    p *= 0.5 + asin(0.9 * sin(u_time * 0.2)) * 0.3;
    p.y -= a;
    p.x += u_time * 0.3 + u_bass * 0.1;
    p = fract(p * 0.5);
    float m = 1000.0;
    float it = 0.0;
    for (int i = 0; i < 10; i++) {
        p = abs(p) / clamp(abs(p.x * p.y), 0.25, 2.0) - 1.0;
        float l = abs(p.x);
        m = min(m, l);
        if (m == l) {
            it = float(i);
        }
    }
    float f = smoothstep(0.015, 0.01, m * 0.5);
    f *= step(p2.y * 0.5 + p2.x + it * 0.1 - 0.3, 0.0);
    vec3 col = normalize(vec3(1.0, 0.0, 0.5));
    col.rg *= rot(length(p2 + it * 0.5) * 200.0);
    col = normalize(col + 0.5) + step(0.5, fract(p2.y * 100.0));
    return col * (f * 0.9 + 0.1) * (1.0 + u_volume * 5.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy - 0.5;
    uv.x *= u_resolution.x / u_resolution.y;
    uv *= 1.0 + u_volume * 0.5;

    int aa = 5;
    float f = max(abs(uv.x), abs(uv.y));
    vec2 pixelSize = 10.0 / u_resolution.xy / float(aa) * f;
    vec3 col = vec3(0.0);

    for (int i = -aa; i <= aa; i++) {
        for (int j = -aa; j <= aa; j++) {
            vec2 offset = vec2(float(i), float(j)) * pixelSize;
            col += fractal(uv + offset);
        }
    }

    float totalSamples = float((aa * 2 + 1) * (aa * 2 + 1));
    col /= totalSamples;
    col *= exp(-1.0 * f);

    gl_FragColor = vec4(col, 1.0);
}
\`\`\`

レイマーチングを使った波形ビジュアライゼーションの例:

\`\`\`glsl
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_spectrum[32];

void main() {
    vec2 I = gl_FragCoord.xy;
    vec4 O = vec4(0.0);

    float i, d, z, r;

    // Raymarch 90 steps
    for(float step = 0.0; step < 90.0; step++) {
        // Raymarch sample point
        vec3 R = vec3(u_resolution.xy, u_resolution.y);
        vec3 p = z * normalize(vec3(I + I, 0.0) * 1.0 - R * 1.1);

        // Shift camera and get reflection coordinates
        p.y += 1.0;
        r = max(-p.y, 0.0) * 1.0;

        // Get spectrum index from x position
        float specIndex = clamp((p.x + 6.5) / 15.0, 0.0, 1.0);
        int idx = int(specIndex * 31.0);
        float specValue = u_spectrum[idx];

        // Mirror and music reaction
        p.y += r + r - 4.0 * specValue;

        // Step forward (reflections are softer)
        float dz = p.z + 3.0;
        d = 0.1 * (0.1 * r + abs(p.y) / (1.0 + r + r + r * r) + max(dz, -dz * 0.1));
        z += d;

        // Pick color and attenuate
        O += (cos(z * 0.5 + u_time * 0.6 + vec4(0, 2, 4, 3)) + 1.3) / d / z;
    }

    // Tanh tonemapping
    O = tanh(O / 900.0);
    gl_FragColor = O;
}
\`\`\`

このコードスタイルを参考に、音楽に合った独自のビジュアルを生成してください。
できる限り画面を埋め尽くすようにし、動きや色の変化を豊かにしてください。 
generate_glsl_shader関数を使用してシェーダーを生成してください。`;

      console.log('[GeminiGLSL] Calling Gemini API with streaming...');

      // Call the model with streaming enabled
      const result = await this.model.generateContentStream({
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

      console.log('[GeminiGLSL] Stream started from Gemini');

      let accumulatedCode = '';
      let foundFunctionCall = false;

      // Process streaming chunks
      for await (const chunk of result.stream) {
        console.log('[GeminiGLSL] Received chunk from stream');

        const functionCalls = chunk.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
          foundFunctionCall = true;
          const functionCall = functionCalls[0];
          console.log('[GeminiGLSL] Function call in chunk:', functionCall.name);

          if (functionCall.name === 'generate_glsl_shader') {
            const { shaderCode } = functionCall.args;
            accumulatedCode = shaderCode;

            console.log('[GeminiGLSL] Accumulated code length:', accumulatedCode.length);

            // Notify progress listeners with streaming code
            this.notifyProgressListeners(accumulatedCode, false);
          }
        }
      }

      console.log('[GeminiGLSL] Stream complete');

      if (foundFunctionCall && accumulatedCode) {
        console.log('[GeminiGLSL] Final code length:', accumulatedCode.length);
        console.log('[GeminiGLSL] Raw shader code:');
        console.log(accumulatedCode);

        // Animate code display character by character (typing effect)
        await this.animateCodeDisplay(accumulatedCode);

        // Validate and process the shader code
        const processedShader = this.processShaderCode(accumulatedCode);
        console.log('[GeminiGLSL] Processed shader code:');
        console.log(processedShader);
        console.log('[GeminiGLSL] Shader processed, notifying listeners');

        // Notify that generation is complete
        this.notifyProgressListeners(processedShader, true);
        this.notifyListeners(processedShader);
      } else {
        // Fallback: try to extract from aggregated text response
        console.warn('[GeminiGLSL] No function call in stream, using fallback');
        const response = await result.response;
        console.log('[GeminiGLSL] Response text:', response.text());
        const glslCode = this.extractGLSL(response.text());

        this.notifyProgressListeners(glslCode, false);
        await new Promise(resolve => setTimeout(resolve, 1500));
        this.notifyProgressListeners(glslCode, true);
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
   * Animate code display with typing effect
   */
  private async animateCodeDisplay(code: string): Promise<void> {
    const chunkSize = 50; // Characters per update
    const delayMs = 30; // Delay between updates

    for (let i = 0; i < code.length; i += chunkSize) {
      const partialCode = code.substring(0, i + chunkSize);
      this.notifyProgressListeners(partialCode, false);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // Show complete code for a moment before applying
    this.notifyProgressListeners(code, false);
    await new Promise(resolve => setTimeout(resolve, 500));
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
   * Subscribe to code generation progress
   */
  subscribeProgress(callback: (progress: { code: string; isComplete: boolean }) => void): () => void {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(glslCode: string): void {
    this.listeners.forEach(listener => listener(glslCode));
  }

  /**
   * Notify progress listeners
   */
  private notifyProgressListeners(code: string, isComplete: boolean): void {
    this.progressListeners.forEach(listener => listener({ code, isComplete }));
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.listeners.clear();
    this.progressListeners.clear();
  }
}
