package com.mgcstudios.copero

import android.os.Build
import android.os.Bundle

import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  // MGC-890 — vector 4 splash replacement.
  //
  // Antes (plugin `expo-splash-screen`): MainActivity delegaba el splash a
  // `expo.modules.splashscreen.SplashScreenManager.registerOnActivity(this)`,
  // que transfería el ownership del SurfaceView al Fabric SurfaceView. Bajo
  // `newArchEnabled=true` (forzado por SDK 57) esa transferencia dejaba el
  // compositor pegado al Window background Android-12+ (`color{<0,0,0,1>}`),
  // Skia no entregaba frames al SurfaceView y el cold-start quedaba en
  // blanco permanente.
  //
  // Ahora (androidx.core:core-splashscreen 1.0.1): el splash se monta como
  // window-background drawable sin tocar el árbol React. La release del
  // splash la dispara el primer contenido pintado (ver RootLayout
  // fontsLoaded/fontError fallback + Activity.reportFullyDrawn). El
  // `setTheme(R.style.Theme_App_Starting)` ANTES de installSplashScreen()
  // es el punto clave: aplica `Theme.App.Starting` que el manifest ya
  // pre-asignó a esta Activity, pero MainActivity necesita confirmarlo en
  // runtime para que `installSplashScreen` haga la transición al
  // `postSplashScreenTheme` (AppTheme) sin flash blanco.
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.Theme_App_Starting)
    installSplashScreen()
    super.onCreate(null)
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
