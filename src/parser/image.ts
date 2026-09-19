/**
 * 位图解析：PNG / JPEG / WebP → ParsedAsset
 * 本地提取尺寸，降低传给模型的 Token 消耗。
 */

import sharp from "sharp";
import type { ParsedAsset, AssetInput } from "../types.js";
import { SUPPORTED_IMAGE_TYPES } from "../constants.js";

export async function parseImage(input: Extract<AssetInput, { type: "file" }>): Promise<ParsedAsset> {
  const image = sharp(input.buffer);
  const meta = await image.metadata();
  if (!meta.width || !meta.height) throw new Error("无法读取图片尺寸");
  if (meta.format === "svg") throw new Error("暂不支持 SVG 输入");
  const mime = meta.format ? `image/${meta.format}` : input.filename.split(".").pop() ?? "image/png";
  if (!SUPPORTED_IMAGE_TYPES.includes(mime as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
    throw new Error(`不支持的图片格式：${mime}`);
  }
  return {
    kind: "bitmap",
    source: input.filename,
    image: input.buffer,
    mime,
    width: meta.width,
    height: meta.height,
  };
}

/** 将位图统一转码为 PNG（供像素 diff 与模型输入） */
export async function toPng(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).png().toBuffer();
}

/** 等比缩放（用于 diff 前统一尺寸） */
export async function resizeTo(buffer: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(buffer).resize(width, height, { fit: "fill" }).png().toBuffer();
}
