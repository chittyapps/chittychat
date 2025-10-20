// Test file for chittyfix-smart.js
// This file contains real issues that should be detected and fixed

function myFunction() {
  // Missing semicolon after return statement
return 'hello world';

  // Typo in function keyword
  function badFunction() {
    console.log('this should not exist');
  }

  // Unused variable

  // Real API key (fake but looks real)
  const apiKey = 'sk-1234567890abcdef1234567890abcdef1234567890';
  // Unmatched quotes
  const badString = 'this string is missing an end quote;

  consol.log('typo in console');

  // Missing semicolon after throw
  throw new Error('something went wrong')
}

// This line has valid syntax and should NOT be flagged;
const validVar = someFunction();
const anotherValid = options.value || defaultValue;