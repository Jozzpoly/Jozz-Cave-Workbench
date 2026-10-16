# Jaskinia v2 — design decisions (14 Oct 2026)

Data refreshed: snapshot 2026-10-14 06:21 UTC, 29 repos (new: Mini_Feniks -> family "feniks", Jozz-Cave-Workbench -> family "medium", short "Cave Workbench"). Comparison base = Oct 10 snapshot (scratchpad/library.2026-10-10.json). Regen: `env -u GH_TOKEN python3 -I tools/regen.py [--no-fetch --since <file>]` (gh needs GH_TOKEN unset; proxy authenticates).

## Colour semantics
- Liveness (time since last commit, measured against SNAPSHOT time in Jaskinia) = fill ramp --h5..--h1 green -> teal -> blue; --h0 = neutral (older than 30 d), no hatch. Hatch only for "puste".
- Red only for attention (findings badges, errors, broken links, "zakończone" stays ✕ since the only one is TERMINATED).
- --hand amber stays for hand-set things. Themes x life ramp ("zieleń" default / "żar" classic Library).

## Store v2 (localStorage)
- jaskinia:v2 {v:2,cur,sel,spaces[{id,name,preset,purpose,L}],notes{id:{text,upd}},saved[],trash[],views{winId:{cam}}}
- jaskinia:prefs (theme, scheme, life, density, cz, lang, wheel, tips, motion)
- jaskinia:kopie automatic backups (cap 10, ~2MB), before destructive ops + at boot if >8h and changed
- jaskinia:ratunek raw copy of unreadable data; jaskinia:v1 never deleted (migrated)
- Load never all-or-nothing: bad space -> trash (kind broken) + banner; dup window ids remapped.
- Notes text in store.notes (never undone by layout undo). Notes window: w.st.note = id. Duplicating a layout shares note ids.
- Trash: spaces, saved, broken; orphan notes computed (not referenced anywhere). "Usuń na zawsze" = serious red confirm.
- Saved ("Zapisane układy"): kind space|all, explicit (Ctrl+S, menus). Restore = undoable for space; all -> backup first + toast Cofnij.
- Export/import JSON: downloads capability if present, blob link on web host, else textarea+copy. Import file input + paste.

## Shell
- Brand button = main menu (Ustawienia, Zapisz układ, Zapisane i kopie, Kosz, Eksport/Import, Reset całej Jaskini, Jak to działa).
- Settings = window type "ustawienia" (Blender Preferences as editor). Sections: Wygląd, Język, Układy, Kopie i kosz, Skróty, O Jaskini.
- Tabs overflow: wheel scroll, edge arrows, "wszystkie układy" menu; active tab scrolled into view. Delete -> trash + toast Przywróć.
- Window custom title (w.title), F2/menu rename.
- Phone mode (stage < 700): one window at a time + bottom dock of window chips + workspace sheet; big touch targets; selection sheet (Karta/Zagraj).
- Refresh deferred during gestures; user-select none on chrome and during drags.
- UI size = density vars (not CSS zoom); "Powiększenie treści" = global multiplier on window content zoom.
- i18n: t('Polish source', ...args) with EN dictionary (shell only; Library panels stay Polish, said honestly).

## Wall v2
- World coords (center x,y; w,h if hand-sized), camera per window in store.views (not undoable).
- LOD by screen size (world size x cam.z): dot / S badge (name inside rect) / M / L / XL. Semantic zoom.
- Gestures: mouse drag card = move; touch long-press = move, touch drag = pan; drag empty = pan; Shift+drag empty = box select;
  wheel = zoom at cursor (setting: or pan); pinch = zoom; resize handle only on selected card, outside the body, 28-32px hit.
- Never auto-reshuffle. "Ułóż…" explicit (rodziny / życie / świeżość / siatka), "Rozsuń nachodzące" explicit, undoable.
- Frames (from family layout or manual), move frame moves its contents. Sticky notes (text in store.notes). Links toggle. Minimap.
- New repos placed in "Nowe" column right of the bounding box.
