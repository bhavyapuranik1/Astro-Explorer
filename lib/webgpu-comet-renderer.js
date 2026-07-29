/**
 * WebGPU Comet & Tail Renderer for Astro Explorer
 * Provides GPU instanced comet coma & dust/ion tail shader rendering.
 */

(function (window) {
  'use strict';

  class WebGPUCometRenderer {
    constructor() {
      this.supported = false;
      this.ready = false;
      this.adapter = null;
      this.device = null;
      this.canvas = null;
      this.context = null;
      this.cometPipeline = null;
    }

    async init(canvasElement) {
      if (!navigator || !navigator.gpu) {
        console.log("ℹ️ WebGPU not supported. Using Canvas fallback for Comets.");
        this.supported = false;
        return false;
      }

      try {
        this.adapter = await navigator.gpu.requestAdapter();
        if (!this.adapter) return false;

        this.device = await this.adapter.requestDevice();
        this.supported = true;

        if (canvasElement) {
          this.attachCanvas(canvasElement);
        }

        this.initPipeline();
        this.ready = true;
        console.log("⚡ WebGPU Comet Renderer initialized successfully.");

        if (window.rendererManager) {
          window.rendererManager.status.comets = 'WebGPU';
          window.rendererManager.updateOverlay();
        }

        return true;
      } catch (err) {
        console.warn("⚠️ WebGPU Comet renderer init exception:", err.message);
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

      // WGSL Shader for WebGPU Comet Coma and Ion/Dust Tail
      const cometWgsl = `
        struct VertexInput {
          @location(0) position : vec2<f32>,
          @location(1) tailVector : vec2<f32>,
          @location(2) comaRadius : f32,
          @location(3) tailLength : f32,
        };

        struct VertexOutput {
          @builtin(position) Position : vec4<f32>,
          @location(0) pointCoord : vec2<f32>,
          @location(1) tailProgress : f32,
        };

        @vertex
        fn vs_main(input : VertexInput, @builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
          var output : VertexOutput;
          var pos = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>( 1.0,  1.0)
          );

          let quadOffset = pos[vertexIndex % 6u];
          let tailOffset = input.tailVector * (quadOffset.y * 0.5 + 0.5) * (input.tailLength / 500.0);
          let clipPos = input.position + quadOffset * (input.comaRadius / 1000.0) + tailOffset;
          
          output.Position = vec4<f32>(clipPos, 0.0, 1.0);
          output.pointCoord = quadOffset;
          output.tailProgress = quadOffset.y * 0.5 + 0.5;
          return output;
        }

        @fragment
        fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
          let dist = length(input.pointCoord);
          if (dist > 1.0) {
            discard;
          }

          // Diffuse Cyan/Blue Ion Comet Tail & Bright Nucleus Coma
          let comaGlow = exp(-dist * 2.5) * 0.95;
          let tailFade = exp(-input.tailProgress * 3.0) * 0.6;
          let color = mix(vec3<f32>(0.9, 0.98, 1.0), vec3<f32>(0.2, 0.7, 1.0), input.tailProgress);
          let alpha = max(comaGlow, tailFade);

          return vec4<f32>(color, clamp(alpha, 0.0, 1.0));
        }
      `;

      const shaderModule = this.device.createShaderModule({ code: cometWgsl });
      const format = navigator.gpu.getPreferredCanvasFormat();

      this.cometPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [
            {
              arrayStride: 6 * 4,
              attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x2' },
                { shaderLocation: 1, offset: 2 * 4, format: 'float32x2' },
                { shaderLocation: 2, offset: 4 * 4, format: 'float32' },
                { shaderLocation: 3, offset: 5 * 4, format: 'float32' }
              ]
            }
          ]
        },
        fragment: {
          module: shaderModule,
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
  window.WebGPUCometRenderer = WebGPUCometRenderer;
  window.webGpuCometRenderer = new WebGPUCometRenderer();

})(window);
