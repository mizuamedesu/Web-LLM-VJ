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
    this.canvas = canvas;
    this.init();
  }

  /**
   * Initialize the GLSL canvas
   */
  private init(): void {
    // Set canvas size to match window
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Initialize with default shader
    this.sandbox = new GlslCanvas(this.canvas);
    this.loadDefaultShader();
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
    if (!this.sandbox || shaderCode === this.currentShader) {
      return;
    }

    try {
      // Ensure shader has proper precision statement
      let processedShader = shaderCode;
      if (!processedShader.includes('precision')) {
        processedShader = `#ifdef GL_ES
precision mediump float;
#endif

` + processedShader;
      }

      this.sandbox.load(processedShader);
      this.currentShader = shaderCode;
      console.log('Shader updated successfully');
    } catch (error) {
      console.error('Failed to load shader:', error);
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
    window.removeEventListener('resize', () => this.resizeCanvas());
    if (this.sandbox) {
      this.sandbox.destroy();
      this.sandbox = null;
    }
  }
}
