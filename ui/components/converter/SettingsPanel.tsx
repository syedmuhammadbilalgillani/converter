'use client';

import { useId } from 'react';
import {
  ArrowClockwiseIcon,
  ArrowsHorizontalIcon,
  ArrowsVerticalIcon,
} from '@phosphor-icons/react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getFormatInfo } from '@/lib/constants';
import type { ConvertImageDto, OutputFormat, ResizeMode } from '@/types/converter';

export interface SettingsValue {
  // resize
  width?: number;
  height?: number;
  maintainAspectRatio: boolean;
  resizeMode: ResizeMode;
  // quality
  quality: number;
  // adjustments
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  gamma: number;
  normalize: boolean;
  // transform
  rotate: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  // effects
  grayscale: boolean;
  sharpen: boolean;
  blur: number;
  // metadata
  stripMetadata: boolean;
  // output
  outputFileName: string;
  backgroundColor: string;
}

export const DEFAULT_SETTINGS: SettingsValue = {
  maintainAspectRatio: true,
  resizeMode: 'cover',
  quality: 85,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  gamma: 1,
  normalize: false,
  rotate: 0,
  flipHorizontal: false,
  flipVertical: false,
  grayscale: false,
  sharpen: false,
  blur: 0,
  stripMetadata: false,
  outputFileName: '',
  backgroundColor: '#ffffff',
};

export function settingsToDto(
  fileId: string,
  outputFormat: OutputFormat,
  s: SettingsValue,
): ConvertImageDto {
  const dto: ConvertImageDto = {
    fileId,
    outputFormat,
    quality: s.quality,
    maintainAspectRatio: s.maintainAspectRatio,
    resizeMode: s.resizeMode,
    rotate: s.rotate,
    flipHorizontal: s.flipHorizontal,
    flipVertical: s.flipVertical,
    grayscale: s.grayscale,
    sharpen: s.sharpen,
    normalize: s.normalize,
    stripMetadata: s.stripMetadata,
    gamma: s.gamma,
  };
  if (s.width) dto.width = s.width;
  if (s.height) dto.height = s.height;
  if (s.brightness !== 0) dto.brightness = s.brightness;
  if (s.contrast !== 0) dto.contrast = s.contrast;
  if (s.saturation !== 0) dto.saturation = s.saturation;
  if (s.hue !== 0) dto.hue = s.hue;
  if (s.blur > 0.3) dto.blur = s.blur;
  if (s.outputFileName.trim()) dto.outputFileName = s.outputFileName.trim();
  if (outputFormat === 'jpeg' && s.backgroundColor) dto.backgroundColor = s.backgroundColor;
  return dto;
}

export interface SettingsPanelProps {
  value: SettingsValue;
  onChange: (next: SettingsValue) => void;
  outputFormat: OutputFormat;
}

