import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { smooth, type PressState } from '@/components/ui/pressState';
import { Text } from '@/components/ui/Text';
import { customStringRange, noteFromMidi, parseNote, type Instrument, type Tuning } from '@/lib/music/instruments';
import { midiToFrequency } from '@/lib/music/notes';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius } from '@/theme/tokens';

const bare = (note: string) => note.replace(/-?\d+$/, '');

export interface CustomTuningEditorProps {
  instrument: Instrument;
  /** The tuning to start from: the one on screen (new) or the saved one being edited. */
  base: Tuning;
  /** True when changing a saved tuning (shows Delete). */
  editing: boolean;
  a4: number;
  onSave: (name: string, notes: string[]) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

/**
 * Make your own tuning: move each string up or down a half-step at a time, name it, save it.
 * Saved tunings show up in the tuning menu for that instrument.
 */
export function CustomTuningEditor({ instrument, base, editing, a4, onSave, onCancel, onDelete }: CustomTuningEditorProps) {
  const { colors } = useTheme();
  const [name, setName] = useState(editing ? base.name : '');
  const [midis, setMidis] = useState(() => base.notes.map((n) => parseNote(n)));
  // Each string may move up to an octave from where it sits in the instrument's standard tuning.
  const standard = instrument.tunings.find((t) => t.notes.length === base.notes.length) ?? base;
  const ranges = standard.notes.map((n) => customStringRange(parseNote(n)));
  const count = midis.length;

  const shift = (i: number, by: number) =>
    setMidis((m) => m.map((v, j) => (j === i ? Math.max(ranges[i].min, Math.min(ranges[i].max, v + by)) : v)));
  const resetTo = (t: Tuning) => setMidis(t.notes.map((n) => parseNote(n)));

  const arrow = (icon: IconName, label: string, onPress: () => void, disabled: boolean) => (
    <Pressable
      role="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered }: PressState) => [smooth, styles.arrow, { opacity: disabled ? 0.3 : 1, backgroundColor: hovered ? colors.surfaceHover : 'transparent' }]}
    >
      <Icon name={icon} size={16} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={[styles.panel, { borderColor: colors.accent, backgroundColor: colors.backgroundRaised }]} accessibilityLabel="Custom tuning editor">
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 26 }}>
            {editing ? 'Edit your tuning' : `New ${instrument.name.toLowerCase()} tuning`}
          </Text>
          <Text tone="muted" style={{ fontSize: 13, lineHeight: 19 }}>
            Use the arrows to raise or lower each string a half-step at a time, then give it a name and save it.
          </Text>
        </View>
        <Button label="Start from standard" variant="ghost" size="sm" icon="refresh" onPress={() => resetTo(standard)} />
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name it, e.g. My open tuning"
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel="Tuning name"
        maxLength={40}
        style={[styles.name, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, fontFamily: fonts.body }]}
      />

      <View style={styles.strings}>
        {midis.map((m, i) => {
          const changed = m !== parseNote(standard.notes[i]);
          const note = noteFromMidi(m);
          return (
            <View key={i} style={[styles.string, { borderColor: changed ? colors.accent : colors.border, backgroundColor: colors.surface }]}>
              <Text variant="mono" tone="subtle" style={{ fontSize: 10 }}>STRING {count - i}</Text>
              {arrow('chevron-up', `Raise string ${count - i} a half-step`, () => shift(i, 1), m >= ranges[i].max)}
              <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: changed ? colors.highlight : colors.text }} accessibilityLabel={`String ${count - i}: ${note}`}>
                {bare(note)}
              </Text>
              <Text variant="mono" tone="subtle" style={{ fontSize: 10 }}>{note}</Text>
              {arrow('chevron-down', `Lower string ${count - i} a half-step`, () => shift(i, -1), m <= ranges[i].min)}
              <Text variant="mono" tone="subtle" style={{ fontSize: 10 }}>{midiToFrequency(m, a4).toFixed(1)} HZ</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        {editing && onDelete ? <Button label="Delete" variant="danger" size="sm" icon="trash-outline" onPress={onDelete} /> : null}
        <View style={{ flex: 1 }} />
        <Button label="Cancel" variant="secondary" size="sm" onPress={onCancel} />
        <Button label={editing ? 'Save changes' : 'Save tuning'} size="sm" icon="checkmark" onPress={() => onSave(name, midis.map(noteFromMidi))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 20, gap: 16 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 },
  name: { height: 40, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, fontSize: 14 },
  strings: { flexDirection: 'row', gap: 8 },
  string: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', gap: 4 },
  arrow: { width: 36, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
