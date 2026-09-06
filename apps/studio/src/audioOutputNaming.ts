// A filename may have no extension. A dot in a title is meaningful text.
const MEDIA_EXTENSION = /\.(?:wav|wave|mp3|mp4|m4a|m4b|m4v|mov|webm|weba|ogg|oga|ogv|opus|flac|aac|aif|aiff|aifc|wma|wmv|avi|mkv|mka|amr|3gp|3g2|mpg|mpeg|mpga|mp2|ts|mts|m2ts)$/i;

export function audioSourceTitle(filename: string): string {
  return filename.trim().replace(MEDIA_EXTENSION, "").trim();
}
