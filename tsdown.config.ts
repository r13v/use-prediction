import { defineConfig } from "tsdown"

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  entry: {
    index: "lib/use-prediction.ts",
  },
  format: ["esm", "cjs"],
  platform: "neutral",
  fixedExtension: false,
  dts: true,
  sourcemap: true,
  clean: true,
  deps: {
    neverBundle: true,
    dts: {
      neverBundle: true,
    },
  },
  tsconfig: "tsconfig.build.json",
})
