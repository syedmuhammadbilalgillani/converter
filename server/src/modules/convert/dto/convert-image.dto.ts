import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum OutputFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif',
  GIF = 'gif',
  TIFF = 'tiff',
  BMP = 'bmp',
  PDF = 'pdf',
  ICO = 'ico',
}

export enum ResizeMode {
  COVER = 'cover',
  CONTAIN = 'contain',
  FILL = 'fill',
  INSIDE = 'inside',
  OUTSIDE = 'outside',
}

export class ConvertImageDto {
  @IsString()
  fileId!: string;

  @IsEnum(OutputFormat)
  outputFormat!: OutputFormat;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quality?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  height?: number;

  @IsOptional()
  @IsBoolean()
  maintainAspectRatio?: boolean;

  @IsOptional()
  @IsEnum(ResizeMode)
  resizeMode?: ResizeMode;

  // number rotation; "auto" is communicated by stripMetadata=false + rotateAuto flag below
  @IsOptional()
  @IsInt()
  rotate?: number;

  @IsOptional()
  @IsBoolean()
  rotateAuto?: boolean;

  @IsOptional()
  @IsBoolean()
  flipHorizontal?: boolean;

  @IsOptional()
  @IsBoolean()
  flipVertical?: boolean;

  @IsOptional()
  @IsBoolean()
  grayscale?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.3)
  @Max(1000)
  blur?: number;

  @IsOptional()
  @IsBoolean()
  sharpen?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-100)
  @Max(100)
  brightness?: number;

  @IsOptional()
  @IsNumber()
  @Min(-100)
  @Max(100)
  saturation?: number;

  @IsOptional()
  @IsNumber()
  @Min(-100)
  @Max(100)
  contrast?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  hue?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3)
  gamma?: number;

  @IsOptional()
  @IsBoolean()
  normalize?: boolean;

  @IsOptional()
  @IsBoolean()
  removeBackground?: boolean;

  @IsOptional()
  @IsBoolean()
  stripMetadata?: boolean;

  @IsOptional()
  @IsHexColor()
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  outputFileName?: string;
}
