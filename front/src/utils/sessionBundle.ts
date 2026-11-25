import type { FightSummary } from '@/protocols';
import { buildPortableReportPayload, getSessionExportMetadata, renderPortableReportHTML, SESSION_EXPORTER_VERSION, type SessionExportMetadata } from './portableReport';
import { makeReportZip } from './batchZip';

export type BundleReport = { name: string; payload: string; metadata: SessionExportMetadata };
export type BundleEntry = {
  id: string; path: string; type: 'combat-session'; payloadFormat: 'html-report';
  dataSchemaVersion: 1; dataSchemas: { companion: 1; skillObservation: 1; damageHit: 1; skillUse: 1; encounter: 1 };
  startAt: string | null; endAt: string | null; scope: SessionExportMetadata['scope'];
  healingIncomplete: boolean; payloadSha256?: string; fileSha256?: string;
};
export type BundleManifest = {
  format: 'midir-session-bundle'; schemaVersion: 1; exporterVersion: string; createdAt: string;
  sessionCount: number; sessions: BundleEntry[];
};

export function prepareBundleReport(summary: FightSummary, title: string, storageId: string, scope: string, names: Record<number,string>): BundleReport {
  const metadata = getSessionExportMetadata(summary, scope);
  if (!metadata) throw new Error('Saved recording has no reliable export identity');
  // Keep standard report filenames compatible with earlier archives.
  const safe = Array.from(title.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')).slice(0,75).join('') || 'session';
  const storage = storageId.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100);
  // Keep unusually long Unicode paths within common filesystem byte limits.
  const titleParts = Array.from(safe);
  const encoder = new TextEncoder();
  while (encoder.encode(titleParts.join('') + '-' + storage + '.html').length > 230) titleParts.pop();
  const name = `${titleParts.join('') || 'session'}-${storage}.html`;
  return {name, metadata, payload: buildPortableReportPayload(summary,title,scope,names)};
}

// Web Crypto is available on the local loopback UI (and HTTPS). SHA-256 is
// optional on non-secure LAN HTTP contexts; ZIP CRC32 is always included.
async function sha256(text: string): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2,'0')).join('');
}

export async function makeSessionBundle(reports: BundleReport[], createdAt = new Date().toISOString()): Promise<{ blob: Blob; manifest: BundleManifest }> {
  if (!reports.length) throw new Error('No reports generated');
  if (reports.length >= 65534) throw new Error('Too many reports for classic ZIP');
  const files: { name: string; html: string }[] = [];
  const entries: BundleEntry[] = [];
  const used = new Set<string>(['manifest.json']);
  for (const report of reports) {
    const { metadata, payload } = report;
    let name = report.name;
    // Case-insensitive uniqueness for common extraction filesystems; retain
    // the historic root-level names unless a sanitized name collides.
    const original = name;
    for (let n=2; used.has(name.normalize('NFC').toLowerCase()); n++) name = original.replace(/(\.[^.]+)$/, `-${n}$1`);
    used.add(name.normalize('NFC').toLowerCase());
    const content = renderPortableReportHTML(payload,metadata.healingIncomplete);
    const payloadSha256 = await sha256(payload);
    const fileSha256 = await sha256(content);
    files.push({name,html:content});
    entries.push({id:metadata.id,path:name,type:'combat-session',payloadFormat:'html-report',
      dataSchemaVersion:1,dataSchemas:{companion:1,skillObservation:1,damageHit:1,skillUse:1,encounter:1},
      startAt:metadata.startAt,endAt:metadata.endAt,scope:metadata.scope,healingIncomplete:metadata.healingIncomplete,
      payloadSha256,fileSha256});
  }
  const manifest: BundleManifest = {format:'midir-session-bundle',schemaVersion:1,exporterVersion:SESSION_EXPORTER_VERSION,createdAt,sessionCount:entries.length,sessions:entries};
  // Manifest first for easy offline discovery; publish only after the complete
  // archive has been generated successfully. No partially written ZIPs.
  return {blob:await makeReportZip([{name:'manifest.json',html:JSON.stringify(manifest,null,2)+'\n'},...files]),manifest};
}
