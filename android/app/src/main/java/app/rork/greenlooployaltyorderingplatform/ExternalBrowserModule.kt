package app.rork.greenlooployaltyorderingplatform

import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class ExternalBrowserModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ExternalBrowser"
    }

    @ReactMethod
    fun openURL(url: String, promise: Promise) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))

            // These flags force Android to open in EXTERNAL browser app (not Custom Tabs)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            intent.addFlags(Intent.FLAG_ACTIVITY_MULTIPLE_TASK)

            // Explicitly exclude custom tabs/in-app browsers
            intent.addCategory(Intent.CATEGORY_BROWSABLE)

            val packageManager = reactApplicationContext.packageManager
            if (intent.resolveActivity(packageManager) != null) {
                reactApplicationContext.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.reject("NO_BROWSER", "No browser app found")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }
}
