package com.timeanalyzer

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SpeechRecognitionModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var recognizer: SpeechRecognizer? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun getName() = NAME

    companion object {
        const val NAME = "SpeechRecognition"
    }

    @ReactMethod
    fun start(locale: String, promise: Promise) {
        mainHandler.post {
            try {
                recognizer?.destroy()
                recognizer = SpeechRecognizer.createSpeechRecognizer(reactContext)
                recognizer?.setRecognitionListener(createListener())
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                }
                recognizer?.startListening(intent)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("START_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        mainHandler.post {
            recognizer?.stopListening()
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Double) {}

    private fun createListener(): RecognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}

        override fun onPartialResults(partialResults: Bundle) {
            val text = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
            sendEvent("SpeechRecognition.onPartialResults", text)
        }

        override fun onResults(results: Bundle) {
            val text = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
            sendEvent("SpeechRecognition.onResults", text)
        }

        override fun onError(error: Int) {
            sendEvent("SpeechRecognition.onError", error.toString())
        }
    }

    private fun sendEvent(name: String, data: String) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(name, data)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onCatalystInstanceDestroy() {
        mainHandler.post {
            recognizer?.destroy()
            recognizer = null
        }
    }
}
