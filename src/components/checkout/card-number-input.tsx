'use client';

import { useState } from 'react';
import { Input, type InputProps } from '@/components/ui/input';

function groupDigits(value: string) {
  return value
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function CardNumberInput(
  props: Omit<InputProps, 'value' | 'onChange'> & { defaultValue?: string },
) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  return (
    <Input
      {...props}
      inputMode="numeric"
      autoComplete="cc-number"
      placeholder="4242 4242 4242 4242"
      value={value}
      onChange={(e) => setValue(groupDigits(e.target.value))}
    />
  );
}
