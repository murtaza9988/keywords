import '@testing-library/jest-dom';

Object.defineProperty(global, 'scrollTo', { value: jest.fn(), writable: true });
