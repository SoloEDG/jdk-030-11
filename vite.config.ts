import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 目录名含非 ASCII 字符时 .pathname 会是百分号编码，需要解码回真实路径
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { "@": decodeURIComponent(new URL("./src", import.meta.url).pathname) } },
});
