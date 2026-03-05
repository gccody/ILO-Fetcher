export type ILOVerion =
  | "ILO1"
  | "ILO2"
  | "ILO3"
  | "ILO4"
  | "ILO5"
  | "ILO6"
  | "ILO7";

export type UpgradeRequirement = "Recommended" | "Optional" | "Critical";

export type ReleaseType = "Production" | "Beta" | "Alpha";

export interface Data {
  whitelistedFileExtensions: string[];
  ilos: ILO[];
}

export interface ILO {
  version: ILOVerion;
  url: string;
  files: ILOFile[];
}

export interface ILOFile {
  fileInfo: FileInfo;
  releaseInfo: ReleaseInfo;
  downloadUrl: string;
}

export interface ReleaseInfo {
  version: FileVersion;
  upgradeRequirement: UpgradeRequirement;
  releaseDate: string;
  rebootRequirement: boolean;
}

export interface FileVersion {
  versionId: string;
  versionCode: string;
  releaseType: ReleaseType;
}

export interface FileInfo {
  filename: string;
  filetype: string;
  checksum: string;
  filesize: string;
}
