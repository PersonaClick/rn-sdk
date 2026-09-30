import DataEncoder from "../utils.js";
import { SEARCH_QUERY_KEYS } from '../../constants/search-keys.constants.js';

describe('DataEncoder', () => {
  let encoder;

  beforeEach(() => {
    encoder = new DataEncoder();
  });

  describe('encode', () => {
    test('encodes a flat object into query string', () => {
      const input = {
        name: 'Ivan Ivanov',
        age: 30,
        city: 'New York',
      };
      const result = encoder.encode(input);
      expect(result).toBe('name=Ivan%20Ivanov&age=30&city=New%20York');
    });

    test('encodes a nested object into query string', () => {
      const input = {
        user: {
          name: 'Ivan',
          details: {
            age: 30,
            city: 'New York',
          },
        },
      };
      const result = encoder.encode(input);
      expect(result).toBe('user[name]=Ivan&user[details][age]=30&user[details][city]=New%20York');
    });

    test('encodes arrays correctly with SEARCH_QUERY_KEYS', () => {
      const input = {
        categories: ['category1', 'category2', 'category3'],
      };
      const result = encoder.encode(input);
      // Joined with commas and encoded as one value, so the round trip keeps the list intact.
      expect(result).toBe('categories=category1%2Ccategory2%2Ccategory3');
      expect(encoder.convertToObject(result)).toEqual({ categories: 'category1,category2,category3' });
    });

    test('encodes arrays correctly without SEARCH_QUERY_KEYS', () => {
      const input = {
        items: ['item1', 'item2'],
      };
      const result = encoder.encode(input);
      expect(result).toBe('items[0]=item1&items[1]=item2');
    });
  });

  describe('convertToObject', () => {
    test('decodes a query string into an object', () => {
      const input = 'name=John%20Doe&age=30&city=New%20York';
      const result = encoder.convertToObject(input);
      expect(result).toEqual({
        name: 'John Doe',
        age: '30',
        city: 'New York',
      });
    });

    test('round-trips reserved characters inside values', () => {
      const input = {
        search_query: '1+1 & more',
        filters: JSON.stringify({ 'Материал корпуса': ['Металл'] }),
        url: 'https://example.com/a?b=1',
      };
      expect(encoder.convertToObject(encoder.encode(input))).toEqual(input);
    });

    test('handles nested query strings', () => {
      const input = 'user[name]=John&user[details][age]=30&user[details][city]=New%20York';
      const result = encoder.convertToObject(input);
      expect(result).toEqual({
        'user[name]': 'John',
        'user[details][age]': '30',
        'user[details][city]': 'New York',
      });
    });
  });

  describe('error cases', () => {
    test('throws an error when actualKey is not set', () => {
      const encoder = new DataEncoder();

      encoder.actualKey = null;

      expect(() => encoder.__dataEncoding(['item1', 'item2'])).toThrow(
        'Directly passed array does not work'
      );
    });

    test('returns null for non-object inputs', () => {
      expect(encoder.encode(null)).toBeNull();
      expect(encoder.encode(42)).toBeNull();
      expect(encoder.encode('string')).toBeNull();
    });
  });
});
