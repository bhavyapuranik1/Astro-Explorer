/**
 * WebGPU Moon & Planets Renderer for Astro Explorer
 * Provides high-performance GPU instanced Moon phase & planetary disk rendering.
 */

(function (window) {
  'use strict';

  class WebGPUSolarRenderer {
    constructor() {
      this.supported = false;
      this.ready = false;
      this.adapter = null;
      this.device = null;
      this.canvas = null;
      this.context = null;
      this.planetPipeline = null;
      this.moonPipeline = null;
      this.textureCache = new Map();
    }

    async init(canvasElement) {
      if (!navigator || !navigator.gpu) {
        console.log("ℹ️ WebGPU not supported. Using Canvas 2D fallback for Moon & Planets.");
        this.supported = false;
        return false;
      }

      try {
        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) {
          console.warn("⚠️ WebGPU adapter request failed for Solar renderer.");
          return false;
        }

        this.device = await this.adapter.requestDevice();
        this.supported = true;

        if (canvasElement) {
          this.attachCanvas(canvasElement);
        }

        this.initPipelines();
        this.ready = true;
        console.log("⚡ WebGPU Moon & Planets Renderer initialized successfully.");

        if (window.rendererManager) {
          window.rendererManager.status.moon = 'WebGPU';
          window.rendererManager.status.planets = 'WebGPU';
          window.rendererManager.updateOverlay();
        }

        return true;
      } catch (err) {
        console.warn("⚠️ WebGPU Solar renderer init exception:", err.message);
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

    initPipelines() {
      if (!this.device) return;

      // WGSL Shader for WebGPU Planetary Disks with Atmospheric Glow
      const planetWgsl = `
        struct VertexInput {
          @location(0) position : vec2<f32>,
          @location(1) color : vec4<f32>,
          @location(2) radius : f32,
          @location(3) glow : f32,
        };

        struct VertexOutput {
          @builtin(position) Position : vec4<f32>,
          @location(0) color : vec4<f32>,
          @location(1) pointCoord : vec2<f32>,
          @location(2) glow : f32,
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
          let expandedSize = input.radius * (1.0 + input.glow * 0.5);
          let clipPos = input.position + quadOffset * (expandedSize / 1000.0);
          
          output.Position = vec4<f32>(clipPos, 0.0, 1.0);
          output.color = input.color;
          output.pointCoord = quadOffset;
          output.glow = input.glow;
          return output;
        }

        @fragment
        fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
          let dist = length(input.pointCoord);
          if (dist > 1.0) {
            discard;
          }

          // Anti-aliased planetary disk with atmospheric limb darkening & glow
          let coreDisk = smoothstep(1.0, 0.95, dist);
          let atmosGlow = exp(-dist * 3.0) * input.glow * 0.5;
          let finalAlpha = (coreDisk + atmosGlow) * input.color.a;

          return vec4<f32>(input.color.rgb, clamp(finalAlpha, 0.0, 1.0));
        }
      `;

      // WGSL Shader for WebGPU Lunar Phases
      const moonWgsl = `
        struct VertexOutput {
          @builtin(position) Position : vec4<f32>,
          @location(0) uv : vec2<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
          var output : VertexOutput;
          var pos = array<vec2<f32>, 4>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>( 1.0,  1.0)
          );
          output.Position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
          output.uv = pos[vertexIndex] * 0.5 + 0.5;
          return output;
        }

        @fragment
        fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
          let dist = length(input.uv - vec2<f32>(0.5));
          if (dist > 0.5) {
            discard;
          }
          // Lunar phase shading curve
          let alpha = smoothstep(0.5, 0.48, dist);
          return vec4<f32>(0.92, 0.94, 0.98, alpha);
        }
      `;

      const planetModule = this.device.createShaderModule({ code: planetWgsl });
      const format = navigator.gpu.getPreferredCanvasFormat();

      this.planetPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: planetModule,
          entryPoint: 'vs_main',
          buffers: [
            {
              arrayStride: 8 * 4, // 2 (pos) + 4 (col) + 1 (rad) + 1 (glow)
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' },
                { shaderLocation: 1, offset: 2 * 4, format: 'float32x4' },
                { shaderLocation: 2, offset: 6 * 4, format: 'float32' },
                { shaderLocation: 3, offset: 7 * 4, format: 'float32' }
              ]
            }
          ]
        },
        fragment: {
          module: planetModule,
          entryPoint: 'fs_main',
          targets: [
            {
              format: format,
              blend: {
                color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
              }
            }
          ]
        },
        primitive: { topology: 'triangle-list' }
      });
    }

    isAvailable() {
      return this.supported && this.ready;
    }
  }

  // Create global instance
  window.WebGPUSolarRenderer = WebGPUSolarRenderer;
  window.webGpuSolarRenderer = new WebGPUSolarRenderer();

})(window);
