import { createStorageAdapter } from '../persistence/adapter';
import { decodeDashboard } from '../state/validation';
const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export function validateMediaHeader(bytes: Uint8Array, type: string, size: number): void {
    if (!type.startsWith('video/')) return validateImageHeader(bytes, type, size);
    if (!size || size > MAX_VIDEO_BYTES) throw Error('Choose a video up to 25 MiB.');
    const webm = bytes.length >= 4 && [0x1a, 0x45, 0xdf, 0xa3].every((v, i) => bytes[i] === v);
    const mp4 = bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
    if (!((type === 'video/webm' && webm) || (type === 'video/mp4' && mp4))) throw Error('Choose a real MP4 or WebM video.');
}
export async function videoMetadata(blob: Blob): Promise<{ width: number; height: number; duration: number }> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(blob);
        const timer = setTimeout(() => finish(Error('Video metadata could not be read. Try another MP4 or WebM file.')), 10000);
        let settled = false;
        function finish(error?: Error) {
            if (settled) return;
            settled = true;
            const value = { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
            clearTimeout(timer); video.onloadedmetadata = video.onerror = video.onseeked = null;
            video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
            if (error) reject(error);
            else if (!Number.isFinite(value.duration) || value.duration <= 0 || value.duration > 300 || value.width < 1 || value.height < 1 || value.width > 4096 || value.height > 4096 || value.width * value.height > 9000000)
                reject(Error('Choose a playable video up to five minutes and 4096 pixels per side.'));
            else resolve(value);
        }
        video.preload = 'metadata'; video.muted = true; video.playsInline = true;
        video.onerror = () => finish(Error('This video format or codec is not supported. The existing media was kept.'));
        video.onloadedmetadata = () => {
            if (video.duration === Infinity) { video.onseeked = () => finish(); video.currentTime = 1e10; }
            else finish();
        };
        video.src = url;
    });
}
export interface ImageAsset {
    id: string;
    blob: Blob;
    createdAt: number;
    width: number;
    height: number;
    type: string;
}
export function validateImageHeader(bytes: Uint8Array, type: string, size: number): void {
    if (size === 0 || size > MAX_BYTES)
        throw Error('Choose an image up to 5 MiB.');
    const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
    const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    if (!((type === 'image/png' && png) || (type === 'image/jpeg' && jpeg) || (type === 'image/webp' && webp)))
        throw Error('Choose a real PNG, JPEG or WebP image. SVG and executable formats are not accepted.');
}
let opening: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> { if (!opening)
    opening = new Promise((resolve, reject) => { const request = indexedDB.open('purrductivity-assets', 1); request.onupgradeneeded = () => { request.result.createObjectStore('images', { keyPath: 'id' }); }; request.onerror = () => { opening = null; reject(request.error ?? Error('Image storage unavailable.')); }; request.onblocked = () => { opening = null; reject(Error('Close older dashboard tabs to update image storage.')); }; request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); opening = null; }; resolve(db); }; }); return opening; }
function request<T>(r: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error ?? Error('Image storage request failed.')); }); }
function completed(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? Error('Image storage transaction failed.')); tx.onerror = () => reject(tx.error ?? Error('Image storage transaction failed.')); }); }
export async function saveImage(file: File): Promise<ImageAsset> {
    validateImageHeader(new Uint8Array(await file.slice(0, 16).arrayBuffer()), file.type, file.size);
    let decoded: ImageBitmap;
    try {
        decoded = await createImageBitmap(file);
    }
    catch {
        throw Error('This image could not be decoded. The existing image was kept.');
    }
    const width = decoded.width, height = decoded.height;
    decoded.close();
    if (width < 1 || height < 1 || width > 12000 || height > 12000 || width * height > 40000000)
        throw Error('Image dimensions must be at most 12000 per side and 40 million pixels total.');
    const asset: ImageAsset = { id: crypto.randomUUID(), blob: file, createdAt: Date.now(), width, height, type: file.type };
    const db = await database();
    const tx = db.transaction('images', 'readwrite');
    const done = completed(tx);
    tx.objectStore('images').put(asset);
    await done;
    return asset;
}
export async function loadMedia(id: string): Promise<ImageAsset> { const db = await database(); const tx = db.transaction('images', 'readonly'); const result = await request(tx.objectStore('images').get(id)) as ImageAsset | undefined; if (!result || !(result.blob instanceof Blob) || result.id !== id)
    throw Error('The saved media is missing. Upload it again or remove it.'); validateMediaHeader(new Uint8Array(await result.blob.slice(0, 16).arrayBuffer()), result.blob.type, result.blob.size); if (!Number.isSafeInteger(result.width) || !Number.isSafeInteger(result.height) || result.width < 1 || result.height < 1 || result.width > 12000 || result.height > 12000 || result.width * result.height > 40000000 || (result.blob.type.startsWith('video/') && (result.width > 4096 || result.height > 4096 || result.width * result.height > 9000000)))
    throw Error('The saved image metadata is invalid. Replace or remove it.'); return result; }
