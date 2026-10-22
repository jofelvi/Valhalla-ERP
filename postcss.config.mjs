/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // 1. Tailwind genera el CSS con oklch y color-mix
    '@tailwindcss/postcss': {},
    // 2. postcss-preset-env transpila oklch->rgb, color-mix->fallback, etc.
    'postcss-preset-env': {
      stage: 2,
      features: {
        'oklab-function': true,
        'color-mix': true,
      },
    },
    // 3. autoprefixer agrega prefijos de vendor (-webkit-, etc.)
    autoprefixer: {},
  },
};

export default config;
