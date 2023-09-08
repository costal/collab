const { build } = require("esbuild");
const glob = require("glob");

const { dependencies, peerDependencies } = require('./package.json')

const sharedConfig = {
  entryPoints: ["./src/index.ts"],
  bundle: true,
  external: Object.keys(dependencies).concat(Object.keys(peerDependencies || [])),
};

build({
  ...sharedConfig,
  platform: 'node', // for CJS
  outdir: "dist"
});

// build({

//   ...sharedConfig,

//   outfile: "dist/index.esm.js",

//   platform: 'neutral', // for ESM

//   format: "esm",

// });