import type { FilterParameters } from './render';

export interface SourceRect { x: number; y: number; width: number; height: number }
export type RenderBackend = 'webgl2' | 'canvas2d';
type RenderSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | HTMLVideoElement;

export function renderImage(
  source: RenderSource,
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
  parameters: FilterParameters,
  sourceRect: SourceRect = { x: 0, y: 0, width: sourceWidth, height: sourceHeight },
  forceCanvas = false,
): { canvas: HTMLCanvasElement; backend: RenderBackend } {
  let canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(outputWidth));
  canvas.height = Math.max(1, Math.round(outputHeight));
  // Never upload a full-resolution photo just to produce a small preview.
  // Large source textures can exhaust GPU memory even when the output canvas
  // is only a few hundred pixels wide (especially across filter thumbnails).
  let gpuSource = source;
  let gpuWidth = sourceWidth;
  let gpuHeight = sourceHeight;
  let gpuRect = sourceRect;
  if (sourceRect.x !== 0 || sourceRect.y !== 0 || sourceRect.width !== canvas.width || sourceRect.height !== canvas.height) {
    const staging = document.createElement('canvas');
    staging.width = canvas.width;
    staging.height = canvas.height;
    const stagingContext = staging.getContext('2d');
    if (stagingContext) {
      stagingContext.drawImage(source, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, 0, 0, staging.width, staging.height);
      gpuSource = staging;
      gpuWidth = staging.width;
      gpuHeight = staging.height;
      gpuRect = { x: 0, y: 0, width: staging.width, height: staging.height };
    }
  }
  if (!forceCanvas && renderWebGl(canvas, gpuSource, gpuWidth, gpuHeight, parameters, gpuRect)) return { canvas, backend: 'webgl2' };
  // A canvas cannot switch to 2D after a WebGL context was created.
  canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(outputWidth));
  canvas.height = Math.max(1, Math.round(outputHeight));
  renderCanvas2d(canvas, source, parameters, sourceRect);
  return { canvas, backend: 'canvas2d' };
}

export function releaseRenderResources(canvas: HTMLCanvasElement, backend: RenderBackend) {
  if (backend === 'webgl2') {
    // Shrinking releases the drawing buffer without repeatedly forcing
    // WEBGL_lose_context, which can destabilize some Windows GPU drivers.
    canvas.width = 1;
    canvas.height = 1;
  }
}

export function transformPixel(red: number, green: number, blue: number, parameters: FilterParameters): [number, number, number] {
  let r = red / 255;
  let g = green / 255;
  let b = blue / 255;
  const exposure = 2 ** parameters.exposure;
  r *= parameters.brightness * exposure; g *= parameters.brightness * exposure; b *= parameters.brightness * exposure;
  r = (r - 0.5) * parameters.contrast + 0.5;
  g = (g - 0.5) * parameters.contrast + 0.5;
  b = (b - 0.5) * parameters.contrast + 0.5;
  let luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const toneShift = parameters.shadows * (1 - clamp01(luminance)) ** 2 * 0.35 + parameters.highlights * clamp01(luminance) ** 2 * 0.35;
  r += toneShift; g += toneShift; b += toneShift;
  luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
  r = luminance + (r - luminance) * parameters.saturation;
  g = luminance + (g - luminance) * parameters.saturation;
  b = luminance + (b - luminance) * parameters.saturation;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const vibrance = 1 + parameters.vibrance * (1 - clamp01(chroma));
  r = luminance + (r - luminance) * vibrance; g = luminance + (g - luminance) * vibrance; b = luminance + (b - luminance) * vibrance;
  r += parameters.temperature * 0.15; b -= parameters.temperature * 0.15;
  r += parameters.tint * 0.05; g -= parameters.tint * 0.08; b += parameters.tint * 0.05;
  const gray = r * 0.299 + g * 0.587 + b * 0.114;
  r = mix(r, gray, parameters.grayscale); g = mix(g, gray, parameters.grayscale); b = mix(b, gray, parameters.grayscale);
  const sepiaR = r * 0.393 + g * 0.769 + b * 0.189;
  const sepiaG = r * 0.349 + g * 0.686 + b * 0.168;
  const sepiaB = r * 0.272 + g * 0.534 + b * 0.131;
  return [toByte(mix(r, sepiaR, parameters.sepia)), toByte(mix(g, sepiaG, parameters.sepia)), toByte(mix(b, sepiaB, parameters.sepia))];
}

function renderCanvas2d(canvas: HTMLCanvasElement, source: RenderSource, parameters: FilterParameters, rect: SourceRect) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas rendering is not supported.');
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const sourcePixels = new Uint8ClampedArray(image.data);
  const sample = (x: number, y: number, channel: number) => sourcePixels[(Math.max(0, Math.min(canvas.height - 1, y)) * canvas.width + Math.max(0, Math.min(canvas.width - 1, x))) * 4 + channel];
  for (let index = 0; index < image.data.length; index += 4) {
    const pixel = index / 4;
    const x = pixel % canvas.width;
    const y = Math.floor(pixel / canvas.width);
    const sharpen = (channel: number) => {
      const center = sample(x, y, channel);
      const detail = center * 4 - sample(x - 1, y, channel) - sample(x + 1, y, channel) - sample(x, y - 1, channel) - sample(x, y + 1, channel);
      return center + detail * parameters.sharpness * 0.35;
    };
    let [r, g, b] = transformPixel(sharpen(0), sharpen(1), sharpen(2), parameters);
    const nx = (x + 0.5) / canvas.width - 0.5;
    const ny = (y + 0.5) / canvas.height - 0.5;
    const vignette = 1 - parameters.vignette * smoothstep(0.2, 0.72, Math.hypot(nx, ny)) * 0.65;
    r = Math.round(r * vignette); g = Math.round(g * vignette); b = Math.round(b * vignette);
    image.data[index] = r; image.data[index + 1] = g; image.data[index + 2] = b;
  }
  context.putImageData(image, 0, 0);
}

