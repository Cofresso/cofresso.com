'use client';

import { Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { GRIND_OPTIONS } from '@/lib/catalog/labels';
import type { Grind } from '@/lib/db/schema';

export function GrindSelector({
  value,
  onChange,
}: {
  value: Grind;
  onChange: (grind: Grind) => void;
}) {
  return (
    <div>
      <Label htmlFor="grind">Grind</Label>
      <Select
        id="grind"
        name="grind"
        value={value}
        onChange={(e) => onChange(e.target.value as Grind)}
        data-testid="grind-select"
      >
        {GRIND_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <p className="text-latte mt-1 text-xs">We grind to order. Whole bean stays fresh longest.</p>
    </div>
  );
}
