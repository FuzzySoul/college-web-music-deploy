import time
import threading
import json


class MemoryCache:
    def __init__(self):
        self._store = {}
        self._hits = 0
        self._misses = 0
        self._stale_hits = 0
        self._refreshing = set()
        self._lock = threading.Lock()
        self._offline_mode = False

    def get(self, key: str):
        if self._offline_mode:
            return self.get_stale(key)

        entry = self._store.get(key)
        if entry is None:
            self._misses += 1
            return None

        now = time.time()
        if now <= entry["expires_at"]:
            self._hits += 1
            return entry["data"]

        stale_until = entry.get("stale_until", entry["expires_at"])
        if now <= stale_until:
            self._stale_hits += 1
            return entry["data"]

        del self._store[key]
        self._misses += 1
        return None

    def get_stale(self, key: str):
        entry = self._store.get(key)
        if entry is None:
            return None
        return entry["data"]

    def set(self, key: str, data, ttl_seconds: int, stale_seconds: int = 0):
        if stale_seconds == 0:
            stale_seconds = ttl_seconds * 3
        now = time.time()
        self._store[key] = {
            "data": data,
            "expires_at": now + ttl_seconds,
            "stale_until": now + ttl_seconds + stale_seconds,
            "ttl": ttl_seconds,
        }

    def is_expired(self, key: str) -> bool:
        entry = self._store.get(key)
        if entry is None:
            return True
        return time.time() > entry["expires_at"]

    def get_ttl(self, key: str) -> int:
        entry = self._store.get(key)
        if entry is None:
            return 300
        return entry.get("ttl", 300)

    def start_refresh(self, key: str) -> bool:
        with self._lock:
            if key in self._refreshing:
                return False
            self._refreshing.add(key)
            return True

    def finish_refresh(self, key: str):
        with self._lock:
            self._refreshing.discard(key)

    def invalidate(self, pattern: str):
        keys_to_delete = [k for k in self._store if k == pattern or k.startswith(pattern + ":")]
        for k in keys_to_delete:
            del self._store[k]
        return len(keys_to_delete)

    def invalidate_all(self):
        count = len(self._store)
        self._store.clear()
        return count

    def enter_offline_mode(self):
        self._offline_mode = True
        for key in list(self._store.keys()):
            entry = self._store[key]
            if "stale_until" not in entry:
                entry["stale_until"] = entry["expires_at"] + 86400

    def exit_offline_mode(self):
        self._offline_mode = False

    def stats(self):
        total = len(self._store)
        total_requests = self._hits + self._stale_hits + self._misses
        return {
            "entries": total,
            "hits": self._hits,
            "stale_hits": self._stale_hits,
            "misses": self._misses,
            "hit_rate": round((self._hits + self._stale_hits) / total_requests * 100, 2) if total_requests > 0 else 0,
            "refreshing": len(self._refreshing),
            "offline_mode": self._offline_mode,
        }


cache = MemoryCache()
