import * as Haptics from 'expo-haptics';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ForkMark } from '@/components/layout/ForkMark';
import { Logo } from '@/components/layout/Logo';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Notice, Screen, SegmentedControl } from '@/components/ui/primitives';
import { smooth, type PressState } from '@/components/ui/pressState';
import { Text } from '@/components/ui/Text';
import { getSettings, updateSettings, useSettings } from '@/features/settings/store';
import { Soundhole } from '@/features/tuner/Soundhole';
import { howFar, LevelMeter, MicButton, Screws, TuneMeter } from '@/features/tuner/TunerPanel';
import { playAllTuned, playStringTuned } from '@/features/tuner/chime';
import { CustomTuningEditor } from '@/features/tuner/CustomTuningEditor';
import { useTuner } from '@/features/tuner/useTuner';
import { ALL_TUNINGS, findTuning, INSTRUMENTS, instrumentOf, makeCustomTuning, tuningStrings, type InstrumentId, type Tuning } from '@/lib/music/instruments';
import { useTheme } from '@/theme/ThemeProvider';
import { useLayout } from '@/theme/useLayout';
import { fonts, radius, spacing } from '@/theme/tokens';

const bare = (note: string) => note.replace(/-?\d+$/, '');

const ORDINAL = ['', '', '2nd', '3rd', '4th', '5th'];
const COUNT = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

/**
 * Where a string sits. Six-string guitars: by thickness ("the thickest", "the 2nd thinnest"…).
 * Others: by position, since a ukulele's top string isn't its thickest.
 */
function whichString(stringNo: number, count: number): string {
  if (count === 6) return ['', 'the thinnest', 'the 2nd thinnest', 'the 3rd thinnest', 'the 3rd thickest', 'the 2nd thickest', 'the thickest'][stringNo] ?? '';
  const fromTop = count - stringNo + 1;
  if (fromTop === 1) return 'the top string';
  if (stringNo === 1) return 'the bottom string';
  return `the ${ORDINAL[fromTop]} from the top`;
}

/**
 * The tuner screen. Riffly shows it as its first tab; the standalone tuner app (tuner/ folder)
 * shows it on its own, so it takes the app name and drops links to the rest of Riffly.
 */
