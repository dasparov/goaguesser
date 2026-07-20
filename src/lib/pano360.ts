// Minimal WebGL equirectangular 360° viewer.
//
// Renders a fullscreen quad; the fragment shader casts a view ray per pixel
// from yaw/pitch/fov and samples an equirectangular texture. No sphere mesh,
// no scene graph, no dependencies.

export interface Pano360 {
  setTexture(img: HTMLImageElement): void;
  destroy(): void;
}

const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Builds a view ray per pixel from yaw/pitch/fov and a per-pixel aspect
// correction, rotates it by yaw (around Y) then pitch (around X), and
// samples the equirect texture with the standard atan2/acos mapping.
const FRAG_SRC = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uYaw;
uniform float uPitch;
uniform float uFov;
uniform float uAspect;

const float PI = 3.14159265358979323846;

void main() {
  // Normalized device coords in [-1, 1], corrected for aspect ratio.
  vec2 ndc = vUv * 2.0 - 1.0;
  float tanHalfFov = tan(uFov * 0.5);
  vec3 dir = normalize(vec3(ndc.x * tanHalfFov * uAspect, ndc.y * tanHalfFov, -1.0));

  // Pitch: rotate around X axis.
  float cp = cos(uPitch);
  float sp = sin(uPitch);
  vec3 d1 = vec3(dir.x, dir.y * cp - dir.z * sp, dir.y * sp + dir.z * cp);

  // Yaw: rotate around Y axis.
  float cy = cos(uYaw);
  float sy = sin(uYaw);
  vec3 d2 = vec3(d1.x * cy + d1.z * sy, d1.y, -d1.x * sy + d1.z * cy);

  float u = atan(d2.x, -d2.z) / (2.0 * PI) + 0.5;
  float v = acos(clamp(d2.y, -1.0, 1.0)) / PI;

  gl_FragColor = texture2D(uTex, vec2(u, v));
}
`;

const MIN_FOV = (35 * Math.PI) / 180;
const MAX_FOV = (100 * Math.PI) / 180;
const DEFAULT_FOV = (75 * Math.PI) / 180;
const MAX_PITCH = (85 * Math.PI) / 180;
const MOMENTUM_DECAY = 0.88; // per-frame decay while coasting
const MOMENTUM_STOP_THRESHOLD = 0.00005; // rad/frame below which coasting stops

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('pano360: failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`pano360: shader compile error: ${info ?? 'unknown'}`);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  const program = gl.createProgram();
  if (!program) throw new Error('pano360: failed to create program');
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`pano360: program link error: ${info ?? 'unknown'}`);
  }
  // Shaders are retained by the program once linked; individual objects
  // can be deleted without affecting it.
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

export function createPano360(canvas: HTMLCanvasElement): Pano360 {
  const glOrNull = canvas.getContext('webgl', { antialias: true, alpha: false }) as
    | WebGLRenderingContext
    | null;
  if (!glOrNull) throw new Error('pano360: WebGL is not available');
  // Aliased to a definitely-non-null binding: TS re-widens `gl` to include
  // `null` inside closures declared below (e.g. resize/render), since it
  // can't prove those run only after this check.
  const gl: WebGLRenderingContext = glOrNull;

  const program = createProgram(gl);
  gl.useProgram(program);

  // Fullscreen quad as two triangles.
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTex = gl.getUniformLocation(program, 'uTex');
  const uYaw = gl.getUniformLocation(program, 'uYaw');
  const uPitch = gl.getUniformLocation(program, 'uPitch');
  const uFov = gl.getUniformLocation(program, 'uFov');
  const uAspect = gl.getUniformLocation(program, 'uAspect');

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let hasTexture = false;
  let yaw = 0;
  let pitch = 0;
  let fov = DEFAULT_FOV;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let velYaw = 0;
  let velPitch = 0;
  let momentumActive = false;

  // Pinch-zoom tracking, keyed by pointerId.
  const activePointers = new Map<number, { x: number; y: number }>();
  let pinchStartDist = 0;
  let pinchStartFov = 0;

  let rafId: number | null = null;
  let destroyed = false;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const displayHeight = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    requestRender();
  }

  function render() {
    if (destroyed) return;
    gl.useProgram(program);
    gl.uniform1f(uYaw, yaw);
    gl.uniform1f(uPitch, pitch);
    gl.uniform1f(uFov, fov);
    gl.uniform1f(uAspect, canvas.width / Math.max(1, canvas.height));
    if (hasTexture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uTex, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function requestRender() {
    if (destroyed || rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      render();
    });
  }

  function tickMomentum() {
    if (destroyed) return;
    if (!momentumActive) return;
    yaw += velYaw;
    pitch = clampPitch(pitch + velPitch);
    velYaw *= MOMENTUM_DECAY;
    velPitch *= MOMENTUM_DECAY;
    if (Math.abs(velYaw) < MOMENTUM_STOP_THRESHOLD && Math.abs(velPitch) < MOMENTUM_STOP_THRESHOLD) {
      momentumActive = false;
      velYaw = 0;
      velPitch = 0;
    }
    render();
    if (momentumActive) {
      requestAnimationFrame(tickMomentum);
    }
  }

  function clampPitch(p: number): number {
    return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, p));
  }

  function clampFov(f: number): number {
    return Math.max(MIN_FOV, Math.min(MAX_FOV, f));
  }

  // Drag sensitivity scales with fov: zoomed in (small fov) drags finer.
  function sensitivity(): number {
    return fov / canvas.clientHeight;
  }

  function onPointerDown(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size === 1) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      momentumActive = false;
      velYaw = 0;
      velPitch = 0;
    } else if (activePointers.size === 2) {
      dragging = false;
      const pts = [...activePointers.values()];
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartFov = fov;
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      const pts = [...activePointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchStartDist > 0) {
        // Pinching out (dist grows) zooms in (fov shrinks).
        const ratio = pinchStartDist / Math.max(1, dist);
        fov = clampFov(pinchStartFov * ratio);
        requestRender();
      }
      return;
    }

    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const s = sensitivity();
    const dYaw = -dx * s;
    const dPitch = dy * s;
    yaw += dYaw;
    pitch = clampPitch(pitch + dPitch);
    velYaw = dYaw;
    velPitch = dPitch;
    requestRender();
  }

  function endPointer(e: PointerEvent) {
    activePointers.delete(e.pointerId);
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    if (activePointers.size < 2) {
      pinchStartDist = 0;
    }
    if (activePointers.size === 0 && dragging) {
      dragging = false;
      if (Math.abs(velYaw) > MOMENTUM_STOP_THRESHOLD || Math.abs(velPitch) > MOMENTUM_STOP_THRESHOLD) {
        momentumActive = true;
        requestAnimationFrame(tickMomentum);
      }
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    fov = clampFov(fov + e.deltaY * 0.001 * fov);
    requestRender();
  }

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(canvas);
  resize();

  return {
    setTexture(img: HTMLImageElement) {
      if (destroyed) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      hasTexture = true;
      requestRender();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      momentumActive = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('wheel', onWheel);
      gl.deleteTexture(texture);
      gl.deleteBuffer(quadBuffer);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
