declare module "youtube-captions-scraper" {
  interface CaptionEntry {
    start: string | number;
    dur: string | number;
    text: string;
  }

  interface GetSubtitlesOptions {
    videoID: string;
    lang?: string;
    type?: "auto" | "manual";
  }

  export function getSubtitles(options: GetSubtitlesOptions): Promise<CaptionEntry[]>;
}
