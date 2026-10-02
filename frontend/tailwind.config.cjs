module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        docugreen: {
          950: '#031b15',
          900: '#082b1f',
          800: '#0d5135',
          700: '#177344',
          600: '#0d6f45',
          500: '#09b17b',
          100: '#e4f8ee',
          50: '#f2f6f3',
        },
      },
    },
  },
  plugins: [],
};