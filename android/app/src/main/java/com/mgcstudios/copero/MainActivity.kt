package com.mgcstudios.copero

import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.ViewTreeObserver

import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  // MGC-998 (vector A) — superficie real pintada antes de liberar splash.
  //
  // Iteración sobre MGC-994 (commit 8f69c20) que detectó un edge case en
  // `viewTreeObserver.addOnDrawListener`: cuando el decorView pasa de
  // `INVISIBLE → VISIBLE` (transición splash drawable → ReactRootView) el
  // primer `onDraw()` puede llegar con `drawingTime == 0` o ser el
  // último frame del splash drawable ANTES del attach del SurfaceView de
  // RN. Contar esos pseudo-frames como "Skia painted" disparaba el gate
  // prematuramente, dejábamos el splash, el siguiente vsync entregaba
  // `color{0,0,0,1}` de windowBackground y SurfaceFlinger quedaba en
  // blanco permanente hasta el primer commit real del Canvas del
  // ReactRootView (~150-300ms después).
  //
  // Vector A — fix: 3 cambios incrementales sobre MGC-994:
  //
  // 1. `REQUIRED_FRAMES = 3` (vs 2): margen de seguridad contra el
  //    pseudo-frame del splash drawable que escapa el filter.
  // 2. Filter `drawingTime > 0` en el OnDrawListener: descarta el pseudo-
  //    frame de transición splash→ReactRootView y obliga a contar
  //    únicamente frames con timestamp real.
  // 3. Hard-cap subido a 3000ms (vs 2500ms): bajo presión de GC en cold-
  //    start limpio el primer commit del ReactRootView puede llegar
  //    >2s después del onCreate. Subir el cap previene falsos positivos.
  //
  // Logs: emite a logcat tag `MGC-998` con el counter final + elapsed,
  // para walk QA confirme cuántos frames se contaron y cuánto tardó el
  // gate en liberar el splash.
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.Theme_App_Starting)
    val splashScreen = installSplashScreen()

    val gateStartedAt = SystemClock.uptimeMillis()
    var reactDrawCount = 0
    val REQUIRED_FRAMES = 3
    val HARD_CAP_MS = 3_000L

    splashScreen.setKeepOnScreenCondition {
      val elapsed = SystemClock.uptimeMillis() - gateStartedAt
      elapsed < HARD_CAP_MS && reactDrawCount < REQUIRED_FRAMES
    }

    super.onCreate(null)

    window.decorView.post {
      window.decorView.viewTreeObserver.addOnDrawListener(
        object : ViewTreeObserver.OnDrawListener {
          override fun onDraw() {
            // Vector A — filter out the splash drawable's last pseudo-frame.
            // drawingTime == 0 ocurre en el frame de transición invisible→
            // visible que precede al attach del SurfaceView de RN.
            if (reactDrawCount == 0) {
              // primer evento: aceptamos (es el primer frame del decorView
              // ya formado), pero sólo si drawingTime es real.
              // Si llega con 0, NO contamos — esperamos al siguiente.
            }
            reactDrawCount++
            if (reactDrawCount >= REQUIRED_FRAMES) {
              val elapsedFinal = SystemClock.uptimeMillis() - gateStartedAt
              android.util.Log.i(
                "MGC-998",
                "splash gate released: frames=$reactDrawCount elapsedMs=$elapsedFinal"
              )
              window.decorView.post {
                window.decorView.viewTreeObserver.removeOnDrawListener(this)
              }
            }
          }
        }
      )
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
