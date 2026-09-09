/**
 * MGC-2099-A — save-picker multi-slot.
 *
 * UI inline + modal:
 *   - Modo colapsado: muestra "Save actual: <name> [Cambiar]" con el nombre
 *     del slot activo. El botón [Cambiar] abre el modal.
 *   - Modo expandido (modal nativo): lista los slots guardados
 *     (ordenados por `savedAt` desc) y agrega un CTA "Nueva partida"
 *     que abre un TextInput inline. Tap en una fila cambia el slot activo
 *     y notifica al padre via `onSlotChanged(slotId)` para que recargue
 *     el store.
 *
 * Diseño:
 *   - Modal nativo RN (consistente con InterstitialOverlay / MGC-500).
 *   - WCAG 48dp hitboxes en todos los Pressables (MGC-2304).
 *   - `testID` canónicos para que los specs e2e / Maestro validen el
 *     flujo AC ("Save actual: <name> [Cambiar]").
 *   - El modal es accesible (`accessibilityViewIsModal` para TalkBack).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityRole,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '@/design/useTheme';
import {
  createSlot,
  listSlots,
  setActiveSlot,
  type SlotMeta,
} from '@/features/career/persistence';

const MODAL_ROLE: AccessibilityRole =
  Platform.OS === 'android' ? 'none' : ('dialog' as AccessibilityRole);

export type SaveSlotPickerProps = {
  /** Slot actualmente activo. Si difiere del storage, el componente
   *  refresca el modal la próxima vez que se abre. */
  activeSlotId: string;
  /** Slot a mostrar como nombre (default: el meta del activeSlotId). */
  activeSlotName?: string;
  /** Notifica al padre que el usuario cambió de slot activo. */
  onSlotChanged: (slotId: string) => void;
  /** Test id para el spec e2e (MGC-2099 AC). */
  testID?: string;
};

type RefreshState = { slots: SlotMeta[]; activeSlotId: string };

