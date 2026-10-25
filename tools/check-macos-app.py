#!/usr/bin/env python3
# Checks a macOS .app built on Linux (build-macos.sh), without a Mac:
#  - every Mach-O file is universal (x86_64 + arm64) and every slice carries a code signature (arm64 code must)
#  - each signature's CodeDirectory page hashes match the code, and the main executable's Info.plist and
#    _CodeSignature/CodeResources hashes match those files
#  - Info.plist has the expected keys; the locales were trimmed
#   tools/check-macos-app.py <ReminderFoxAgain.app> <version>
import hashlib, os, plistlib, struct, sys
app, ver = sys.argv[1], sys.argv[2]
probs = 0
def ok(name, cond, detail=''):
    global probs
    print(('OK   ' if cond else 'FAIL ') + name + ('' if cond else f'  ({detail})'))
    if not cond: probs += 1

def slices(d):
    if struct.unpack_from('>I', d)[0] == 0xcafebabe:
        n = struct.unpack_from('>I', d, 4)[0]
        for i in range(n):
            cpu, sub, off, size, al = struct.unpack_from('>IIIII', d, 8 + 20 * i)
            yield cpu, d[off:off + size]
    elif struct.unpack_from('<I', d)[0] == 0xfeedfacf:
        yield struct.unpack_from('<I', d, 4)[0], d

def code_dir(m):
    ncmds = struct.unpack_from('<I', m, 16)[0]; p = 32
    for _ in range(ncmds):
        cmd, size = struct.unpack_from('<II', m, p)
        if cmd == 0x1d:
            off, sz = struct.unpack_from('<II', m, p + 8)
            sb = m[off:off + sz]
            magic, length, count = struct.unpack_from('>III', sb)
            assert magic == 0xfade0cc0
            for i in range(count):
                typ, o = struct.unpack_from('>II', sb, 12 + 8 * i)
                if typ == 0:
                    return sb[o:], off
        p += size
    return None, None

def check_cd(m, cd, sig_off):
    magic, length, version, flags, hash_off, ident_off, nspecial, ncode, code_limit, hsize, htype, plat, pagesz = struct.unpack_from('>IIIIIIIIIBBBB', cd)
    assert magic == 0xfade0c02
    page = 1 << pagesz
    bad = 0
    for i in range(ncode):
        want = cd[hash_off + i * hsize: hash_off + (i + 1) * hsize]
        got = hashlib.sha256(m[i * page:min((i + 1) * page, code_limit)]).digest()[:hsize]
        if want != got: bad += 1
    special = lambda slot: cd[hash_off - slot * hsize: hash_off - (slot - 1) * hsize]
    return bad, ncode, flags, special, code_limit <= sig_off

machos = []
for root, dirs, files in os.walk(app):
    for f in files:
        p = os.path.join(root, f)
        if os.path.islink(p): continue
        with open(p, 'rb') as fh: head = fh.read(4)
        if len(head) == 4 and (struct.unpack('>I', head)[0] == 0xcafebabe or struct.unpack('<I', head)[0] == 0xfeedfacf):
            machos.append(p)
ok(f'Mach-O files found ({len(machos)})', len(machos) >= 6)
ARCH = {0x01000007: 'x86_64', 0x0100000c: 'arm64'}
main = os.path.join(app, 'Contents/MacOS/ReminderFoxAgain')
for p in machos:
    d = open(p, 'rb').read(); rel = os.path.relpath(p, app)
    sl = list(slices(d))
    ok(f'{rel}: universal', sorted(ARCH.get(c, hex(c)) for c, _ in sl) == ['arm64', 'x86_64'], [ARCH.get(c, hex(c)) for c, _ in sl])
    for cpu, m in sl:
        cd, off = code_dir(m)
        if cd is None: ok(f'{rel} [{ARCH.get(cpu)}]: signed', False, 'no signature'); continue
        bad, n, flags, special, lim = check_cd(m, cd, off)
        ok(f'{rel} [{ARCH.get(cpu)}]: {n} page hashes match, ad hoc', bad == 0 and flags & 0x2 and lim, f'{bad} bad, flags {flags:#x}')
        if p == main:
            info = open(os.path.join(app, 'Contents/Info.plist'), 'rb').read()
            res = open(os.path.join(app, 'Contents/_CodeSignature/CodeResources'), 'rb').read()
            ok(f'main [{ARCH.get(cpu)}]: Info.plist and CodeResources hashes match', special(1) == hashlib.sha256(info).digest() and special(3) == hashlib.sha256(res).digest())
# every file of the bundle is listed in CodeResources with its hash
res = plistlib.load(open(os.path.join(app, 'Contents/_CodeSignature/CodeResources'), 'rb'))
files2 = res.get('files2', {})
badres = []
for k, v in files2.items():
    p = os.path.join(app, 'Contents', k)
    if isinstance(v, dict) and 'hash2' in v and os.path.isfile(p) and not os.path.islink(p):
        if hashlib.sha256(open(p, 'rb').read()).digest() != v['hash2']: badres.append(k)
ok(f'CodeResources: {len(files2)} resources, hashes match', len(files2) >= 5 and not badres, badres[:3])
ok('app.asar is sealed in CodeResources', 'Resources/app.asar' in files2)
pl = plistlib.load(open(os.path.join(app, 'Contents/Info.plist'), 'rb'))
want = {'CFBundleIdentifier': 'org.reminderfoxagain.desktop', 'CFBundleShortVersionString': ver, 'CFBundleVersion': ver,
        'LSApplicationCategoryType': 'public.app-category.productivity', 'LSMinimumSystemVersion': '13.0', 'CFBundleIconFile': 'electron.icns',
        'CFBundleExecutable': 'ReminderFoxAgain', 'NSRequiresAquaSystemAppearance': False}
for k, v in want.items():
    ok(f'Info.plist {k} = {v}', pl.get(k) == v, pl.get(k))
ok('the fox icon', open(os.path.join(app, 'Contents/Resources', pl.get('CFBundleIconFile', 'x')), 'rb').read() == open('build/macos/icon.icns', 'rb').read())
lp = [d for d in os.listdir(os.path.join(app, 'Contents/Frameworks/Electron Framework.framework/Versions/A/Resources')) if d.endswith('.lproj')]
ok(f'locales trimmed ({len(lp)})', 25 <= len(lp) <= 34, len(lp))
asar = open(os.path.join(app, 'Contents/Resources/app.asar'), 'rb').read(1 << 20)
ok('the menu bar icon (template images) in app.asar', b'trayTemplate.png' in asar and b'trayTemplate@2x.png' in asar)
print(f'== {probs} problem(s)'); sys.exit(1 if probs else 0)
