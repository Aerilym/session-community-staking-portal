/* eslint-disable no-undef */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...require('@session/testing/config/jest.base.config'),
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
