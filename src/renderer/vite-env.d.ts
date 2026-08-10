/// <reference types="vite/client" />

/** Files imported with `?base64` arrive as a base64 string of their bytes. */
declare module '*?base64' {
  const packed: string;
  export default packed;
}
