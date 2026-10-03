/**
 * `--rich-device-pixel-ratio` on `root`: `devicePixelRatio`, kept current as
 * the page zooms or moves to a screen of another density.
 *
 * custom.css rounds the line height static and live output share up to whole
 * device pixels with it, because xterm makes a row a whole number of device
 * pixels: its DOM renderer takes the ceiling of the measured character height
 * times `devicePixelRatio`. The ratio is passed, not one device pixel, so the
 * CSS does that same multiplication and lands where xterm's floats land.
 */
export function trackDevicePixelRatio(root: HTMLElement): void {
  const ratio = devicePixelRatio;
  root.style.setProperty("--rich-device-pixel-ratio", String(ratio));
  matchMedia(`(resolution: ${ratio}dppx)`).addEventListener("change", () => trackDevicePixelRatio(root), { once: true });
}
