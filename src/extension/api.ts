export interface ExtensionAPI {
    storage: {
        local: {
            get(key: string): Promise<Record<string, unknown>>;
            set(value: Record<string, unknown>): Promise<void>;
        };
        onChanged: {
            addListener(fn: (changes: Record<string, unknown>, area: string) => void): void;
            removeListener(fn: (changes: Record<string, unknown>, area: string) => void): void;
        };
    };
    alarms: {
        create(name: string, info: {
            when: number;
        }): Promise<void>;
        clear(name: string): Promise<boolean>;
        onAlarm: {
            addListener(fn: (alarm: {
                name: string;
            }) => void): void;
        };
    };
    runtime: {
        id: string;
        getURL(path: string): string;
        onStartup: {
            addListener(fn: () => void): void;
        };
        onInstalled: {
            addListener(fn: () => void): void;
        };
    };
    permissions: {
        contains(value: {
            permissions: string[];
        }): Promise<boolean>;
        request(value: {
            permissions: string[];
        }): Promise<boolean>;
        remove(value: {
            permissions: string[];
        }): Promise<boolean>;
    };
    notifications?: {
        getPermissionLevel(): Promise<'granted' | 'denied'>;
        create(id: string, options: {
            type: 'basic';
            iconUrl: string;
            title: string;
            message: string;
        }): Promise<string>;
    };
}
export function extensionAPI(): ExtensionAPI | null { return (globalThis as typeof globalThis & {
    chrome?: ExtensionAPI;
}).chrome?.runtime?.id ? (globalThis as typeof globalThis & {
    chrome: ExtensionAPI;
}).chrome : null; }
