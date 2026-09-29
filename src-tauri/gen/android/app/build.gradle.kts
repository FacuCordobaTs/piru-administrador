import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// Firma del APK de release. `gen/android/keystore.properties` NO está versionado
// (ver src-tauri/.gitignore): lo escribe el workflow de release a partir de los
// secretos, o el dev a mano para firmar localmente. Sin esto el APK de release
// sale sin firmar y Android no lo instala — es el único motivo por el que existe
// esta config.
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        keystorePropertiesFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 36
    namespace = "app.piru.admin"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "app.piru.admin"
        minSdk = 24
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    // Sólo se crea si existe keystore.properties. Si no existe, el build sigue
    // funcionando (debug y release sin firmar) pero avisa al configurar Gradle.
    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                // `storeFile` es relativo a gen/android/ (la raíz del proyecto Gradle).
                storeFile = rootProject.file(
                    requireNotNull(keystoreProperties.getProperty("storeFile")) {
                        "gen/android/keystore.properties existe pero no define storeFile"
                    }
                )
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
            // Sin esto el APK de release se empaqueta sin firmar ('-unsigned.apk') y
            // Android lo rechaza al instalar ("App not installed").
            val releaseSigning = signingConfigs.findByName("release")
            if (releaseSigning == null) {
                logger.warn(
                    "AVISO: falta gen/android/keystore.properties — el APK de release " +
                        "va a salir SIN FIRMAR y no se va a poder instalar en la tablet."
                )
            }
            signingConfig = releaseSigning
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")