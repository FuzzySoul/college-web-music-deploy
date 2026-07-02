import httpx, time

c = httpx.Client(timeout=30)

print("=== Test 1: Normal request (pre-warmed) ===")
r1 = c.get('http://localhost:8000/api/cache/playlists')
d1 = r1.json()
print(f"  Local: {len(d1.get('local', []))}, External: {len(d1.get('external', []))}")

print()
print("=== Test 2: Invalidate playlists cache ===")
r2 = c.post('http://localhost:8000/api/cache/invalidate', json={"keys": ["playlists"]}, headers={'Content-Type': 'application/json'})
print(f"  Invalidated: {r2.json()}")

print()
print("=== Test 3: Request after invalidate (should re-fetch) ===")
r3 = c.get('http://localhost:8000/api/cache/playlists')
d3 = r3.json()
print(f"  Local: {len(d3.get('local', []))}, External: {len(d3.get('external', []))}")

print()
print("=== Test 4: Admin playlists (pre-warmed) ===")
r4 = c.get('http://localhost:8000/api/cache/admin/playlists/all')
d4 = r4.json()
print(f"  Local: {len(d4.get('local', []))}, External: {len(d4.get('external', []))}")

print()
print("=== Test 5: Invalidate playlists should also invalidate admin:playlists ===")
r5 = c.post('http://localhost:8000/api/cache/invalidate', json={"keys": ["playlists"]}, headers={'Content-Type': 'application/json'})
print(f"  Invalidated: {r5.json()}")

r6 = c.get('http://localhost:8000/api/cache/admin/playlists/all')
d6 = r6.json()
print(f"  Admin playlists after invalidate: Local={len(d6.get('local', []))}, External={len(d6.get('external', []))}")

print()
print("=== Test 6: Verify fetch_table returns None on error (not []) ===")
print("  (This is the key fix - empty data should NOT be cached)")

print()
s = c.get('http://localhost:8000/api/cache/stats').json()
print(f"Cache stats: entries={s['entries']}, hits={s['hits']}, stale={s['stale_hits']}, rate={s['hit_rate']}%")
