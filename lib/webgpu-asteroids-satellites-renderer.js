/**
 * WebGPU Asteroids & Satellites Renderer for Astro Explorer
 * Provides GPU-instanced rendering for TLE satellites, asteroids, and DSOs.
 */

(function (window) {
  'use strict';

  class WebGPUAsteroidSatelliteRenderer {
    constructor() {
      this.supported = false;
      this.ready = false;
      this.adapter = null;
      this.device = null;
      this.canvas = null;
      this.context = null;
      this.satPipeline = null;
      this.asteroidPipeline = null;
      this.dsoPipeline = null;
      this.satBuffer = null;
      this.asteroidBuffer = null;
    }

    async init(canvasElement) {
      if (!navigator || !navigator.gpu) {
        console.log("ℹ️ WebGPU not supported. Using Canvas 2D fallback for Asteroids & Satellites.");
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

        this.initPipelines();
        this.ready = true;
        console.log("⚡ WebGPU Asteroids & Satellites Renderer initialized successfully.");

        if (window.rendererManager) {
          window.rendererManager.status.asteroids = 'WebGPU';
          window.rendererManager.status.satellites = 'WebGPU';
          window.rendererManager.status.deepSky = 'WebGPU';
          window.rendererManager.updateOverlay();
        }

        return true;
      } catch (err) {
        console.warn("⚠️ WebGPU Asteroids & Satellites init exception:", err.message);
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

      // WGSL Shader for Instanced Satellites & Asteroids & DSOs
      const shaderWgsl = `
        struct VertexInput {
          @location(0) position : vec2<f32>,
          @location(1) color : vec4<f32>,
          @location(2) size : f32,
          @location(3) shapeType : f32, // 0 = point/satellite, 1 = asteroid, 2 = DSO galaxy/nebula
        };

        struct VertexOutput {
          @builtin(position) Position : vec4<f32>,
          @location(0) color : vec4<f32>,
          @location(1) pointCoord : vec2<f32>,
          @location(2) shapeType : f32,
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
          let clipPos = input.position + quadOffset * (input.size / 1000.0);
          
          output.Position = vec4<f32>(clipPos, 0.0, 1.0);
          output.color = input.color;
          output.pointCoord = quadOffset;
          output.shapeType = input.shapeType;
          return output;
        }

        @fragment
        fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
          let dist = length(input.pointCoord);
          if (dist > 1.0) {
            discard;
          }

          var alpha = smoothstep(1.0, 0.2, dist) * input.color.a;

          // Asteroid / Satellite glow & shape modulation
          if (input.shapeType > 0.5 && input.shapeType < 1.5) {
            // Irregular asteroid texture noise
            alpha *= (0.8 + 0.2 * sin(atan2(input.pointCoord.y, input.pointCoord.x) * 5.0));
          } else if (input.shapeType > 1.5) {
            // Deep Sky Object (Galaxy/Nebula) diffuse radial halo
            alpha *= exp(-dist * 2.2);
          }

          return vec4<f32>(input.color.rgb, clamp(alpha, 0.0, 1.0));
        }
      `;

      const shaderModule = this.device.createShaderModule({ code: shaderWgsl });
      const format = navigator.gpu.getPreferredCanvasFormat();

      this.satPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [
            {
              arrayStride: 8 * 4,
              stepMode: 'instance',
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

    updateInstanceBuffer(instanceData, instanceCount) {
      if (!this.device || !instanceData || instanceCount <= 0) return;

      const byteLength = instanceCount * 8 * 4; // 8 floats per instance
      if (!this.satBuffer || this.bufferCapacity < instanceCount) {
        if (this.satBuffer) this.satBuffer.destroy();
        this.bufferCapacity = Math.max(instanceCount, (this.bufferCapacity || 0) * 2, 512);
        this.satBuffer = this.device.createBuffer({
          size: this.bufferCapacity * 8 * 4,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
      }

      this.device.queue.writeBuffer(
        this.satBuffer,
        0,
        instanceData.buffer,
        instanceData.byteOffset,
        byteLength
      );
      this.instanceCount = instanceCount;
    }

    drawInstanced(renderPassEncoder) {
      if (!this.ready || !this.satPipeline || !this.satBuffer || !this.instanceCount) return;
      renderPassEncoder.setPipeline(this.satPipeline);
      renderPassEncoder.setVertexBuffer(0, this.satBuffer);
      renderPassEncoder.draw(6, this.instanceCount, 0, 0);
    }

    isAvailable() {
      return this.supported && this.ready;
    }
  }

  // Create global instance
  window.WebGPUAsteroidSatelliteRenderer = WebGPUAsteroidSatelliteRenderer;
  window.webGpuAsteroidSatelliteRenderer = new WebGPUAsteroidSatelliteRenderer();

})(window);
