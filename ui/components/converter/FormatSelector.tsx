'use client';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { FORMATS_BY_CATEGORY, getFormatInfo } from '@/lib/constants';
import type { OutputFormat } from '@/types/converter';

export interface FormatSelectorProps {
  value: OutputFormat;
  onChange: (value: OutputFormat) => void;
  id?: string;
}

export function FormatSelector({ value, onChange, id = 'format-select' }: FormatSelectorProps) {
  const info = getFormatInfo(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Output format</Label>
      <Select value={value} onValueChange={(v) => onChange(v as OutputFormat)}>
        <SelectTrigger id={id} aria-label="Output format" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(['Web', 'Print', 'Legacy'] as const).map((cat) => (
            <SelectGroup key={cat}>
              <SelectLabel>{cat === 'Web' ? 'Web Formats' : cat === 'Print' ? 'Print Formats' : 'Legacy'}</SelectLabel>
              {FORMATS_BY_CATEGORY[cat].map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="shrink-0 uppercase">
          {info.label}
        </Badge>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {info.description}
        </p>
      </div>
    </div>
  );
}
