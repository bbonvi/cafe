import { fileTypes } from "../common";
import { config } from "../state";

export function getFilePrefix(): string {
  return config.imageRootOverride || "/uploads";
}

// Get the thumbnail path of an image.
export function thumbPath(thumbType: fileTypes, sha1: string): string {
  return `${getFilePrefix()}/thumb/${sha1.slice(0, 2)}/${sha1.slice(2)}.${fileTypes[thumbType]}`;
}

// Resolve the path to the source file of an upload.
export function sourcePath(fileType: fileTypes, sha1: string): string {
  return `${getFilePrefix()}/src/${sha1.slice(0, 2)}/${sha1.slice(2)}.${fileTypes[fileType]}`;
}

export function blurPath(thumbType: fileTypes, sha1: string): string {
  return `${getFilePrefix()}/blur/${sha1.slice(0, 2)}/${sha1.slice(2)}.${fileTypes[thumbType]}`;
}

export function smilePath(fileType: fileTypes, sha1: string): string {
  return `${getFilePrefix()}/smiles/${sha1.slice(0, 2)}/${sha1.slice(2)}.${fileTypes[fileType]}`;
}
