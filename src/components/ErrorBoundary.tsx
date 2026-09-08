/**
 * ErrorBoundary — captura crashes del árbol React y muestra fallback.
 *
 * MGC-2320 — bug P0: tap en btn-career (home → /simulador-carrera/identity)
 * cerraba la app y abría el launcher. Causa: el lazy chunk de identity
 * crasheaba durante el import del store (engine.ts → simulation.ts) y
 * sin boundary la cascada mataba el proceso. La home navegaba pero la
 * promesa del lazy() se rechazaba sincrónicamente en el module-load.
 *
 * Comportamiento:
 *  - Captura `componentDidCatch` + `getDerivedStateFromError`.
 *  - Loguea con `console.error` (Sentry captura `console.error` global
 *    en build production) y muestra fallback visual con CTA "Reintentar"
 *    que reinicia el árbol hijo vía `resetErrorBoundary`.
 *  - NO reemplaza al error overlay de React Native — ese sólo dispara
 *    en dev. En producción el crash silencioso mata la app; este
 *    boundary previene eso y devuelve UI utilizable.
 *
 * Uso en root layout:
 *   <ErrorBoundary>
 *     <Stack>...</Stack>
 *   </ErrorBoundary>
 *
 * Si el lazy chunk falla al cargar identidad, el error boundary queda
 * armado en el root y la app sobrevive — la pantalla rota puede mostrar
 * un mensaje en lugar del launcher.
 */
import { Component, type ErrorInfo, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
  /** Componente custom de fallback (opcional). */
  fallback?: (err: Error, reset: () => void) => ReactNode;
  /** Etiqueta para logs. Default: 'ErrorBoundary'. */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log explícito — Sentry y Metro dev ambos capturan console.error.
    // Antes el crash se perdía sin telemetría y QA sólo veía el launcher.
    // eslint-disable-next-line no-console
    console.error(`[${this.props.label ?? 'ErrorBoundary'}] crash:`, error, info?.componentStack ?? '');
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }
    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return <DefaultFallback error={this.state.error} onReset={this.reset} />;
  }
}

interface FallbackProps {
  error: Error;
  onReset: () => void;
}

function DefaultFallback({ error, onReset }: FallbackProps): ReactElement {
  return (
    <View style={styles.root} accessibilityRole="alert">
      <Text style={styles.title}>Algo salió mal</Text>
      <Text style={styles.body} numberOfLines={4}>
        {error?.message ?? 'Error inesperado al cargar la pantalla.'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reintentar"
        onPress={onReset}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <Text style={styles.btnLabel}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#09090B',
  },
  title: {
    color: '#F4F1EB',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#C7C5BF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: '#34D399',
    borderRadius: 8,
  },
  btnPressed: { opacity: 0.85 },
  btnLabel: {
    color: '#062A1B',
    fontWeight: '700',
    fontSize: 16,
  },
});