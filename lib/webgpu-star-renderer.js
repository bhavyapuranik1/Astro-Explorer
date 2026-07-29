/**
 * WebGPU Modular Star Renderer for Astro Explorer
 * Provides high-performance GPU instanced star rendering with Canvas 2D fallback.
 */

(function (window) {
  'use strict';

  class WebGPUStarRenderer {
    constructor() {
      this.supported = false;
      this.ready = false;
      this.adapter = null;
      this.device = null;
      this.canvas = null;
      this.context = null;
      this.pipeline = null;
      this.vertexBuffer = null;
      this.starCount = 0;
    }

    async init(canvasElement) {
      if (!navigator || !navigator.gpu) {
        console.log("ℹ️ WebGPU not supported on this browser/device. Using Canvas 2D fallback.");
        this.supported = false;
        return false;
      }

      try {
        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) {
          console.warn("⚠️ WebGPU adapter request failed. Falling back to Canvas 2D.");
          return false;
        }

        this.device = await this.adapter.requestDevice();
        this.supported = true;

        if (canvasElement) {
          this.attachCanvas(canvasElement);
        }

        this.initPipeline();
        this.ready = true;
        console.log("⚡ WebGPU Star Renderer initialized successfully.");
        return true;
      } catch (err) {
        console.warn("⚠️ WebGPU initialization error:", err.message, ". Using Canvas 2D fallback.");
        this.supported = false;
        this.ready = false;
        return false;
      }
    }

    attachCanvas(canvasElement) {
      this.canvas = canvasElement;
      if (this.supported && this.device) {
        this.context = this.canvas.getContext('webgpu');
        if (this.context) {
          const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
          this.context.configure({
            device: this.device,
            format: presentationFormat,
            alphaMode: 'premultiplied'
          });
        }
      }
    }

    initPipeline() {
      if (!this.device) return;

      const wgslShader = `
        struct Uniforms {
          time : f32,
          padding : vec3<f32>,
        };

        struct VertexInput {
          @location(0) position : vec2<f32>,
          @location(1) color : vec4<f32>,
          @location(2) size : f32,
        };

        struct VertexOutput {
          @builtin(position) Position : vec4<f32>,
          @location(0) color : vec4<f32>,
          @location(1) pointCoord : vec2<f32>,
          @location(2) twinkleAlpha : f32,
        };

        @vertex
        fn vs_main(input : VertexInput, @builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
          var output : VertexOutput;
          var offsets = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>( 1.0,  1.0)
          );

          let quadOffset = offsets[vertexIndex % 6u];
          
          // Pure GPU Star Twinkling Calculation
          // Pseudo-random star phase hash
          let phaseHash = sin(input.position.x * 127.1 + input.position.y * 311.7) * 43758.5453;
          let starPhase = fract(phaseHash) * 6.28318;
          
          // Atmospheric airmass (horizon stars twinkle more strongly, zenith stars minimally)
          let horizonDist = clamp(1.0 - abs(input.position.y), 0.0, 1.0);
          let airmass = 0.5 + horizonDist * 0.8;
          
          // Brightness intensity scaling (bright stars twinkle more, faint stars less)
          let intensityMod = clamp(input.size / 3.0, 0.3, 1.0);
          
          // Harmonic wave equation
          let wave1 = sin(starPhase * 1.5 + input.position.x * 10.0);
          let wave2 = sin(starPhase * 3.3 + input.position.y * 15.0);
          let twinkleFactor = 1.0 + ((wave1 + wave2) * 0.5) * 0.25 * airmass * intensityMod;
          
          let scaledSize = input.size * (0.9 + (twinkleFactor - 1.0) * 0.2);
          let clipPos = input.position + quadOffset * (scaledSize / 1000.0);
          
          output.Position = vec4<f32>(clipPos, 0.0, 1.0);
          output.color = input.color;
          output.pointCoord = quadOffset;
          output.twinkleAlpha = input.color.a * clamp(twinkleFactor, 0.3, 1.0);
          return output;
        }

        @fragment
        fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
          let dist = length(input.pointCoord);
          if (dist > 1.0) {
            discard;
          }
          // Smooth anti-aliased circular point decay
          let alpha = smoothstep(1.0, 0.2, dist) * input.twinkleAlpha;
          return vec4<f32>(input.color.rgb, alpha);
        }
      `;

      const shaderModule = this.device.createShaderModule({ code: wgslShader });

      this.pipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [
            {
              arrayStride: 7 * 4, // 2 (pos) + 4 (col) + 1 (size) = 7 floats
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' },
                { shaderLocation: 1, offset: 2 * 4, format: 'float32x4' },
                { shaderLocation: 2, offset: 6 * 4, format: 'float32' }
              ]
            }
          ]
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [
            {
              format: navigator.gpu.getPreferredCanvasFormat(),
              blend: {
                color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
              }
            }
          ]
        },
        primitive: {
          topology: 'triangle-list'
        }
      });
    }

    isAvailable() {
      return this.supported && this.ready;
    }
  }

  // Create global instance
  window.WebGPUStarRenderer = WebGPUStarRenderer;
  window.webGpuStarRenderer = new WebGPUStarRenderer();

})(window);
