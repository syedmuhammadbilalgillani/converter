import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SettingsPanel,
  DEFAULT_SETTINGS,
  settingsToDto,
  type SettingsValue,
} from '../SettingsPanel';

describe('SettingsPanel', () => {
  it('renders core sections', () => {
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={() => {}} outputFormat="jpeg" />);
    expect(screen.getByText('Resize')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('Adjustments')).toBeInTheDocument();
    expect(screen.getByText('Transform')).toBeInTheDocument();
    expect(screen.getByText('Effects')).toBeInTheDocument();
  });

  it('hides Quality section for lossless formats', () => {
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={() => {}} outputFormat="png" />);
    expect(screen.queryByText('Quality')).not.toBeInTheDocument();
  });

  it('emits onChange when width is typed', () => {
    const onChange = vi.fn();
    render(<SettingsPanel value={DEFAULT_SETTINGS} onChange={onChange} outputFormat="jpeg" />);
    fireEvent.change(screen.getByLabelText(/width \(px\)/i), { target: { value: '512' } });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[onChange.mock.calls.length - 1][0] as SettingsValue;
    expect(next.width).toBe(512);
  });

  it('reset button restores defaults', () => {
    const onChange = vi.fn();
    const dirty: SettingsValue = { ...DEFAULT_SETTINGS, width: 999, brightness: 50, grayscale: true };
    render(<SettingsPanel value={dirty} onChange={onChange} outputFormat="jpeg" />);
    fireEvent.click(screen.getByRole('button', { name: /reset all/i }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });
});

describe('settingsToDto', () => {
  it('omits zero adjustments and includes set values', () => {
    const dto = settingsToDto('fid', 'webp', { ...DEFAULT_SETTINGS, width: 300, brightness: 0, hue: 45 });
    expect(dto.fileId).toBe('fid');
    expect(dto.outputFormat).toBe('webp');
    expect(dto.width).toBe(300);
    expect(dto.brightness).toBeUndefined();
    expect(dto.hue).toBe(45);
  });

  it('includes backgroundColor only for JPEG', () => {
    const jpeg = settingsToDto('fid', 'jpeg', { ...DEFAULT_SETTINGS, backgroundColor: '#ff0000' });
    expect(jpeg.backgroundColor).toBe('#ff0000');
    const png = settingsToDto('fid', 'png', { ...DEFAULT_SETTINGS, backgroundColor: '#ff0000' });
    expect(png.backgroundColor).toBeUndefined();
  });
});