export function SettingsPanel({ value, onChange, outputFormat }: SettingsPanelProps) {
  const info = getFormatInfo(outputFormat);
  const ids = {
    width: useId(),
    height: useId(),
    maintain: useId(),
    resizeMode: useId(),
    quality: useId(),
    brightness: useId(),
    contrast: useId(),
    saturation: useId(),
    hue: useId(),
    gamma: useId(),
    normalize: useId(),
    flipH: useId(),
    flipV: useId(),
    grayscale: useId(),
    sharpen: useId(),
    blur: useId(),
    strip: useId(),
    name: useId(),
    bg: useId(),
  };

  const set = <K extends keyof SettingsValue>(k: K, v: SettingsValue[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <Card>
      <CardContent className="space-y-6 p-4 sm:p-6">
        {/* Resize */}
        <section className="space-y-3" aria-labelledby="resize-heading">
          <h3 id="resize-heading" className="text-sm font-semibold">Resize</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor={ids.width}>Width (px)</Label>
              <Input
                id={ids.width}
                type="number"
                inputMode="numeric"
                min={1}
                value={value.width ?? ''}
                onChange={(e) => set('width', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={ids.height}>Height (px)</Label>
              <Input
                id={ids.height}
                type="number"
                inputMode="numeric"
                min={1}
                value={value.height ?? ''}
                onChange={(e) => set('height', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="auto"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor={ids.maintain} className="text-sm">Maintain aspect ratio</Label>
            <Switch
              id={ids.maintain}
              checked={value.maintainAspectRatio}
              onCheckedChange={(v) => set('maintainAspectRatio', v)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.resizeMode}>Resize mode</Label>
            <Select value={value.resizeMode} onValueChange={(v) => set('resizeMode', v as ResizeMode)}>
              <SelectTrigger id={ids.resizeMode} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover</SelectItem>
                <SelectItem value="contain">Contain</SelectItem>
                <SelectItem value="fill">Fill</SelectItem>
                <SelectItem value="inside">Inside</SelectItem>
                <SelectItem value="outside">Outside</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <Separator />

        {/* Quality */}
        {info.lossy && (
          <>
            <section className="space-y-3" aria-labelledby="quality-heading">
              <div className="flex items-center justify-between">
                <h3 id="quality-heading" className="text-sm font-semibold">Quality</h3>
                <span className="text-xs tabular-nums text-muted-foreground">{value.quality}</span>
              </div>
              <Slider
                id={ids.quality}
                aria-label="Quality"
                min={1}
                max={100}
                step={1}
                value={[value.quality]}
                onValueChange={([v]) => set('quality', v)}
              />
            </section>
            <Separator />
          </>
        )}

        {/* Adjustments */}
        <section className="space-y-4" aria-labelledby="adj-heading">
          <h3 id="adj-heading" className="text-sm font-semibold">Adjustments</h3>
          <SliderRow id={ids.brightness} label="Brightness" min={-100} max={100} step={1} value={value.brightness} onChange={(v) => set('brightness', v)} />
          <SliderRow id={ids.contrast} label="Contrast" min={-100} max={100} step={1} value={value.contrast} onChange={(v) => set('contrast', v)} />
          <SliderRow id={ids.saturation} label="Saturation" min={-100} max={100} step={1} value={value.saturation} onChange={(v) => set('saturation', v)} />
          <SliderRow id={ids.hue} label="Hue" min={0} max={360} step={1} value={value.hue} onChange={(v) => set('hue', v)} />
          <SliderRow id={ids.gamma} label="Gamma" min={1} max={3} step={0.1} value={value.gamma} onChange={(v) => set('gamma', v)} fixed={1} />
          <div className="flex items-center justify-between">
            <Label htmlFor={ids.normalize} className="text-sm">Auto-normalize</Label>
            <Switch id={ids.normalize} checked={value.normalize} onCheckedChange={(v) => set('normalize', v)} />
          </div>
        </section>

        <Separator />

        {/* Transform */}
        <section className="space-y-3" aria-labelledby="transform-heading">
          <h3 id="transform-heading" className="text-sm font-semibold">Transform</h3>
          <div className="space-y-1.5">
            <span className="text-sm">Rotate</span>
            <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Rotation angle">
              {[0, 90, 180, 270].map((deg) => (
                <Button
                  key={deg}
                  type="button"
                  role="radio"
                  aria-checked={value.rotate === deg}
                  variant={value.rotate === deg ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => set('rotate', deg)}
                >
                  <ArrowClockwiseIcon className="size-3" style={{ transform: `rotate(${deg}deg)` }} />
                  {deg}°
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor={ids.flipH} className="flex items-center gap-2 text-sm">
              <ArrowsHorizontalIcon className="size-4" /> Flip horizontal
            </Label>
            <Switch id={ids.flipH} checked={value.flipHorizontal} onCheckedChange={(v) => set('flipHorizontal', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor={ids.flipV} className="flex items-center gap-2 text-sm">
              <ArrowsVerticalIcon className="size-4" /> Flip vertical
            </Label>
            <Switch id={ids.flipV} checked={value.flipVertical} onCheckedChange={(v) => set('flipVertical', v)} />
          </div>
        </section>

        <Separator />

        {/* Effects */}
        <section className="space-y-3" aria-labelledby="effects-heading">
          <h3 id="effects-heading" className="text-sm font-semibold">Effects</h3>
          <div className="flex items-center justify-between">
            <Label htmlFor={ids.grayscale} className="text-sm">Grayscale</Label>
            <Switch id={ids.grayscale} checked={value.grayscale} onCheckedChange={(v) => set('grayscale', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor={ids.sharpen} className="text-sm">Sharpen</Label>
            <Switch id={ids.sharpen} checked={value.sharpen} onCheckedChange={(v) => set('sharpen', v)} />
          </div>
          <SliderRow id={ids.blur} label="Blur" min={0} max={20} step={0.5} value={value.blur} onChange={(v) => set('blur', v)} fixed={1} />
        </section>

        <Separator />

        {/* Metadata */}
        <section className="space-y-3" aria-labelledby="meta-heading">
          <h3 id="meta-heading" className="text-sm font-semibold">Metadata</h3>
          <div className="flex items-center justify-between">
            <Label htmlFor={ids.strip} className="text-sm">Strip EXIF data</Label>
            <Switch id={ids.strip} checked={value.stripMetadata} onCheckedChange={(v) => set('stripMetadata', v)} />
          </div>
        </section>

        <Separator />

        {/* Output */}
        <section className="space-y-3" aria-labelledby="output-heading">
          <h3 id="output-heading" className="text-sm font-semibold">Output</h3>
          <div className="space-y-1.5">
            <Label htmlFor={ids.name}>Custom filename (optional)</Label>
            <Input
              id={ids.name}
              type="text"
              value={value.outputFileName}
              onChange={(e) => set('outputFileName', e.target.value)}
              placeholder="my-image"
            />
          </div>
          {outputFormat === 'jpeg' && (
            <div className="space-y-1.5">
              <Label htmlFor={ids.bg}>Background color (for transparency)</Label>
              <div className="flex items-center gap-2">
                <input
                  id={ids.bg}
                  type="color"
                  value={value.backgroundColor}
                  onChange={(e) => set('backgroundColor', e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
                  aria-label="Background color picker"
                />
                <Input
                  type="text"
                  value={value.backgroundColor}
                  onChange={(e) => set('backgroundColor', e.target.value)}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
          )}
        </section>

        <Button type="button" variant="outline" className="w-full" onClick={() => onChange(DEFAULT_SETTINGS)}>
          Reset all
        </Button>
      </CardContent>
    </Card>
  );
}

interface SliderRowProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  fixed?: number;
}

function SliderRow({ id, label, min, max, step, value, onChange, fixed = 0 }: SliderRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value.toFixed(fixed)}
        </span>
      </div>
      <Slider
        id={id}
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
