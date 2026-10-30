"use client";

import type { VideoMaterial } from "./schemas";

const MAX_FRAMES = 16;
const MAX_WIDTH = 640;
const JPEG_QUALITY = 0.65;

/**
 * Which moments to capture: dense in the first seconds (the hook decides whether people
 * scroll past), evenly spread after that, and one near the end for the end card / CTA.
 */
export function pickTimes(duration: number): number[] {
  const end = Math.max(0, duration - 0.3);
  if (duration <= MAX_FRAMES) {
    const times = [];
    for (let t = 0.2; t < end; t += 1) times.push(t);
    times.push(end);
    return dedupe(times);
  }
  const hook = [0.2, 1, 2, 3];
  const rest = MAX_FRAMES - hook.length - 1;
  const step = (end - 4) / (rest + 1);
  const middle = Array.from({ length: rest }, (_, i) => 4 + step * (i + 1));
  return dedupe([...hook, ...middle, end]);
}

function dedupe(times: number[]) {
  return times.filter((t, i) => i === 0 || t - times[i - 1] >= 0.4);
}

function once(el: HTMLVideoElement, event: "loadedmetadata" | "seeked" | "loadeddata") {
  return new Promise<void>((resolve, reject) => {
    const onError = () => {
      cleanup();
      reject(new Error("Browseren kan ikke afspille denne video. Prøv en mp4 (H.264)."));
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      el.removeEventListener(event, onEvent);
      el.removeEventListener("error", onError);
    };
    el.addEventListener(event, onEvent, { once: true });
    el.addEventListener("error", onError, { once: true });
  });
}

/** Decodes the video locally (it is never uploaded) and returns JPEG stills with timestamps. */
export async function extractFrames(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<Omit<VideoMaterial, "script">> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await once(video, "loadedmetadata");
    if (video.duration === Infinity) {
      // Recorder-made webm files often lack a duration; seeking far ahead makes the browser compute it.
      video.currentTime = 1e9;
      await once(video, "seeked");
      video.currentTime = 0;
      await once(video, "seeked");
    }
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth) {
      throw new Error("Kunne ikke læse videoens længde eller billede. Prøv en mp4 (H.264).");
    }
    if (video.readyState < 2) await once(video, "loadeddata");

    const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d")!;

    const times = pickTimes(video.duration);
    const frames: VideoMaterial["frames"] = [];
    for (const [i, t] of times.entries()) {
      video.currentTime = t;
      await once(video, "seeked");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      frames.push({ t, data: dataUrl.slice(dataUrl.indexOf(",") + 1) });
      onProgress?.(i + 1, times.length);
    }
    return { fileName: file.name, duration: video.duration, frames };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
