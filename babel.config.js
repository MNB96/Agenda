module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // babel-preset-expo's Flow-strip pass runs on .ts/.tsx too and rejects TS's `declare` class
    // fields by default — needed for the brand-field nominal-typing pattern used across the domain.
    plugins: [['@babel/plugin-transform-flow-strip-types', { allowDeclareFields: true }]],
  }
}
