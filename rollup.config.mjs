import typescript from '@rollup/plugin-typescript';

const input = 'src/index.ts';

function createConfig(file, format, compact = false) {
  return {
    input,
    plugins: [typescript({ tsconfig: './tsconfig.build.json' })],
    output: {
      file,
      format,
      sourcemap: true,
      ...(format === 'cjs' ? { exports: 'named', compact } : {}),
    },
  };
}

export default [
  createConfig('dist/youtube-transcript.mjs', 'esm'),
  createConfig('dist/youtube-transcript.common.js', 'cjs', true),
];
