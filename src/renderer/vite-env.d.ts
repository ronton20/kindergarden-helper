/// <reference types="vite/client" />

/** Files imported with `?gzip-base64` arrive as a gzipped, base64 string. */
declare module '*?gzip-base64' {
  const packed: string;
  export default packed;
}
