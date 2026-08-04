// Empty stub for Node core modules (fs, stream, crypto) that libraries such as
// `xlsx` reference behind `typeof require !== 'undefined'` guards. React Native
// has no Node core, and we never touch those code paths (we only call
// `XLSX.write({ type: 'base64' })`), so an empty object is safe.
module.exports = {};
