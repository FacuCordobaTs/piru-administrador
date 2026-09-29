package app.piru.admin

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // La tablet de comandas es un panel de operación permanente: la pantalla no debe apagarse
    // mientras la app está en primer plano. Es un flag de ventana, no un wakelock: el sistema
    // lo libera solo cuando la app deja de estar visible, así que no hay nada que soltar.
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.addJavascriptInterface(
      BatteryOptimizationsBridge(this),
      JS_INTERFACE_NAME,
    )
  }

  /**
   * Pide al sistema que excluya a la app de la optimización de batería (Doze), para que un
   * pedido no se demore por tener la red suspendida. El diálogo es del sistema y el usuario
   * puede rechazarlo: no hay nada que verificar acá.
   */
  @SuppressLint("BatteryLife")
  fun requestIgnoreBatteryOptimizations() {
    if (isIgnoringBatteryOptimizations()) return
    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
      .setData(Uri.parse("package:$packageName"))
    // Algunos fabricantes no exponen la pantalla: no vale tirar la app por eso.
    runCatching { startActivity(intent) }
  }

  private fun isIgnoringBatteryOptimizations(): Boolean {
    val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
    return powerManager.isIgnoringBatteryOptimizations(packageName)
  }

  /**
   * Puente mínimo para que el frontend dispare la excepción de batería:
   * `window.PiruAndroid.requestIgnoreBatteryOptimizations()`.
   *
   * Queda expuesto a cualquier página que cargue el WebView, por eso no recibe parámetros ni
   * devuelve datos: lo único que puede hacer es abrir el diálogo del sistema.
   */
  private class BatteryOptimizationsBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun requestIgnoreBatteryOptimizations() {
      activity.runOnUiThread { activity.requestIgnoreBatteryOptimizations() }
    }
  }

  companion object {
    const val JS_INTERFACE_NAME = "PiruAndroid"
  }
}
