/**
 * GLSL Renderer Module
 * Renders GLSL shaders using glslCanvas
 */

import GlslCanvas from 'glslCanvas';

export class GLSLRenderer {
  private canvas: HTMLCanvasElement;
  private sandbox: GlslCanvas | null = null;
  private currentShader: string = '';

  constructor(canvas: HTMLCanvasElement) {
    console.log('[GLSLRenderer] Constructor called');
    this.canvas = canvas;
    this.init();
  }

  /**
   * Initialize the GLSL canvas
   */
  private init(): void {
    console.log('[GLSLRenderer] Initializing...');
    // Set canvas size to match window
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Initialize with default shader
    console.log('[GLSLRenderer] Creating GlslCanvas instance');
    this.sandbox = new GlslCanvas(this.canvas);
    console.log('[GLSLRenderer] GlslCanvas created:', this.sandbox);
    this.loadDefaultShader();
    console.log('[GLSLRenderer] Initialization complete');
  }

  /**
   * Resize canvas to match window size
   */
  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  /**
   * Load default shader
   */
  private loadDefaultShader(): void {
    const defaultShader = `
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec3 color = vec3(0.0);

    // Animated gradient
    color.r = abs(sin(u_time * 0.5 + st.x * 3.0));
    color.g = abs(sin(u_time * 0.3 + st.y * 2.0));
    color.b = abs(sin(u_time * 0.7));

    gl_FragColor = vec4(color, 1.0);
}`;
    this.updateShader(defaultShader);
  }

  /**
   * Update the shader code
   */
  updateShader(shaderCode: string): void {
    console.log('[GLSLRenderer] updateShader called');
    console.log('[GLSLRenderer] this.sandbox:', this.sandbox);
    console.log('[GLSLRenderer] Shader code length:', shaderCode?.length || 0);
    console.log('[GLSLRenderer] Received shader code:');
    console.log(shaderCode);

    if (!this.sandbox) {
      console.error('[GLSLRenderer] Sandbox not initialized');
      console.error('[GLSLRenderer] this:', this);
      return;
    }

    if (shaderCode === this.currentShader) {
      console.log('[GLSLRenderer] Shader unchanged, skipping update');
      return;
    }

    try {
      // Ensure shader has proper precision statement
      let processedShader = shaderCode;
      if (!processedShader.includes('precision')) {
        console.log('[GLSLRenderer] Adding precision statement');
        processedShader = `#ifdef GL_ES
precision mediump float;
#endif

` + processedShader;
      }

      console.log('[GLSLRenderer] Loading shader into glslCanvas...');
      this.sandbox.load(processedShader);
      this.currentShader = shaderCode;
      console.log('[GLSLRenderer] Shader updated successfully');
    } catch (error) {
      console.error('[GLSLRenderer] Failed to load shader:', error);
      // Keep the previous shader on error
    }
  }

  /**
   * Set uniform value
   */
  setUniform(name: string, value: number | number[]): void {
    if (!this.sandbox) return;

    try {
      this.sandbox.setUniform(name, value);
    } catch (error) {
      console.error(`Failed to set uniform ${name}:`, error);
    }
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    console.log('[GLSLRenderer] Destroy called');
    window.removeEventListener('resize', () => this.resizeCanvas());
    if (this.sandbox) {
      console.log('[GLSLRenderer] Destroying sandbox');
      this.sandbox.destroy();
      this.sandbox = null;
    }
    console.log('[GLSLRenderer] Destroy complete');
  }
}
