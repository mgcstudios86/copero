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
  // MGC-994 — root-cause del surface-blank cold-start que vector 4 no resolvió.
  //
  // Vector 4 (PR #715, commit f0b60fd) reemplazó `expo-splash-screen` por
  // `androidx.core:core-splashscreen` y reordenó
  // `setTheme + installSplashScreen + super.onCreate`. Eso eliminó el path
  // roto donde el plugin transfería ownership del SurfaceView a Fabric.
  // PERO `installSplashScreen()` sin `setKeepOnScreenCondition` dismissa
  // el splash en el PRIMER frame post-onCreate. Bajo SDK 57 + RN 0.86
  // OldArch + DayNight, ese primer frame suele ser el windowBackground de
  // AppTheme (`?android:colorBackground` = #000000 en dark mode) ANTES
  // de que el ReactRootView entregue su primer Skia frame. Resultado QA
  // MGC-918 sobre PR #715: dumpsys SurfaceFlinger Layer 4068
  // color{0,0,0,1}, screencap t+2/5/15/30s alternando blanco/negro,
  // uiautomator ve el árbol React completo pero SurfaceFlinger no —
  // "Sin Home".
  //
  // Fix: gate del splash via `setKeepOnScreenCondition` que se mantiene
  // hasta que el decorView haya pintado >= 2 frames consecutivos
  // (umbral empírico: descarta el splash drawable transitorio y
  // requiere frames de Skia del ReactRootView). Hard-cap 2.5s para
  // no colgarse si JS crashea antes de dibujar. El OnDrawListener se
  // adjunta DESPUÉS de super.onCreate para garantizar que el decorView
  // está formado; `decor.post` lo encola fuera del frame actual, así el
  // primer OnDraw que contamos es del siguiente vsync.
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.Theme_App_Starting)
    val splashScreen = installSplashScreen()

    val gateStartedAt = SystemClock.uptimeMillis()
    var reactDrawCount = 0
    val REQUIRED_FRAMES = 2
    val HARD_CAP_MS = 2_500L

    splashScreen.setKeepOnScreenCondition {
      val elapsed = SystemClock.uptimeMillis() - gateStartedAt
      elapsed < HARD_CAP_MS && reactDrawCount < REQUIRED_FRAMES
    }

    super.onCreate(null)

    window.decorView.post {
      window.decorView.viewTreeObserver.addOnDrawListener(
        object : ViewTreeObserver.OnDrawListener {
          override fun onDraw() {
            reactDrawCount++
            if (reactDrawCount >= REQUIRED_FRAMES) {
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
