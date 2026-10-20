import { settleRecording, retainWellbeing } from '../timing/wellbeing';
import type { DashboardDocument } from '../state/model';
import { migrateDashboard } from '../state/validation';
import { assetReferences, loadMedia, saveMedia, validateMediaHeader, videoMetadata, MAX_VIDEO_BYTES } from '../assets/images';

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
export interface PortableImage { id: string; type: string; width: number; height: number; data: string; }
export interface Backup { format: 'purrductivity-backup'; version: 1; exportedAt: string; dashboard: DashboardDocument; images: PortableImage[]; }
const exact = (v: object, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
function fail(): never { throw Error('Invalid backup. Choose a DayNest JSON backup with all referenced photos, videos and background images.'); }
function bytesOf(image: PortableImage): Uint8Array {
    if (typeof image.data !== 'string' || image.data.length > Math.ceil((image.type.startsWith('video/') ? MAX_VIDEO_BYTES : 5 * 1024 * 1024) / 3) * 4 || image.data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(image.data) || !/^[^=]*={0,2}$/.test(image.data)) fail();
    const decoded = atob(image.data);
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    validateMediaHeader(bytes.slice(0, 16), image.type, bytes.length);
    return bytes;
}
export function parseBackup(raw: string): Backup {
    if (raw.length > MAX_BACKUP_BYTES || new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw Error('Choose a backup up to 50 MiB.');
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw Error('The backup is not valid JSON.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail();
    const input = parsed as Record<string, unknown>;
    // Known document-only backups can be migrated if no image binaries are needed.
    if (Object.hasOwn(input, 'schemaVersion')) {
        const dashboard = migrateDashboard(input);
        if (assetReferences(dashboard).size) fail();
        return { format: 'purrductivity-backup', version: 1, exportedAt: new Date(0).toISOString(), dashboard, images: [] };
    }
    if (!exact(input, ['format', 'version', 'exportedAt', 'dashboard', 'images']) || input.format !== 'purrductivity-backup' || input.version !== 1 || typeof input.exportedAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(input.exportedAt) || !Number.isFinite(Date.parse(input.exportedAt)) || !Array.isArray(input.images) || input.images.length > 101) fail();
    const dashboard = migrateDashboard(input.dashboard);
    const refs = assetReferences(dashboard), found = new Set<string>();
    for (const image of input.images) {
        if (!image || typeof image !== 'object' || Array.isArray(image) || !exact(image, ['id', 'type', 'width', 'height', 'data'])) fail();
        const item = image as PortableImage;
        if (typeof item.id !== 'string' || !refs.has(item.id) || found.has(item.id) || typeof item.type !== 'string' || !Number.isSafeInteger(item.width) || !Number.isSafeInteger(item.height) || item.width < 1 || item.height < 1 || item.width > 12000 || item.height > 12000 || item.width * item.height > 40000000) fail();
        bytesOf(item); found.add(item.id);
    }
    if (found.size !== refs.size) fail();
    const byId = new Map((input.images as PortableImage[]).map(asset => [asset.id, asset]));
    if (dashboard.background.assetId && !byId.get(dashboard.background.assetId)?.type.startsWith('image/')) fail();
    for (const w of dashboard.widgets) if ((w.type === 'image' || w.type === 'video') && w.content.assetId && !byId.get(w.content.assetId)?.type.startsWith(w.type === 'video' ? 'video/' : 'image/')) fail();
    return { format: 'purrductivity-backup', version: 1, exportedAt: input.exportedAt, dashboard, images: input.images as PortableImage[] };
}
function base64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
}
export async function exportBackup(source: DashboardDocument): Promise<Backup> {
    const dashboard = structuredClone(source);
    settleRecording(dashboard,Date.now());retainWellbeing(dashboard,Date.now());
    const images: PortableImage[] = [];
    let encodedBytes = 0;
    for (const id of assetReferences(dashboard)) {
        const asset = await loadMedia(id);
        encodedBytes += Math.ceil(asset.blob.size / 3) * 4;
        if (encodedBytes > MAX_BACKUP_BYTES - 2200000) throw Error('Your media exceeds the 50 MiB backup limit. Remove some photos or videos before exporting.');
        images.push({ id, type: asset.blob.type, width: asset.width, height: asset.height, data: base64(new Uint8Array(await asset.blob.arrayBuffer())) });
    }
    return parseBackup(JSON.stringify({ format: 'purrductivity-backup', version: 1, exportedAt: new Date().toISOString(), dashboard, images }));
}
export async function inspectBackup(raw: string): Promise<Backup> {
    const backup = parseBackup(raw);
    // Verify decoding and dimensions before showing the replacement confirmation. No writes here.
    for (const image of backup.images) {
        if (image.type.startsWith('video/')) {
            const metadata = await videoMetadata(new Blob([bytesOf(image) as Uint8Array<ArrayBuffer>], { type: image.type }));
            if (metadata.width !== image.width || metadata.height !== image.height) throw Error('Backup video dimensions do not match. Your dashboard was kept.');
            continue;
        }
        let decoded: ImageBitmap;
        try { decoded = await createImageBitmap(new Blob([bytesOf(image) as Uint8Array<ArrayBuffer>], { type: image.type })); }
        catch { throw Error('A backup image cannot be decoded. Your dashboard was kept.'); }
        const valid = decoded.width === image.width && decoded.height === image.height;
        decoded.close();
        if (!valid) throw Error('Backup image dimensions do not match. Your dashboard was kept.');
    }
    return backup;
}
export async function stageBackup(backup: Backup): Promise<DashboardDocument> {
    const document = structuredClone(backup.dashboard);
    const ids = new Map<string, string>();
    // Fresh IDs prevent an import from overwriting any image in the current/recovery dashboard.
    for (const image of backup.images) {
        const asset = await saveMedia(new File([bytesOf(image) as Uint8Array<ArrayBuffer>], 'backup-media', { type: image.type }));
        ids.set(image.id, asset.id);
    }
    for (const widget of document.widgets) if ((widget.type === 'image' || widget.type === 'video') && widget.content.assetId) widget.content.assetId = ids.get(widget.content.assetId)!;
    if (document.background.assetId) document.background.assetId = ids.get(document.background.assetId)!;
    return document;
}
export function downloadBackup(backup: Backup) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `daynest-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
