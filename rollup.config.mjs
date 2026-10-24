import typescript from '@rollup/plugin-typescript';

const input = 'src/index.ts';

function createConfig(file, format, compact = false) {
  return {
    input,
    plugins: [typescript({ tsconfig: './tsconfig.json', declaration: true, declarationDir: 'dist' })],
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
