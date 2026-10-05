import type { RealtimeTranscriptEvent } from "./realtimeProtocol";
import type { RealtimeSegmentMetadata } from "./realtimeTranscript";

type Commit = Extract<RealtimeTranscriptEvent, { kind: "committed" }>;

/** Correlate delayed timestamp messages and indexed refinements within one transport. */
export class RealtimeSegmentStream {
  private sequence = 0;
  private untimed: { id: string; text: string }[] = [];
  private timed = new Map<string, string>();
  private indexed = new Map<string, string>();

  constructor(private namespace: string, private offsetSeconds: number) {}

  committed(event: Commit): { text: string; metadata: RealtimeSegmentMetadata; replaces: boolean } | null {
    const raw = event.metadata;
    let id: string;
    let replaces = false;
    if (raw && raw.id !== "timed") {
      id = `${this.namespace}.${raw.id}`;
      const signature = JSON.stringify([event.text, raw]);
      if (this.indexed.get(id) === signature) return null;
      replaces = this.indexed.has(id);
      this.indexed.set(id, signature);
      if (this.indexed.size > 5000) this.indexed.delete(this.indexed.keys().next().value!);
    } else if (event.timestampUpdate && raw) {
      const signature = JSON.stringify([event.text, raw.start_seconds, raw.end_seconds]);
      if (this.timed.has(signature)) return null;
      const index = this.untimed.findIndex((item) => item.text === event.text);
      replaces = index >= 0;
      id = index >= 0 ? this.untimed.splice(index, 1)[0].id : `${this.namespace}.${this.sequence++}`;
      this.timed.set(signature, id);
      if (this.timed.size > 5000) this.timed.delete(this.timed.keys().next().value!);
    } else {
      id = `${this.namespace}.${this.sequence++}`;
      this.untimed.push({ id, text: event.text });
      // Same bounded transcript limit as local/server drafts; no unbounded event log.
      if (this.untimed.length > 5000) this.untimed.shift();
    }
    const metadata: RealtimeSegmentMetadata = { ...raw, id };
    if (raw?.start_seconds !== undefined && raw.end_seconds !== undefined) {
      metadata.start_seconds = this.offsetSeconds + raw.start_seconds;
      metadata.end_seconds = this.offsetSeconds + raw.end_seconds;
    }
    return { text: event.text, metadata, replaces };
  }
}
