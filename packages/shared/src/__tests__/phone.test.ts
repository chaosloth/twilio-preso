import { describe, expect, test } from 'vitest';
import { telLink, whatsappLink } from '../phone.js';

describe('contact links', () => {
  test('wa.me takes the number without a plus or punctuation', () => {
    expect(whatsappLink('+61 468 157 727')).toBe('https://wa.me/61468157727');
    expect(whatsappLink('+6560349453')).toBe('https://wa.me/6560349453');
  });

  test('tel: keeps the plus, so the dialler knows it is international', () => {
    expect(telLink('+6560349453')).toBe('tel:+6560349453');
    expect(telLink('+61 468 157 727')).toBe('tel:+61468157727');
  });
});