export function TunerScreen({ appName = 'Riffly', standalone = false }: { appName?: string; standalone?: boolean }) {
  const { colors } = useTheme();
  const { width, isPhone, isDesktop } = useLayout();
  const { reduceMotion, tuneSound, customTunings } = useSettings();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{ tuning?: string }>();
  const [tuningId, setTuningIdState] = useState(params.tuning ?? getSettings().defaultTuning);
  // The chosen tuning (and so the instrument) is remembered for next time.
  const setTuningId = (id: string) => {
    setTuningIdState(id);
    updateSettings({ defaultTuning: id });
  };
  const [selected, setSelected] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  // "Tune to this" from a song opens the tuner with that song's tuning selected.
  useEffect(() => {
    if (params.tuning && [...ALL_TUNINGS, ...getSettings().customTunings].some((t) => t.id === params.tuning)) {
      setTuningIdState(params.tuning);
      setSelected(null);
    }
  }, [params.tuning]);
  const [a4, setA4State] = useState(() => getSettings().a4);
  const setA4 = (n: number) => {
    setA4State(n);
    updateSettings({ a4: n });
  };
  const tuning = findTuning(tuningId, customTunings);
  const instrument = instrumentOf(tuning);
  const myTunings = customTunings.filter((t) => t.instrument === instrument.id);
  const pickInstrument = (id: InstrumentId) => {
    if (id === instrument.id) return;
    const next = INSTRUMENTS.find((i) => i.id === id);
    if (!next) return;
    setTuningId(next.tunings[0].id);
    setSelected(null);
    setMenu(false);
    setEditor(null);
  };

  // Custom tunings: the editor opens from the tuning menu, starting from the tuning on screen
  // (new) or from a saved one (edit).
  const [editor, setEditor] = useState<{ base: Tuning; editing: boolean } | null>(null);
  const saveCustom = (name: string, notes: string[]) => {
    if (!editor) return;
    const id = editor.editing ? editor.base.id : `custom-${Date.now()}`;
    const fallbackName = `My tuning ${customTunings.filter((t) => t.instrument === instrument.id).length + 1}`;
    const saved = makeCustomTuning(id, name || fallbackName, instrument.id, notes);
    updateSettings({
      customTunings: editor.editing ? customTunings.map((t) => (t.id === id ? saved : t)) : [...customTunings, saved],
    });
    setTuningId(id);
    setSelected(null);
    setDone(new Set());
    setEditor(null);
  };
  const deleteCustom = () => {
    if (!editor?.editing) return;
    const id = editor.base.id;
    updateSettings({ customTunings: customTunings.filter((t) => t.id !== id) });
    if (tuningId === id) setTuningId(instrument.tunings[0].id);
    setEditor(null);
  };
  const { status, error, reading, levelDb, strings, start, stop } = useTuner(tuning, selected, a4);

  const listening = status === 'listening';
  const inTune = reading?.state === 'in-tune';
  const stable = !!reading?.stable;

  // Strings tuned this session get a tick.
  const [done, setDone] = useState<Set<number>>(() => new Set());
  useEffect(() => setDone(new Set()), [tuningId, a4]);
  useEffect(() => {
    if (stable && reading?.target) {
      const i = reading.target.index;
      setDone((d) => (d.has(i) ? d : new Set(d).add(i)));
    }
  }, [stable, reading?.target]);
  const allDone = done.size === strings.length;

  // The moment a string settles in tune: a chime (a longer one when it's the last string), and a
  // buzz on phones.
  const wasStable = useRef(false);
  const doneRef = useRef(done);
  doneRef.current = done;
  useEffect(() => {
    if (stable && !wasStable.current) {
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (tuneSound) {
        const i = reading?.target?.index;
        const d = doneRef.current;
        const finishesSet = i !== undefined && !d.has(i) && d.size + 1 === strings.length;
        if (finishesSet) playAllTuned();
        else playStringTuned();
      }
    }
    wasStable.current = stable;
    // Only the moment `stable` turns on matters; the rest is read as of then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stable]);

  // A fresh pluck (a note heard after silence) restarts the string's ring.
  const [pluck, setPluck] = useState(0);
  const heard = !!reading;
  useEffect(() => {
    if (heard) setPluck((p) => p + 1);
  }, [heard]);

  const toggle = () => {
    if (listening) {
      stop();
      return;
    }
    if (allDone) setDone(new Set());
    void start();
  };
  // Space starts and stops the mic while the tuner is on screen (before the player's Space).
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  useEffect(() => {
    if (Platform.OS !== 'web' || !focused) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [focused]);

  // The string being tuned: what the mic hears, else the chosen one, else the next untuned one.
  const nextUp = strings.findIndex((s) => !done.has(s.index));
  const active = reading?.target?.index ?? selected ?? (nextUp >= 0 ? nextUp : 0);
  const activeString = strings[active];
  const name = bare(activeString.note);
  const count = strings.length;
  const stringNo = count - active;
  const cents = reading ? reading.centsSmooth : null;
  const flat = !!reading && !inTune && reading.state === 'flat';

  const stateColor = allDone ? colors.success : !reading ? colors.text : inTune ? colors.success : flat ? colors.highlight : colors.danger;
  const headline = allDone
    ? `All ${COUNT[count] ?? count} strings are in tune`
    : !reading
      ? `Pluck the ${name} string`
      : inTune
        ? `Perfect, the ${name} string is in tune`
        : `${flat ? 'Tighten' : 'Loosen'} the ${name} string ${howFar(reading.centsSmooth)}`;
  const detail = allDone
    ? standalone ? 'Ready to play.' : 'Ready to play. Press 3 to play along with a song.'
    : !listening
      ? `String ${stringNo}, ${whichString(stringNo, count)}. Start the tuner, then pluck it and let it ring.`
      : !reading
        ? `String ${stringNo}, ${whichString(stringNo, count)}. Pluck it and let it ring.`
        : inTune
          ? stable
            ? 'Got it. Now pluck the next string.'
            : 'Hold it there for a moment.'
          : flat
            ? 'It sounds too low. Turn the peg slowly to tighten, pluck again, and bring the marker to the middle.'
            : 'It sounds too high. Turn the peg slowly to loosen, pluck again, and bring the marker to the middle.';
  const target = reading ? reading.targetFrequency : activeString.frequency;
  const web = Platform.OS === 'web';
  const micTitle = allDone && !listening ? 'Tune again' : listening ? 'Tuner is listening' : 'Start the tuner';
  const micSub = listening ? (web ? 'Click the button or press the Space bar to stop.' : 'Tap the button to stop.') : web ? 'Click the button or press the Space bar.' : 'Tap the button to start.';

  // Side by side on a wide window, stacked otherwise.
  const content = width - (isDesktop ? 232 : 0) - (isPhone ? spacing.lg * 2 : 72);
  const sideBySide = content >= 900;
  const holeW = sideBySide ? Math.min(560, content * 0.48) : Math.min(content, 460);
  const names = strings.map((s) => bare(s.note));

  return (
    <Screen maxWidth={1240}>
      {isPhone && !standalone && <Logo />}
      <View style={[styles.header, { zIndex: 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel={standalone ? appName : 'Tuner'}>
          {standalone && <ForkMark size={38} color={colors.text} />}
          <Text
            variant="title"
            style={standalone ? { fontSize: 34, lineHeight: 38, fontFamily: fonts.bodySemibold, letterSpacing: -1.2 } : { fontSize: 34, lineHeight: 38 }}
          >
            {standalone ? appName : 'Tuner'}
          </Text>
        </View>
        <SegmentedControl<InstrumentId>
          label="Instrument"
          value={instrument.id}
          onChange={pickInstrument}
          options={INSTRUMENTS.map((i) => ({ value: i.id, label: i.name }))}
        />
        <View style={{ zIndex: 10 }}>
          <Pressable
            onPress={() => setMenu((m) => !m)}
            accessibilityRole="button"
            accessibilityLabel={`Tuning: ${tuning.name}. Change tuning`}
            accessibilityState={{ expanded: menu }}
            style={({ hovered }: PressState) => [smooth, styles.tuningBtn, { borderColor: colors.border, backgroundColor: hovered ? colors.surfaceHover : colors.surface }]}
          >
            <Text style={{ fontSize: 13 }}>{tuning.name}</Text>
            <Text variant="mono" tone="subtle" style={{ fontSize: 11, letterSpacing: 1.3 }}>{names.join(' ')}</Text>
            <Icon name={menu ? 'chevron-up' : 'chevron-down'} size={12} color={colors.text} />
          </Pressable>
          {menu && (
            <View style={[styles.menu, { borderColor: colors.border, backgroundColor: colors.backgroundRaised }]} role="menu">
              {[...instrument.tunings, ...myTunings].map((t, i) => {
                const on = t.id === tuningId;
                const mine = i >= instrument.tunings.length;
                return (
                  <View key={t.id}>
                    {i === instrument.tunings.length && (
                      <Text variant="overline" tone="subtle" style={styles.menuHeading}>Your tunings</Text>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Pressable
                        role="menuitem"
                        accessibilityState={{ checked: on }}
                        onPress={() => {
                          setTuningId(t.id);
                          setSelected(null);
                          setMenu(false);
                          setEditor(null);
                        }}
                        style={({ hovered }: PressState) => [smooth, styles.menuItem, { flex: 1, backgroundColor: on ? colors.accentSoft : hovered ? colors.surfaceHover : 'transparent' }]}
                      >
                        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, color: on ? colors.text : colors.textMuted }}>{t.name}</Text>
                        <Text variant="mono" style={{ fontSize: 11, letterSpacing: 1.2, color: on ? colors.highlight : colors.textSubtle }}>
                          {tuningStrings(t).map((s) => bare(s.note)).join(' ')}
                        </Text>
                      </Pressable>
                      {mine && (
                        <IconButton
                          icon="create-outline"
                          label={`Edit ${t.name}`}
                          size={30}
                          onPress={() => {
                            setEditor({ base: t, editing: true });
                            setMenu(false);
                          }}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
              <View style={[styles.menuDivider, { backgroundColor: colors.divider }]} />
              <Pressable
                role="menuitem"
                onPress={() => {
                  setEditor({ base: tuning, editing: false });
                  setMenu(false);
                }}
                style={({ hovered }: PressState) => [smooth, styles.menuItem, { justifyContent: 'flex-start', backgroundColor: hovered ? colors.surfaceHover : 'transparent' }]}
              >
                <Icon name="add" size={14} color={colors.highlight} />
                <Text style={{ fontSize: 13, color: colors.highlight }}>Make a custom tuning</Text>
              </Pressable>
            </View>
          )}
        </View>
        <SegmentedControl<'auto' | 'manual'>
          label="String detection"
          value={selected === null ? 'auto' : 'manual'}
          onChange={(v) => setSelected(v === 'auto' ? null : active)}
          options={[{ value: 'auto', label: 'Auto string' }, { value: 'manual', label: 'Manual' }]}
        />
        <View style={{ flex: 1 }} />
        <IconButton
          icon={tuneSound ? 'volume-high' : 'volume-mute'}
          label={tuneSound ? 'Turn off the in-tune chime' : 'Turn on the in-tune chime'}
          size={32}
          active={tuneSound}
          onPress={() => {
            const on = !tuneSound;
            updateSettings({ tuneSound: on });
            if (on) playStringTuned();
          }}
        />
        <View style={[styles.refBox, { borderColor: colors.border }]}>
          <IconButton icon="remove" label="Lower reference pitch" size={22} onPress={() => setA4(Math.max(415, a4 - 1))} />
          <Text variant="mono" tone="muted" style={{ fontSize: 12 }} accessibilityLabel={`Reference A4 ${a4} hertz`}>A4 = {a4} Hz</Text>
          <IconButton icon="add" label="Raise reference pitch" size={22} onPress={() => setA4(Math.min(466, a4 + 1))} />
        </View>
      </View>

      {editor && (
        <CustomTuningEditor
          key={`${editor.base.id}-${editor.editing}`}
          instrument={instrument}
          base={editor.base}
          editing={editor.editing}
          a4={a4}
          onSave={saveCustom}
          onCancel={() => setEditor(null)}
          onDelete={deleteCustom}
        />
      )}

      <View style={[styles.stage, { flexDirection: sideBySide ? 'row' : 'column' }]}>
        <View style={[styles.holeWrap, sideBySide && { flex: 1 }]}>
          <Soundhole
            names={names}
            frequencies={strings.map((s) => s.frequency)}
            instrument={instrument.id}
            active={allDone ? null : active}
            done={done}
            live={listening}
            cents={cents}
            inTune={inTune}
            allDone={allDone}
            note={allDone ? '✓' : name}
            noteSub={allDone ? `ALL ${(COUNT[count] ?? String(count)).toUpperCase()} IN TUNE` : !listening ? `STRING ${stringNo} · STANDBY` : `${activeString.note} · STRING ${stringNo}`}
            pluckKey={pluck}
            reduceMotion={reduceMotion}
            width={holeW}
          />
        </View>

        <View style={[styles.side, sideBySide && { flex: 1 }]} accessibilityLabel="Pitch readout">
          <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.backgroundRaised }]}>
            <Screws />
            <View style={styles.panelHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: allDone ? colors.success : listening ? colors.accent : '#4A4B44',
                    boxShadow: listening && !allDone ? '0 0 0 4px rgba(197,138,69,0.22)' : undefined,
                  }}
                />
                <Text variant="overline" style={{ fontSize: 11, letterSpacing: 1.8, color: listening || allDone ? colors.text : colors.textSubtle }}>
                  {allDone ? 'Done' : `Tuning string ${stringNo} · ${name}`}
                </Text>
              </View>
              <LevelMeter db={listening ? levelDb : null} />
            </View>
            <View style={{ gap: 6 }} aria-live="polite">
              <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: stateColor }}>{headline}</Text>
              <Text tone="muted" style={{ fontSize: 14, lineHeight: 21 }}>{detail}</Text>
            </View>
            <TuneMeter cents={cents} inTune={inTune} hearing={listening && !!reading} allDone={allDone} />
            <View style={[styles.pitchLine, { borderTopColor: colors.divider }]}>
              <Text variant="mono" tone="subtle" style={{ fontSize: 12 }}>{reading ? `You're playing ${reading.frequency.toFixed(1)} Hz` : ' '}</Text>
              <Text variant="mono" tone="subtle" style={{ fontSize: 12 }}>{allDone ? ' ' : `Target ${target.toFixed(1)} Hz`}</Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <MicButton live={listening} onPress={toggle} reduceMotion={reduceMotion} busy={status === 'requesting'} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 16, lineHeight: 22 }}>{micTitle}</Text>
              <Text tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>{micSub}</Text>
            </View>
          </View>

          <View style={styles.strings} role="radiogroup" accessibilityLabel="Strings">
            {strings.map((s) => {
              const on = s.index === active && !allDone;
              const ok = done.has(s.index);
              const locked = selected === s.index;
              return (
                <Pressable
                  key={s.index}
                  role="radio"
                  accessibilityState={{ checked: locked }}
                  accessibilityLabel={`String ${count - s.index}, ${s.note}${ok ? ', in tune' : ''}`}
                  onPress={() => {
                    setSelected(locked ? null : s.index);
                    setDone((d) => {
                      if (!d.has(s.index)) return d;
                      const n = new Set(d);
                      n.delete(s.index);
                      return n;
                    });
                  }}
                  style={({ hovered }: PressState) => [smooth, 
                    styles.stringBtn,
                    {
                      borderColor: on ? colors.accent : ok ? 'rgba(143,160,127,0.45)' : colors.border,
                      backgroundColor: on ? '#33342E' : hovered ? colors.surfaceHover : '#2A2B26',
                    },
                  ]}
                >
                  <Text variant="mono" tone="subtle" style={{ fontSize: 10 }}>STRING {count - s.index}</Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 24, color: ok ? colors.success : colors.text }}>{bare(s.note)}</Text>
                  <Text variant="mono" style={{ fontSize: 10, color: ok ? colors.success : on ? colors.highlight : colors.textSubtle }}>
                    {ok ? '✓ IN TUNE' : on ? (listening ? 'LISTENING' : 'NEXT') : `${s.frequency.toFixed(1)} HZ`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {status === 'denied' && (
            <Notice tone="error">Microphone access was denied. Allow {appName} to use the microphone in {Platform.OS === 'web' ? 'Windows privacy settings' : 'device settings'}.</Notice>
          )}
          {error && <Notice tone="error">{error}</Notice>}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="lock-closed-outline" size={14} color={colors.textSubtle} />
            <Text variant="caption" tone="subtle" style={{ fontSize: 12 }}>Sound is analysed on this {Platform.OS === 'web' ? 'computer' : 'device'} and never recorded.</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 18, rowGap: 12 },
  tuningBtn: { height: 36, paddingHorizontal: 12, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  menu: { position: 'absolute', top: 40, left: 0, minWidth: 300, borderWidth: 1, borderRadius: radius.lg, padding: 4, zIndex: 20, boxShadow: '0 12px 32px rgba(0,0,0,0.35)' },
  menuHeading: { fontSize: 10, letterSpacing: 1.6, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 4 },
  menuDivider: { height: 1, marginVertical: 4, marginHorizontal: 6 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, height: 34, paddingHorizontal: 10, borderRadius: radius.sm },
  refBox: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 32, paddingHorizontal: 2, borderRadius: radius.md, borderWidth: 1 },
  stage: { gap: 28, alignItems: 'center' },
  holeWrap: { alignItems: 'center', justifyContent: 'center' },
  side: { width: '100%', maxWidth: 560, gap: 14 },
  panel: { borderWidth: 1, borderRadius: 14, paddingTop: 22, paddingHorizontal: 24, paddingBottom: 20, gap: 18 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pitchLine: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 60 },
  strings: { flexDirection: 'row', gap: 6 },
  stringBtn: { flex: 1, minWidth: 0, height: 76, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
