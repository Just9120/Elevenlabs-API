// A filename may have no extension. A dot in a title is meaningful text.
const MEDIA_EXTENSION = /\.(?:wav|wave|mp3|mp4|m4a|m4b|m4v|mov|webm|weba|ogg|oga|ogv|opus|flac|aac|aif|aiff|aifc|wma|wmv|avi|mkv|mka|amr|3gp|3g2|mpg|mpeg|mpga|mp2|ts|mts|m2ts)$/i;

export function audioSourceTitle(filename: string): string {
  return filename.trim().replace(MEDIA_EXTENSION, "").trim();
}

export const audioNamingTemplates = {
  title: "{title}",
  date: "{date}_{title}",
  dateTime: "{date}_{time}_{title}",
} as const;
export type AudioNamingStyle = keyof typeof audioNamingTemplates;

// Creation authority comes from source metadata, never File.lastModified or
// the current clock. Server filenames use UTC as well.
export function audioNamedTitle(title: string, style: AudioNamingStyle, createdAt?: string | null) {
  const moment = createdAt ? new Date(createdAt) : null;
  if (style === "title" || !moment || !Number.isFinite(moment.getTime())) return title;
  const iso = moment.toISOString();
  const prefix = style === "dateTime" ? `${iso.slice(0, 10)}_${iso.slice(11, 19).replaceAll(":", "-")}Z` : iso.slice(0, 10);
  return `${prefix}_${title}`;
}
