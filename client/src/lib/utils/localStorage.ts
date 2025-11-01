export function getLocalStorageItem<T>(key: string): T | null {
    try {
        const item = localStorage.getItem(key);
        return item ? (JSON.parse(item) as T) : null;
    } catch (error) {
        console.error(`Failed to get item from localStorage: ${key}`, error);
        return null;
    }
}

export function setLocalStorageItem<T>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Failed to set item in localStorage: ${key}`, error);
    }
}