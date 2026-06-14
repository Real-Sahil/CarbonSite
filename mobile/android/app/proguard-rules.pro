# Flutter release build ProGuard / R8 rules

# google_mlkit_text_recognition ships code that optionally references
# Chinese, Devanagari, Japanese, and Korean recognizer classes from
# separate ML Kit language modules. We only ship the Latin (default)
# recognizer, so suppress R8 missing-class errors for the unused modules.
-dontwarn com.google.mlkit.vision.text.chinese.**
-dontwarn com.google.mlkit.vision.text.devanagari.**
-dontwarn com.google.mlkit.vision.text.japanese.**
-dontwarn com.google.mlkit.vision.text.korean.**

# Keep ML Kit text recognition entry points used by the Flutter plugin
-keep class com.google_mlkit_text_recognition.** { *; }