export async function loadImage(id: string): Promise<ImageAsset> {
    const asset = await loadMedia(id);
    validateImageHeader(new Uint8Array(await asset.blob.slice(0, 16).arrayBuffer()), asset.blob.type, asset.blob.size);
    return asset;
}
export async function saveMedia(file: File): Promise<ImageAsset> {
    if (!file.type.startsWith('video/')) return saveImage(file);
    validateMediaHeader(new Uint8Array(await file.slice(0, 16).arrayBuffer()), file.type, file.size);
    const { width, height } = await videoMetadata(file);
    const asset: ImageAsset = { id: crypto.randomUUID(), blob: file, createdAt: Date.now(), width, height, type: file.type };
    const db = await database(), tx = db.transaction('images', 'readwrite'), done = completed(tx);
    tx.objectStore('images').put(asset); await done; return asset;
}
export function assetReferences(doc: {
    widgets: {
        type: string;
        content: unknown;
    }[];
    background?: { assetId: string | null };
}): Set<string> { const refs = new Set(doc.widgets.filter(w => w.type === 'image' || w.type === 'video').map(w => (w.content as {
    assetId: string | null;
}).assetId).filter((id): id is string => typeof id === 'string')); if (doc.background?.assetId) refs.add(doc.background.assetId); return refs; }
export function shouldRemoveAsset(id: string, createdAt: number, refs: Set<string>, now: number): boolean { return !refs.has(id) && Number.isFinite(createdAt) && createdAt >= 0 && now - createdAt >= 86400000; }
export async function cleanupImages(): Promise<{
    removed: number;
    protectedByRecovery: boolean;
}> {
    const adapter = createStorageAdapter();
    return adapter.exclusive(async () => {
        // Any live tab with undo history pins images until that tab closes or replaces its dashboard.
        if ((await navigator.locks.query()).held?.some(lock => lock.name === 'purrductivity-history-assets'))
            return { removed: 0, protectedByRecovery: true };
        const raw = await adapter.read();
        if (typeof raw !== 'string')
            return { removed: 0, protectedByRecovery: true };
        const refs = assetReferences(decodeDashboard(raw));
        let backup: unknown;
        try {
            backup = await adapter.readBackup();
        }
        catch {
            return { removed: 0, protectedByRecovery: true };
        }
        if (backup !== undefined && backup !== null) {
            const source = (backup as {
                raw?: unknown;
            }).raw;
            try {
                if (typeof source !== 'string')
                    return { removed: 0, protectedByRecovery: true };
                for (const id of assetReferences(decodeDashboard(source)))
                    refs.add(id);
            }
            catch {
                return { removed: 0, protectedByRecovery: true };
            }
        }
        const db = await database();
        const tx = db.transaction('images', 'readwrite');
        const done = completed(tx);
        let removed = 0;
        const cursor = tx.objectStore('images').openCursor();
        cursor.onsuccess = () => { const value = cursor.result; if (!value)
            return; const asset = value.value as ImageAsset; if (shouldRemoveAsset(String(value.key), asset.createdAt, refs, Date.now())) {
            value.delete();
            removed++;
        } value.continue(); };
        await done;
        return { removed, protectedByRecovery: false };
    });
}
