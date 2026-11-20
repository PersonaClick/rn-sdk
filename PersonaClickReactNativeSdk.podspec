require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "PersonaClickReactNativeSdk"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/PersonaClick/rn-sdk"
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "15.0" }
  s.source       = { :git => "https://github.com/PersonaClick/rn-sdk.git", :tag => "v#{s.version}" }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.swift_version = "5.9"

  # The PersonaClick iOS SDK comes through Swift Package Manager: CocoaPods trunk is read-only. 3.41.0: the
  # bridges' TrackingSource(rawType:code:) — slider and agent_search go as their wire values.
  spm_dependency(s,
    url: "https://github.com/personaClick/ios-sdk.git",
    requirement: { kind: "exactVersion", version: "3.41.0" },
    products: ["PersonaClick"]
  )

  install_modules_dependencies(s)
end
