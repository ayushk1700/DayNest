import { reconcileDue, pendingEvents, setDelivery } from '../timing/time';
import type { PendingEvent } from '../timing/time';
import type { Delivery } from '../state/model';
import { validateDashboard } from '../state/validation';
import { seedDashboard } from '../state/model';
import { decodeDashboard } from '../state/validation';
import { applyAction } from '../state/actions';
import type { Action } from '../state/actions';
import type { DashboardDocument } from '../state/model';
import type { StorageAdapter } from './adapter';
import { applyPatches } from '../state/history';
import type { Patch, Change } from '../state/history';
import { ConflictError } from '../state/actions';
export class MissingDocumentError extends Error {
}
function decode(raw: unknown): DashboardDocument {
    if (typeof raw !== 'string')
        throw new Error('Saved dashboard has an unexpected format.');
    return decodeDashboard(raw);
}
export class Repository {
    constructor(private adapter: StorageAdapter) { }
    subscribe(listener: () => void) { return this.adapter.subscribe(listener); }
    load(): Promise<DashboardDocument> {
        return this.adapter.exclusive(async () => {
            const raw = await this.adapter.read();
            if (raw === undefined) {
                const seed = seedDashboard();
                await this.adapter.write(JSON.stringify(seed));
                return seed;
            }
            const document = decode(raw);
            // Persist a validated migration under the same lock; never seed over invalid data.
            if (JSON.parse(raw as string).schemaVersion !== document.schemaVersion)
                await this.adapter.write(JSON.stringify(document));
            return document;
        });
    }
    read(): Promise<DashboardDocument> {
        return this.adapter.exclusive(async () => {
            const raw = await this.adapter.read();
            if (raw === undefined)
                throw new MissingDocumentError('Saved data was removed in another tab. Retry to create a fresh sample dashboard.');
            return decode(raw);
        });
    }
    commit(action: Action): Promise<DashboardDocument> {
        return this.change(action).then(result => result.after);
    }
    change(action: Action): Promise<Change> {
        return this.adapter.exclusive(async () => {
            const raw = await this.adapter.read();
            if (raw === undefined)
                throw new MissingDocumentError('Saved dashboard was removed. Your edit was not saved.');
            const before = decode(raw);
            const next = applyAction(before, action);
            await this.adapter.write(JSON.stringify(next));
            return { before, after: next };
        });
    }
    history(patches: Patch[]): Promise<Change> {
        return this.adapter.exclusive(async () => {
            const before = decode(await this.adapter.read());
            const after = applyPatches(before, patches);
            await this.adapter.write(JSON.stringify(after));
            return { before, after };
        });
    }
    replace(expected: DashboardDocument, replacement: DashboardDocument): Promise<DashboardDocument> {
        return this.adapter.exclusive(async () => {
            const raw = await this.adapter.read();
            const current = decode(raw);
            if (JSON.stringify(current) !== JSON.stringify(expected)) throw new ConflictError();
            const next = validateDashboard({ ...replacement, revision: current.revision + 1 });
            // If backup or write fails, the existing dashboard stays intact.
            await this.adapter.backup(raw);
            await this.adapter.write(JSON.stringify(next));
            return next;
        });
    }
    previous(): Promise<DashboardDocument | null> {
        return this.adapter.exclusive(async () => {
            const backup = await this.adapter.readBackup();
            if (backup === undefined || backup === null) return null;
            return decode((backup as { raw?: unknown }).raw);
        });
    }
    reconcile(now: number, preview = false): Promise<DashboardDocument> {
        return this.adapter.exclusive(async () => {
            const raw = await this.adapter.read();
            if (raw === undefined)
                throw new MissingDocumentError('Dashboard is missing.');
            const doc = decode(raw);
            let changed = reconcileDue(doc, now);
            if (preview)
                for (const event of pendingEvents(doc, now))
                    changed = setDelivery(doc, event.id, 'pending', 'unavailable') || changed;
            if (changed) {
                doc.revision += 1;
                validateDashboard(doc);
                await this.adapter.write(JSON.stringify(doc));
            }
            return doc;
        });
    }
    claimEvent(id: string, now: number): Promise<PendingEvent | null> {
        return this.adapter.exclusive(async () => {
            const raw = await this.adapter.read();
            if (raw === undefined)
                return null;
            const doc = decode(raw);
            const event = pendingEvents(doc, now).find(event => event.id === id);
            if (!event || !setDelivery(doc, id, 'pending', 'claimed'))
                return null;
            doc.revision += 1;
            validateDashboard(doc);
            await this.adapter.write(JSON.stringify(doc));
            return event;
        });
    }
    finishDelivery(id: string, delivery: Delivery): Promise<void> {
        return this.adapter.exclusive(async () => {
            const raw = await this.adapter.read();
            if (raw === undefined)
                return;
            const doc = decode(raw);
            if (setDelivery(doc, id, 'claimed', delivery)) {
                doc.revision += 1;
                validateDashboard(doc);
                await this.adapter.write(JSON.stringify(doc));
            }
        });
    }
    async recoverySource(): Promise<unknown> { return this.adapter.exclusive(() => this.adapter.read()); }
    recover(expectedRaw: unknown): Promise<DashboardDocument> {
        return this.adapter.exclusive(async () => {
            const current = await this.adapter.read();
            if (JSON.stringify(current) !== JSON.stringify(expectedRaw))
                throw new Error('Saved data changed while recovery was open. Retry to inspect the latest version.');
            await this.adapter.backup(current);
            const seed = seedDashboard();
            await this.adapter.write(JSON.stringify(seed));
            return seed;
        });
    }
}
