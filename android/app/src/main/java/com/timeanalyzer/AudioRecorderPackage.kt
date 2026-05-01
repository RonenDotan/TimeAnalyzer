package com.timeanalyzer

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AudioRecorderPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        when (name) {
            AudioRecorderModule.NAME -> AudioRecorderModule(reactContext)
            else -> null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            AudioRecorderModule.NAME to ReactModuleInfo(
                AudioRecorderModule.NAME, AudioRecorderModule.NAME,
                false, false, false, false
            )
        )
    }
}
