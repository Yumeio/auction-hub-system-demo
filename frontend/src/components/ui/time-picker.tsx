import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface TimePickerProps {
  value: { hours: number; minutes: number };
  onChange: (value: { hours: number; minutes: number }) => void;
  label?: string;
}

export function TimePicker({ value, onChange, label }: TimePickerProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Select
          value={value.hours.toString().padStart(2, '0')}
          onValueChange={(h) => onChange({ ...value, hours: parseInt(h) })}
        >
          <SelectTrigger className="w-20">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent className="bg-popover max-h-48">
            {hours.map((h) => (
              <SelectItem key={h} value={h.toString().padStart(2, '0')}>
                {h.toString().padStart(2, '0')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="flex items-center text-muted-foreground">:</span>
        <Select
          value={value.minutes.toString().padStart(2, '0')}
          onValueChange={(m) => onChange({ ...value, minutes: parseInt(m) })}
        >
          <SelectTrigger className="w-20">
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent className="bg-popover max-h-48">
            {minutes.map((m) => (
              <SelectItem key={m} value={m.toString().padStart(2, '0')}>
                {m.toString().padStart(2, '0')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
