package com.personaclick.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class PersonaClickNativePackage : BaseReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == PersonaClickNativeModule.NAME) PersonaClickNativeModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            // name, className, canOverrideExistingModule, needsEagerInit, isCxxModule, isTurboModule
            PersonaClickNativeModule.NAME to ReactModuleInfo(
                PersonaClickNativeModule.NAME,
                PersonaClickNativeModule.NAME,
                false,
                false,
                false,
                true,
            )
        )
    }
}
