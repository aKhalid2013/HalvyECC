import { toCamel } from '../transforms';

describe('transforms', () => {
  describe('toCamel', () => {
    it('converts snake_case database response objects to camelCase', () => {
      const input = { created_at: 'x', display_name: 'Y' };
      const output = toCamel(input);
      expect(output).toEqual({ createdAt: 'x', displayName: 'Y' });
    });

    it('recurses into nested objects', () => {
      const input = {
        user_profile: {
          first_name: 'John',
          last_name: 'Doe',
        }
      };
      const output = toCamel(input);
      expect(output).toEqual({
        userProfile: {
          firstName: 'John',
          lastName: 'Doe',
        }
      });
    });

    it('does not mutate the input object', () => {
      const input = { created_at: 'x', display_name: 'Y' };
      toCamel(input);
      expect(input).toEqual({ created_at: 'x', display_name: 'Y' });
    });

    it('passes arrays through without snake_case conversion on elements', () => {
      const input = {
        items_list: ['first_item', 'second_item', { nested_key: 'value' }]
      };
      const output = toCamel(input) as any;
      expect(output.itemsList[0]).toBe('first_item');
      expect(output.itemsList[1]).toBe('second_item');
      expect(output.itemsList[2]).toEqual({ nestedKey: 'value' });
    });

    it('handles null and undefined', () => {
      expect(toCamel(null)).toBeNull();
      expect(toCamel(undefined)).toBeUndefined();
    });

    it('handles dates and other objects gracefully', () => {
      const date = new Date();
      const input = {
        created_at: date,
      };
      const output = toCamel(input) as any;
      expect(output.createdAt).toBe(date);
    });
  });
});
