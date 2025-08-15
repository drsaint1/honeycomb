module.exports = {
  // Extend the base configuration
  extends: [
    '@eslint/js/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  
  // Override some rules to reduce noise
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn', 
    '@typescript-eslint/ban-ts-comment': 'warn',
    'no-prototype-builtins': 'warn',
    'prefer-const': 'warn',
    'react-hooks/exhaustive-deps': 'warn'
  }
};