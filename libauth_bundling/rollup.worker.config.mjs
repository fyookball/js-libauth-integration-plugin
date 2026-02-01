// rollup.worker.config.mjs
import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "service.mjs",
  output: {
    file: "libauth_service.bundle.mjs",
    format: "es",
  },
  plugins: [resolve()],
};

