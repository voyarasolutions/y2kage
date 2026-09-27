// The 16-bit look. The 3D scene is rendered into a 384x216 target with nearest filtering, then a
// post pass crushes it to a few thousand colours with a 4x4 Bayer dither (the Genesis/SNES
// shimmer), adds Y2K glitch tearing and the hurt/pickup flash. The browser upscales the result
// with hard pixel edges.
import * as THREE from 'three';
import { W, H } from '../core/util.js';

const POST_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const POST_FS = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 res;
uniform float levels;
uniform float glitch;
uniform float time;
uniform vec3 flash;
uniform float flashAmt;
uniform float fade;
varying vec2 vUv;

float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float x = q.x;
  float y = q.y;
  // Classic 4x4 ordered dither matrix, row by row.
  float m =
    y == 0.0 ? (x == 0.0 ? 0.0 : x == 1.0 ? 8.0 : x == 2.0 ? 2.0 : 10.0) :
    y == 1.0 ? (x == 0.0 ? 12.0 : x == 1.0 ? 4.0 : x == 2.0 ? 14.0 : 6.0) :
    y == 2.0 ? (x == 0.0 ? 3.0 : x == 1.0 ? 11.0 : x == 2.0 ? 1.0 : 9.0) :
               (x == 0.0 ? 15.0 : x == 1.0 ? 7.0 : x == 2.0 ? 13.0 : 5.0);
  return (m + 0.5) / 16.0;
}

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  vec2 px = floor(uv * res);
  if (glitch > 0.0) {
    // Tear horizontal bands sideways, Y2K style.
    float band = floor(px.y / 6.0);
    float r = hash(band * 17.13 + floor(time * 24.0));
    if (r < glitch * 0.7) uv.x += (hash(band + time) - 0.5) * 0.18 * glitch;
  }
  vec3 c = texture2D(tScene, uv).rgb;
  if (glitch > 0.0) {
    float o = 2.0 / res.x * (1.0 + glitch * 4.0);
    c.r = texture2D(tScene, uv + vec2(o, 0.0)).r;
    c.b = texture2D(tScene, uv - vec2(o, 0.0)).b;
  }
  c = mix(c, flash, flashAmt);
  c *= fade;
  // Quantise each channel with an ordered dither.
  float d = bayer4(gl_FragCoord.xy) - 0.5;
  vec3 q = floor(clamp(c, 0.0, 1.0) * (levels - 1.0) + 0.5 + d * 0.999) / (levels - 1.0);
  gl_FragColor = vec4(q, 1.0);
}`;

export class Pipeline {
  constructor(canvas) {
    THREE.ColorManagement.enabled = false;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.autoClear = true;
    this.renderer = r;
    this.rt = new THREE.WebGLRenderTarget(W, H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      generateMipmaps: false,
    });
    this.uniforms = {
      tScene: { value: this.rt.texture },
      res: { value: new THREE.Vector2(W, H) },
      levels: { value: 16 },
      glitch: { value: 0 },
      time: { value: 0 },
      flash: { value: new THREE.Color(1, 1, 1) },
      flashAmt: { value: 0 },
      fade: { value: 1 },
    };
    const geo = new THREE.BufferGeometry();
    // One oversized triangle covers the screen.
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.post = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: POST_FS, uniforms: this.uniforms, depthTest: false, depthWrite: false }));
    this.post.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.post);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  // overlay: the first-person weapons, drawn over the world with a fresh depth buffer.
  render(scene, camera, fx, overlay = null) {
    const r = this.renderer;
    const u = this.uniforms;
    u.glitch.value = fx.glitch || 0;
    u.time.value = fx.time || 0;
    u.flashAmt.value = fx.flashAmt || 0;
    if (fx.flash) u.flash.value.set(fx.flash);
    u.fade.value = fx.fade ?? 1;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    if (overlay) {
      r.autoClear = false;
      r.clearDepth();
      r.render(overlay.scene, overlay.camera);
      r.autoClear = true;
    }
    r.setRenderTarget(null);
    r.render(this.postScene, this.postCam);
  }
}