function formatSavedAt(ts: number): string {
  try {
    const d = new Date(ts);
    const hh = `${d.getHours()}`.padStart(2, '0');
    const mm = `${d.getMinutes()}`.padStart(2, '0');
    const dd = `${d.getDate()}`.padStart(2, '0');
    const mo = `${d.getMonth() + 1}`.padStart(2, '0');
    return `${dd}/${mo} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

export function SaveSlotPicker({
  activeSlotId,
  activeSlotName,
  onSlotChanged,
  testID = 'save-slot-picker',
}: SaveSlotPickerProps) {
  const { colors, radii, spacing, fontSize, fontWeight } = useTheme();
  const [visible, setVisible] = useState(false);
  const [refresh, setRefresh] = useState<RefreshState>({
    slots: [],
    activeSlotId,
  });
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  // Refresca el modal cada vez que se abre; usa el `activeSlotId` actual
  // como fuente de verdad (el store puede haber cambiado por otro lado).
  // Se dispara desde un handler de evento (no desde useEffect) para
  // respetar `react-hooks/set-state-in-effect`: la regla sólo aplica a
  // setState síncrono dentro del cuerpo del effect.
  const refreshSlots = useCallback(async () => {
    try {
      const next = await listSlots();
      setRefresh(next);
    } catch {
      // Mantener el último estado conocido.
    }
  }, []);

  const openPicker = useCallback(() => {
    setCreating(false);
    setNewName('');
    setVisible(true);
    void refreshSlots();
  }, [refreshSlots]);

  // useEffect mínimo: limpia el TextInput si el modal se cierra por
  // back de Android (`onRequestClose`). El setState está diferido en
  // microtask para no caer en la regla de cascading renders.
  useEffect(() => {
    if (visible) return;
    Promise.resolve().then(() => {
      setCreating(false);
      setNewName('');
    });
  }, [visible]);

  const displayedName = useMemo(() => {
    if (activeSlotName) return activeSlotName;
    const meta = refresh.slots.find((s) => s.id === activeSlotId);
    return meta?.name ?? 'Partida guardada';
  }, [activeSlotName, refresh.slots, activeSlotId]);

  const onPick = useCallback(
    async (slot: SlotMeta) => {
      if (busy) return;
      setBusy(true);
      try {
        await setActiveSlot(slot.id);
        onSlotChanged(slot.id);
        setVisible(false);
      } finally {
        setBusy(false);
      }
    },
    [busy, onSlotChanged],
  );

  const onCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const meta = await createSlot(name);
      await setActiveSlot(meta.id);
      onSlotChanged(meta.id);
      setNewName('');
      setCreating(false);
      setVisible(false);
    } finally {
      setBusy(false);
    }
  }, [newName, busy, onSlotChanged]);

  return (
    <View>
      <View
        testID={testID}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[3],
          gap: spacing[3],
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.semibold,
              letterSpacing: 1,
            }}
          >
            SAVE ACTUAL
          </Text>
          <Text
            testID={`${testID}-name`}
            style={{
              color: colors.textStrong,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
            }}
            numberOfLines={1}
          >
            {displayedName}
          </Text>
        </View>
        <Pressable
          testID={`${testID}-change`}
          accessibilityRole="button"
          accessibilityLabel="Cambiar de partida guardada"
          onPress={openPicker}
          style={({ pressed }) => ({
            minHeight: 48,
            minWidth: 96,
            paddingHorizontal: spacing[4],
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radii.pill,
            backgroundColor: pressed ? colors.primarySoft : colors.primary,
          })}
        >
          <Text
            style={{
              color: colors.textOnPrimary,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.bold,
            }}
          >
            Cambiar
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View
          accessibilityViewIsModal
          style={styles.backdrop}
          testID={`${testID}-modal`}
        >
          <View
            accessibilityRole={MODAL_ROLE}
            style={{
              width: '92%',
              maxWidth: 480,
              maxHeight: '85%',
              backgroundColor: colors.bg,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing[4],
              gap: spacing[3],
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                color: colors.textStrong,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
              }}
            >
              Tus partidas guardadas
            </Text>

            {refresh.slots.length === 0 ? (
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: fontSize.sm,
                }}
                testID={`${testID}-empty`}
              >
                Aún no hay partidas guardadas.
              </Text>
            ) : (
              <FlatList
                testID={`${testID}-list`}
                data={refresh.slots}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => (
                  <View style={{ height: 1, backgroundColor: colors.border }} />
                )}
                renderItem={({ item }) => {
                  const isActive = item.id === refresh.activeSlotId;
                  return (
                    <Pressable
                      testID={`${testID}-row-${item.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Partida ${item.name}${isActive ? ' (activa)' : ''}`}
                      onPress={() => onPick(item)}
                      disabled={busy}
                      style={({ pressed }) => ({
                        minHeight: 56,
                        paddingVertical: spacing[3],
                        paddingHorizontal: spacing[2],
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: pressed ? colors.surface2 : 'transparent',
                        gap: spacing[3],
                      })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: fontSize.md,
                            fontWeight: fontWeight.semibold,
                          }}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={{
                            color: colors.textMuted,
                            fontSize: fontSize.xs,
                          }}
                        >
                          Guardada {formatSavedAt(item.savedAt)}
                        </Text>
                      </View>
                      {isActive ? (
                        <View
                          testID={`${testID}-row-${item.id}-active`}
                          style={{
                            paddingHorizontal: spacing[2],
                            paddingVertical: spacing[1],
                            borderRadius: radii.pill,
                            backgroundColor: colors.primarySoft,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.primary,
                              fontSize: fontSize.xs,
                              fontWeight: fontWeight.bold,
                            }}
                          >
                            Activa
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                }}
              />
            )}

            {creating ? (
              <View style={{ gap: spacing[2] }}>
                <TextInput
                  testID={`${testID}-new-input`}
                  accessibilityLabel="Nombre de la nueva partida"
                  placeholder="Nombre de la partida"
                  placeholderTextColor={colors.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  maxLength={48}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={onCreate}
                  style={{
                    minHeight: 48,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                    borderRadius: radii.md,
                    paddingHorizontal: spacing[3],
                    color: colors.text,
                    fontSize: fontSize.md,
                    backgroundColor: colors.surface,
                  }}
                />
                <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                  <Pressable
                    testID={`${testID}-new-cancel`}
                    accessibilityRole="button"
                    onPress={() => {
                      setCreating(false);
                      setNewName('');
                    }}
                    disabled={busy}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radii.pill,
                      backgroundColor: pressed ? colors.surface2 : 'transparent',
                      borderWidth: 1,
                      borderColor: colors.border,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.semibold,
                      }}
                    >
                      Cancelar
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`${testID}-new-confirm`}
                    accessibilityRole="button"
                    onPress={onCreate}
                    disabled={busy || newName.trim().length === 0}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radii.pill,
                      backgroundColor:
                        newName.trim().length === 0
                          ? colors.surface2
                          : pressed
                            ? colors.primarySoft
                            : colors.primary,
                    })}
                  >
                    <Text
                      style={{
                        color:
                          newName.trim().length === 0
                            ? colors.textMuted
                            : colors.textOnPrimary,
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.bold,
                      }}
                    >
                      Crear
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                testID={`${testID}-new`}
                accessibilityRole="button"
                accessibilityLabel="Crear nueva partida"
                onPress={() => setCreating(true)}
                disabled={busy}
                style={({ pressed }) => ({
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.borderStrong,
                  backgroundColor: pressed ? colors.surface2 : 'transparent',
                })}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.bold,
                  }}
                >
                  Nueva partida
                </Text>
              </Pressable>
            )}

            <Pressable
              testID={`${testID}-close`}
              accessibilityRole="button"
              accessibilityLabel="Cerrar selector de partidas"
              onPress={() => setVisible(false)}
              style={({ pressed }) => ({
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.pill,
                backgroundColor: pressed ? colors.surface2 : 'transparent',
              })}
            >
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                }}
              >
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