function renderWebGl(canvas: HTMLCanvasElement, source: RenderSource, sourceWidth: number, sourceHeight: number, p: FilterParameters, rect: SourceRect) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false });
  if (!gl) return false;
  try {
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (sourceWidth > maxTextureSize || sourceHeight > maxTextureSize) return false;
    const program = createProgram(gl);
    gl.useProgram(program);
    const vertices = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, -1,1,0,1, 1,-1,1,0, 1,1,1,1]);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'a_position'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
    const uv = gl.getAttribLocation(program, 'a_uv'); gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    // WebGL texture coordinates start at the bottom after UNPACK_FLIP_Y.
    uniform2(gl, program, 'u_uv_offset', rect.x / sourceWidth, 1 - (rect.y + rect.height) / sourceHeight);
    uniform2(gl, program, 'u_uv_scale', rect.width / sourceWidth, rect.height / sourceHeight);
    uniform1(gl, program, 'u_brightness', p.brightness); uniform1(gl, program, 'u_contrast', p.contrast);
    uniform1(gl, program, 'u_saturation', p.saturation); uniform1(gl, program, 'u_exposure', p.exposure);
    uniform1(gl, program, 'u_highlights', p.highlights); uniform1(gl, program, 'u_shadows', p.shadows);
    uniform1(gl, program, 'u_temperature', p.temperature); uniform1(gl, program, 'u_tint', p.tint);
    uniform1(gl, program, 'u_vibrance', p.vibrance); uniform1(gl, program, 'u_sharpness', p.sharpness);
    uniform1(gl, program, 'u_vignette', p.vignette);
    uniform2(gl, program, 'u_texel', 1 / sourceWidth, 1 / sourceHeight);
    uniform1(gl, program, 'u_grayscale', p.grayscale); uniform1(gl, program, 'u_sepia', p.sepia);
    gl.viewport(0, 0, canvas.width, canvas.height); gl.drawArrays(gl.TRIANGLES, 0, 6);
    return true;
  } catch { return false; }
}

const VERTEX = `#version 300 es\nin vec2 a_position; in vec2 a_uv; out vec2 v_uv; void main(){ gl_Position=vec4(a_position,0,1); v_uv=a_uv; }`;
const FRAGMENT = `#version 300 es\nprecision highp float; uniform sampler2D u_image; uniform vec2 u_uv_offset,u_uv_scale,u_texel; uniform float u_brightness,u_contrast,u_saturation,u_exposure,u_highlights,u_shadows,u_temperature,u_tint,u_vibrance,u_sharpness,u_vignette,u_grayscale,u_sepia; in vec2 v_uv; out vec4 outColor; void main(){ vec2 uv=u_uv_offset+v_uv*u_uv_scale; vec4 src=texture(u_image,uv); vec3 detail=src.rgb*4.-texture(u_image,uv+vec2(u_texel.x,0)).rgb-texture(u_image,uv-vec2(u_texel.x,0)).rgb-texture(u_image,uv+vec2(0,u_texel.y)).rgb-texture(u_image,uv-vec2(0,u_texel.y)).rgb; vec3 c=src.rgb+detail*u_sharpness*.35; c*=u_brightness*exp2(u_exposure); c=(c-.5)*u_contrast+.5; float l=dot(c,vec3(.2126,.7152,.0722)); float shift=u_shadows*pow(1.-clamp(l,0.,1.),2.)*.35+u_highlights*pow(clamp(l,0.,1.),2.)*.35; c+=vec3(shift); l=dot(c,vec3(.2126,.7152,.0722)); c=vec3(l)+(c-vec3(l))*u_saturation; float chroma=max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b)); c=vec3(l)+(c-vec3(l))*(1.+u_vibrance*(1.-clamp(chroma,0.,1.))); c.r+=u_temperature*.15+u_tint*.05; c.g-=u_tint*.08; c.b-=u_temperature*.15-u_tint*.05; float gray=dot(c,vec3(.299,.587,.114)); c=mix(c,vec3(gray),u_grayscale); vec3 sepia=vec3(dot(c,vec3(.393,.769,.189)),dot(c,vec3(.349,.686,.168)),dot(c,vec3(.272,.534,.131))); c=mix(c,sepia,u_sepia); float vig=1.-u_vignette*smoothstep(.2,.72,distance(v_uv,vec2(.5)))*.65; outColor=vec4(clamp(c*vig,0.,1.),src.a); }`;
function createProgram(gl: WebGL2RenderingContext) { const program=gl.createProgram()!; for (const [type,source] of [[gl.VERTEX_SHADER,VERTEX],[gl.FRAGMENT_SHADER,FRAGMENT]] as const) { const shader=gl.createShader(type)!; gl.shaderSource(shader,source); gl.compileShader(shader); if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader failed'); gl.attachShader(program,shader); } gl.linkProgram(program); if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Link failed'); return program; }
function uniform1(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, value: number) { gl.uniform1f(gl.getUniformLocation(program,name),value); }
function uniform2(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, a: number, b: number) { gl.uniform2f(gl.getUniformLocation(program,name),a,b); }
function mix(a:number,b:number,t:number){return a*(1-t)+b*t;} function clamp01(value:number){return Math.max(0,Math.min(1,value));} function toByte(value:number){return Math.round(clamp01(value)*255);} function smoothstep(edge0:number,edge1:number,value:number){const x=clamp01((value-edge0)/(edge1-edge0));return x*x*(3-2*x);}
