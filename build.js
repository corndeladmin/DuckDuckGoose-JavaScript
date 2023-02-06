// compile and bundle typescript
require("esbuild").build({
  entryPoints: ["src/app.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  outfile: "dist/app.js",
}).then(() => console.debug("Built app"));

// copy static files
require("copyfiles")(
  ["src/views/**/*", "src/static/**/*", "dist"],
  {
    verbose: true,
    up: 1,
  },
  () => console.debug("Copied static files"),
);
