/**
 * 资产解析入口：image / psd / url / figma 统一分发
 */

import type { AssetInput, ParsedAsset } from "../types.js";
import { parseImage, toPng } from "./image.js";
import { parsePsd } from "./psd.js";
import { parseUrl } from "./url.js";
import { parseFigma } from "./figma.js";
import { getConfig } from "../config.js";

export async function parseAsset(input: AssetInput): Promise<ParsedAsset> {
  let asset: ParsedAsset;
  switch (input.type) {
    case "file": {
      const name = input.filename.toLowerCase();
      if (name.endsWith(".psd")) {
        asset = await parsePsd(input);
      } else {
        asset = await parseImage(input);
      }
      break;
    }
    case "url":
      asset = await parseUrl(input, getConfig().viewport);
      break;
    case "figma":
      asset = await parseFigma(input);
      break;
    default:
      throw new Error(`不支持的输入类型`);
  }
  // 统一转 PNG，供像素 diff 与模型输入
  if (asset.mime !== "image/png") {
    asset.image = await toPng(asset.image);
    asset.mime = "image/png";
  }
  return asset;
}
