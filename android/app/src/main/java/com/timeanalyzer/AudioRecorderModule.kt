package com.timeanalyzer

import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.*
import java.io.File

class AudioRecorderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var recorder: MediaRecorder? = null
    private var outputPath: String? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun getName() = NAME

    companion object {
        const val NAME = "AudioRecorder"
    }

    @ReactMethod
    fun startRecording(promise: Promise) {
        mainHandler.post {
            try {
                val file = File(reactContext.cacheDir, "checkin_${System.currentTimeMillis()}.m4a")
                outputPath = file.absolutePath

                recorder = MediaRecorder(reactContext).apply {
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                    setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                    setAudioSamplingRate(16000)
                    setAudioEncodingBitRate(64000)
                    setOutputFile(outputPath)
                    prepare()
                    start()
                }
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("START_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        mainHandler.post {
            try {
                recorder?.apply { stop(); release() }
                recorder = null
                promise.resolve("file://$outputPath")
            } catch (e: Exception) {
                promise.reject("STOP_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Double) {}
}
